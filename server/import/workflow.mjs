import {WorkflowEntrypoint} from 'cloudflare:workers';
import {getContainer} from '@cloudflare/containers';
import {consumeSortedImportStream} from '../mcp/plugin-import-stream-core.mjs';
import {readBoundedText} from '../mcp/stream-json.mjs';
import {createImportDatabase} from '../sql/engine.mjs';
import {writeOrderedConversation} from './ordered-writer.mjs';
import {readImportJob,writeImportJob,stagingKey,safeImportFailure}
 from './job-store.mjs';

function containerError(detail,status){
 let code='container_rejected_stream';
 try{
  const parsed=JSON.parse(String(detail||''));
  const candidate=parsed?.error?.code||parsed?.code;
  if(typeof candidate==='string'&&/^[a-z0-9_]{1,80}$/i.test(candidate))code=candidate;
 }catch{}
 return Object.assign(new Error('LAS Container could not process the import'),
  {code,httpStatus:status||502});
}

async function processImport(env,job){
 const source=await env.LAS_PLUGIN_IMPORT_STAGING.get(stagingKey(job.upload_id));
 if(!source?.body)throw Object.assign(new Error('Staged import is missing'),
  {code:'import_staging_missing',httpStatus:410});
 if(!env.LAS_PLUGIN_IMPORT)throw Object.assign(new Error('Container binding unavailable'),
  {code:'container_binding_unavailable',httpStatus:503});
 const container=getContainer(env.LAS_PLUGIN_IMPORT,'las-plugin-import-v1');
 const forwarded=new Request('http://container/ingest',{
  method:'POST',headers:{'content-type':'application/x-ndjson'},body:source.body
 });
 const upstream=await container.containerFetch(forwarded);
 if(!upstream.ok){
  const detail=await readBoundedText(upstream.body,8192).catch(()=> '');
  throw containerError(detail,upstream.status);
 }
 const {db,type}=await createImportDatabase(env);
 try{
  const receipt=await consumeSortedImportStream(upstream,{
   writeConversation:args=>writeOrderedConversation(db,{...args,type})
  });
  if(receipt.upload_id!==job.upload_id||
     receipt.conversations!==job.conversation_count||
     receipt.records!==job.record_count)
   throw Object.assign(new Error('Import counts do not match the accepted job'),
    {code:'import_receipt_mismatch',httpStatus:409});
  return receipt;
 }finally{await db.destroy().catch(()=>{});}
}

export class PluginImportWorkflow extends WorkflowEntrypoint {
 async run(event,step){
  const jobId=event.payload?.job_id;
  if(typeof jobId!=='string')throw new Error('Invalid Plugin Import Workflow event');
  const job=await step.do('load accepted import job',async()=>{
   const value=await readImportJob(this.env.LAS_PLUGIN_IMPORT_STAGING,jobId);
   if(!value)throw Object.assign(new Error('Import job metadata is missing'),
    {code:'import_job_metadata_missing',httpStatus:404});
   return value;
  });
  if(job.state==='completed')return job.result;
  if(job.state==='failed')throw Object.assign(new Error('Import job already failed'),
   {code:job.error?.code||'import_job_failed',httpStatus:job.error?.status||500});

  await step.do('mark import running',async()=>{
   await writeImportJob(this.env.LAS_PLUGIN_IMPORT_STAGING,jobId,{state:'running'});
   return {state:'running'};
  });
  try{
   const result=await step.do('normalize and write Galaxy import',{
    timeout:'30 minutes',retries:{limit:3,delay:'10 seconds',backoff:'exponential'}
   },async()=>processImport(this.env,job));
   await step.do('record import receipt',async()=>{
    await writeImportJob(this.env.LAS_PLUGIN_IMPORT_STAGING,jobId,
     {state:'completed',result});
    return {state:'completed'};
   });
   await step.do('remove completed staged payload',async()=>{
    await this.env.LAS_PLUGIN_IMPORT_STAGING.delete(stagingKey(job.upload_id))
     .catch(error=>console.warn('LAS import staging cleanup failed',{
      code:String(error?.code||'r2_delete_failed').slice(0,64)
     }));
    return {removed:true};
   });
   return result;
  }catch(error){
   const failure=safeImportFailure(error);
   await step.do('record failed import',async()=>{
    await writeImportJob(this.env.LAS_PLUGIN_IMPORT_STAGING,jobId,
     {state:'failed',error:failure});
    return {state:'failed'};
   }).catch(()=>{});
   throw error;
  }
 }
}
