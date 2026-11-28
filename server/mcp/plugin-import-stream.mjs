import {checkMcpGatewayQos} from './gateway-rate.mjs';
import {mcpConfig,verifyOAuthToken} from './router.mjs';
import {readImportJob,jobKey,stagingKey,
 validImportId,publicImportJob} from '../import/job-store.mjs';

const EXTENSION_ORIGIN='chrome-extension://hiaeafonocnjaclcfgjmdopbcgnafnna';
const MAX_UPLOAD_BYTES=128*1024*1024;
const MAX_RECORDS=50000,MAX_CONVERSATIONS=5000;
function headers(origin='*',methods='POST, OPTIONS'){
 return {'cache-control':'no-store','x-content-type-options':'nosniff',
  'access-control-allow-origin':origin,'access-control-allow-methods':methods,
  'access-control-allow-headers':'Authorization, Content-Type, X-LAS-Upload-Id, X-LAS-Conversation-Count, X-LAS-Record-Count',
  'access-control-expose-headers':'Retry-After, Location','vary':'Origin'};
}
function json(body,status=200,origin='*',extra={}){
 return new Response(JSON.stringify(body),{status,headers:{...headers(origin),
  'content-type':'application/json; charset=utf-8',...extra}});
}
function statusJson(body,status=200,origin='*',extra={}){
 return new Response(JSON.stringify(body),{status,headers:{...headers(origin,'GET, OPTIONS'),
  'content-type':'application/json; charset=utf-8',...extra}});
}
function countHeader(request,name,max){
 const value=request.headers.get(name)||'';
 if(!/^[1-9][0-9]*$/.test(value))return null;
 const count=Number(value);
 return Number.isSafeInteger(count)&&count<=max?count:null;
}
function rejectedOrigin(request){
 const origin=request.headers.get('origin')||'';
 return origin&&origin!==EXTENSION_ORIGIN;
}
export function containerFailureCode(detail){
 try{
  const parsed=JSON.parse(String(detail||''));
  const code=parsed?.error?.code||parsed?.code;
  return typeof code==='string'&&/^[a-z0-9_]{1,80}$/i.test(code)
   ?code:'container_rejected_stream';
 }catch{return 'container_rejected_stream';}
}

async function authenticate(request,env,origin){
 const bearer=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'')?.[1];
 if(!bearer)return {response:json({error:'unauthorized'},401,origin,{
  'www-authenticate':'Bearer resource_metadata="https://mcp.lo3rwang.cc/.well-known/oauth-protected-resource"'
 })};
 let identity;
 try{identity=await verifyOAuthToken(request,mcpConfig(),env);}
 catch(error){
  if(error?.code==='LAS_JWKS_UNAVAILABLE')return {response:json(
   {error:'oauth_temporarily_unavailable'},503,origin,{'retry-after':'15'}
  )};
  return {response:json({error:'unauthorized'},401,origin)};
 }
 if(!identity)return {response:json({error:'unauthorized'},401,origin)};
 if(!identity.scopes?.includes('loc:import'))
  return {response:json({error:'import_scope_required'},403,origin)};
 const qos=checkMcpGatewayQos(identity.subject);
 if(!qos.allowed)return {response:json({error:'rate_limited'},429,origin,{
  'retry-after':String(Math.max(1,Math.ceil(qos.retryAfterMs/1000)))
 })};
 return {identity};
}

function boundedBody(body,maxBytes){
 const reader=body.getReader();let bytes=0;
 const stream=new ReadableStream({
  async pull(controller){
   try{
    const part=await reader.read();
    if(part.done){controller.close();return;}
    bytes+=part.value.byteLength;
    if(bytes>maxBytes){
     await reader.cancel().catch(()=>{});
     controller.error(Object.assign(new Error('Upload exceeds the stream limit'),
      {code:'upload_too_large',httpStatus:413}));
     return;
    }
    controller.enqueue(part.value);
   }catch(error){controller.error(error);}
  },
  async cancel(reason){await reader.cancel(reason).catch(()=>{});}
 });
 return {stream,get bytes(){return bytes;}};
}

function retryableImportFailure(error){
 const status=Number(error?.httpStatus??error?.status??error?.statusCode);
 return !(Number.isInteger(status)&&status>=400&&status<500);
}
async function retryImportOperation(operation){
 try{return await operation();}
 catch(error){
  if(!retryableImportFailure(error))throw error;
  await new Promise(resolve=>setTimeout(resolve,150));
  return operation();
 }
}

function acceptedJob(job,origin,status=202){
 const info=publicImportJob(job);
 return json({accepted:true,...info},status,origin,{
  ...(status===202?{'retry-after':'5'}:{})
 });
}

