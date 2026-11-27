import {IMPORT_DLQ,validImportId,readImportJob,writeImportJob}
 from './job-store.mjs';

async function isExistingWorkflow(binding,id){
 if(!binding||typeof binding.get!=='function')return false;
 try{await binding.get(id);return true;}catch{return false;}
}

export async function consumePluginImportQueue(batch,env={}){
 const isDlq=String(batch?.queue||'')===IMPORT_DLQ;
 for(const message of batch?.messages||[]){
  const id=message?.body?.job_id;
  if(!validImportId(id)){message.ack();continue;}
  const bucket=env.LAS_PLUGIN_IMPORT_STAGING;
  const job=await readImportJob(bucket,id);
  if(!job||['completed','failed'].includes(job.state)){
   message.ack();continue;
  }
  if(isDlq){
   await writeImportJob(bucket,id,{state:'failed',error:{
    code:'import_queue_retries_exhausted',status:503
   }});
   message.ack();continue;
  }
  const flow=env.LAS_PLUGIN_IMPORT_FLOW;
  if(!flow||typeof flow.create!=='function')throw new Error('LAS import Workflow binding unavailable');
  if(job.state==='staged')
   await writeImportJob(bucket,id,{state:'queued'});
  try{
   await flow.create({id,params:{job_id:id}});
  }catch(error){
   // Queue delivery is at least once. An existing Workflow proves that a
   // duplicate pointer is safe to acknowledge; otherwise let Queue retry.
   if(!await isExistingWorkflow(flow,id))throw error;
  }
  message.ack();
 }
}
