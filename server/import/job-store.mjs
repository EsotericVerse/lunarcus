export const IMPORT_QUEUE='las-plugin-import';
export const IMPORT_DLQ='las-plugin-import-dlq';
const JOB_PREFIX='plugin-import/jobs/';
export const STAGING_PREFIX='plugin-import/staging/';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RANK={staged:0,queued:1,running:2,completed:3,failed:3};

export function validImportId(value){return typeof value==='string'&&UUID.test(value);}
export const jobKey=id=>JOB_PREFIX+id+'.json';
export const stagingKey=id=>STAGING_PREFIX+id+'.ndjson';

export async function readImportJob(bucket,id){
 if(!bucket||!validImportId(id))return null;
 const object=await bucket.get(jobKey(id));
 if(!object)return null;
 try{return await object.json();}catch{return null;}
}

export async function writeImportJob(bucket,id,patch){
 const prior=await readImportJob(bucket,id);
 if(!prior)throw Object.assign(new Error('Import job metadata is missing'),
  {code:'import_job_metadata_missing',httpStatus:500});
 const nextState=patch?.state||prior.state;
 if((RANK[nextState]??-1)<(RANK[prior.state]??-1)||
    ['completed','failed'].includes(prior.state))return prior;
 const next={...prior,...patch,updated_at:new Date().toISOString()};
 await bucket.put(jobKey(id),JSON.stringify(next),{
  httpMetadata:{contentType:'application/json; charset=utf-8'}
 });
 return next;
}

export function publicImportJob(job){
 if(!job)return null;
 return {job_id:job.job_id,upload_id:job.upload_id,state:job.state,
  conversations:job.conversation_count,records:job.record_count,
  ...(job.state==='completed'?{result:job.result}:{}),
  ...(job.state==='failed'?{error:job.error||{code:'import_failed'}}:{})};
}

export function safeImportFailure(error){
 const raw=String(error?.code||'import_processing_failed');
 const code=/^[a-z0-9_]{1,80}$/i.test(raw)?raw:'import_processing_failed';
 const status=Number(error?.httpStatus);
 return {code,status:Number.isInteger(status)&&status>=400&&status<=599?status:500};
}