export async function handlePluginImportStream(request,env={}){
 const origin=request.headers.get('origin')||'';
 if(request.method==='OPTIONS'){
  if(origin!==EXTENSION_ORIGIN)return json({error:'origin_not_allowed'},403,'null');
  return new Response(null,{status:204,headers:headers(EXTENSION_ORIGIN)});
 }
 if(rejectedOrigin(request))return json({error:'origin_not_allowed'},403,'null');
 const allowedOrigin=origin||'*';
 if(request.method!=='POST')return json({error:'method_not_allowed'},405,allowedOrigin,{allow:'POST, OPTIONS'});
 const contentType=String(request.headers.get('content-type')||'').split(';',1)[0].trim().toLowerCase();
 if(contentType!=='application/x-ndjson')return json({error:'expected_ndjson'},415,allowedOrigin);
 if(request.headers.has('content-encoding')&&request.headers.get('content-encoding')!=='identity')
  return json({error:'unsupported_content_encoding'},415,allowedOrigin);
 if(!request.body)return json({error:'empty_stream'},400,allowedOrigin);
 const length=request.headers.get('content-length');
 if(length!==null&&(!/^[0-9]+$/.test(length)||Number(length)>MAX_UPLOAD_BYTES))
  return json({error:'upload_too_large'},413,allowedOrigin);
 const uploadId=request.headers.get('x-las-upload-id')||'';
 if(!validImportId(uploadId))return json({error:'invalid_upload_id'},400,allowedOrigin);
 const conversations=countHeader(request,'x-las-conversation-count',MAX_CONVERSATIONS);
 const records=countHeader(request,'x-las-record-count',MAX_RECORDS);
 if(!conversations||!records)return json({error:'invalid_import_counts'},400,allowedOrigin);

 const auth=await authenticate(request,env,allowedOrigin);
 if(auth.response)return auth.response;
 const bucket=env.LAS_PLUGIN_IMPORT_STAGING,queue=env.LAS_PLUGIN_IMPORT_QUEUE;
 if(!bucket||typeof bucket.get!=='function'||typeof bucket.put!=='function'||
    !queue||typeof queue.send!=='function')
  return json({error:'import_storage_unavailable'},503,allowedOrigin);

 let phase='job_lookup';
 try{
  const previous=await retryImportOperation(()=>readImportJob(bucket,uploadId));
  if(previous){
   if(previous.owner!==auth.identity.subject)
    return json({error:'import_job_not_found'},404,allowedOrigin);
   if(previous.state==='failed')return json({accepted:false,
    ...publicImportJob(previous)},409,allowedOrigin);
   if(previous.state==='completed')return acceptedJob(previous,allowedOrigin,200);
   if(previous.state==='staged'){
    phase='queue_send';
    // Queue delivery is at least once; the consumer deduplicates by this stable
    // Workflow ID, so a retry after an ambiguous send result is safe.
    await retryImportOperation(()=>queue.send({job_id:uploadId}));
   }
   return acceptedJob(previous,allowedOrigin,202);
  }

  const bounded=boundedBody(request.body,MAX_UPLOAD_BYTES);
  phase='staging_write';
  await bucket.put(stagingKey(uploadId),bounded.stream,{
   httpMetadata:{contentType:'application/x-ndjson'}
  });
  if(bounded.bytes<1)return json({error:'empty_stream'},400,allowedOrigin);
  const now=new Date().toISOString();
  const job={job_id:uploadId,upload_id:uploadId,owner:auth.identity.subject,
   state:'staged',conversation_count:conversations,record_count:records,
   created_at:now,updated_at:now};
  phase='job_metadata_write';
  // Replacing this stable key is idempotent if R2 stored the object before a
  // transient error reached the Worker.
  await retryImportOperation(()=>bucket.put(jobKey(uploadId),JSON.stringify(job),{
   httpMetadata:{contentType:'application/json; charset=utf-8'}
  }));
  // Queue carries only a short R2 object pointer. The Workflow reads the
  // private staged stream and the browser keeps its original rows until the
  // completed import receipt is polled and checked.
  phase='queue_send';
  await retryImportOperation(()=>queue.send({job_id:uploadId}));
  return acceptedJob(job,allowedOrigin,202);
 }catch(error){
  const status=Number(error?.httpStatus??error?.status??error?.statusCode);
  const safeStatus=Number.isInteger(status)&&status>=400&&status<=599?status:503;
  const phaseCode={
   job_lookup:'import_job_lookup_failed',
   staging_write:'import_staging_write_failed',
   job_metadata_write:'import_job_metadata_write_failed',
   queue_send:'import_queue_send_failed'
  }[phase];
  const code=typeof error?.code==='string'&&/^[a-z0-9_]{1,80}$/i.test(error.code)
   ?error.code:phaseCode;
  console.warn('LAS plugin import step failed',{phase,status:safeStatus,code});
  return json({error:code,message:safeStatus===413?'Import exceeds the stream limit':
   'LAS could not accept the import at this stage'},safeStatus,allowedOrigin,{'retry-after':'15'});
 }
}

export async function handlePluginImportStatus(request,env={}){
 const origin=request.headers.get('origin')||'';
 if(request.method==='OPTIONS'){
  if(origin!==EXTENSION_ORIGIN)return statusJson({error:'origin_not_allowed'},403,'null');
  return new Response(null,{status:204,headers:headers(EXTENSION_ORIGIN,'GET, OPTIONS')});
 }
 if(rejectedOrigin(request))return statusJson({error:'origin_not_allowed'},403,'null');
 const allowedOrigin=origin||'*';
 if(request.method!=='GET')return statusJson({error:'method_not_allowed'},405,allowedOrigin,{allow:'GET, OPTIONS'});
 const auth=await authenticate(request,env,allowedOrigin);
 if(auth.response)return new Response(await auth.response.text(),{
  status:auth.response.status,headers:{...Object.fromEntries(auth.response.headers),
   ...headers(allowedOrigin,'GET, OPTIONS')}
 });
 const ids=new URL(request.url).searchParams.getAll('job_id');
 if(!ids.length||ids.length>20||ids.some(id=>!validImportId(id)))
  return statusJson({error:'invalid_job_id'},400,allowedOrigin);
 const bucket=env.LAS_PLUGIN_IMPORT_STAGING;
 if(!bucket)return statusJson({error:'import_storage_unavailable'},503,allowedOrigin);
 const jobs=[];
 for(const id of [...new Set(ids)]){
  const job=await readImportJob(bucket,id);
  if(!job||job.owner!==auth.identity.subject)
   return statusJson({error:'import_job_not_found'},404,allowedOrigin);
  jobs.push(publicImportJob(job));
 }
 return statusJson(ids.length===1?{accepted:true,...jobs[0]}:
  {accepted:true,jobs},200,allowedOrigin);
}
