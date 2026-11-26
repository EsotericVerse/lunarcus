import {createServer} from 'node:http';
import {TextDecoder} from 'node:util';
import {LIMITS,validateStart,validateConversation,validateMessage,normalizeConversation}
 from './processor.mjs';

function fail(code,message,status=400){return Object.assign(new Error(message),{code,httpStatus:status});}
async function* readNdjson(request){
 const decoder=new TextDecoder('utf-8',{fatal:true});
 let buffer='',bytes=0;
 for await(const chunk of request){
  bytes+=chunk.byteLength;
  if(bytes>LIMITS.maxUploadBytes)throw fail('upload_too_large','Upload exceeds the stream limit',413);
  buffer+=decoder.decode(chunk,{stream:true});
  if(Buffer.byteLength(buffer,'utf8')>LIMITS.maxLineBytes)
   throw fail('line_too_large','NDJSON frame exceeds the line limit',413);
  let newline;
  while((newline=buffer.indexOf('\n'))>=0){
   let line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);
   if(line.endsWith('\r'))line=line.slice(0,-1);
   if(!line.trim())throw fail('empty_line','Empty NDJSON frame');
   if(Buffer.byteLength(line,'utf8')>LIMITS.maxLineBytes)
    throw fail('line_too_large','NDJSON frame exceeds the line limit',413);
   let frame;
   try{frame=JSON.parse(line);}catch{throw fail('invalid_json','Invalid NDJSON frame');}
   yield frame;
  }
 }
 buffer+=decoder.decode();
 if(buffer.length){
  if(Buffer.byteLength(buffer,'utf8')>LIMITS.maxLineBytes)
   throw fail('line_too_large','NDJSON frame exceeds the line limit',413);
  let frame;
  try{frame=JSON.parse(buffer);}catch{throw fail('invalid_json','Invalid NDJSON frame');}
  yield frame;
 }
}
async function writeFrame(response,frame){
 if(response.destroyed||response.writableEnded)throw fail('client_closed','Stream consumer disconnected',499);
 if(!response.write(JSON.stringify(frame)+'\n')){
  await new Promise((resolve,reject)=>{
   const cleanup=()=>{response.off('drain',drain);response.off('close',close);response.off('error',error);};
   const drain=()=>{cleanup();resolve();};
   const close=()=>{cleanup();reject(fail('client_closed','Stream consumer disconnected',499));};
   const error=e=>{cleanup();reject(e);};
   response.once('drain',drain);response.once('close',close);response.once('error',error);
  });
 }
}
function jsonError(response,error){
 const status=Number(error?.httpStatus)||400;
 if(!response.headersSent){
  response.writeHead(status,{'content-type':'application/json; charset=utf-8',
   'cache-control':'no-store','x-content-type-options':'nosniff'});
  response.end(JSON.stringify({error:{code:error?.code||'invalid_stream',
   message:status>=500?'Container processing unavailable':String(error?.message||'Invalid stream')}}));
 }else if(!response.writableEnded){
  response.write(JSON.stringify({type:'error',code:error?.code||'invalid_stream',
   message:status>=500?'Container processing unavailable':String(error?.message||'Invalid stream')})+'\n');
  response.end();
 }
}
async function handle(request,response){
 if(request.method==='GET'&&request.url==='/ping'){
  response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
  response.end('{"ok":true}');return;
 }
 if(request.method!=='POST'||request.url!=='/ingest'){
  response.writeHead(404,{'content-type':'application/json'});response.end('{"error":"not_found"}');return;
 }
 if(!String(request.headers['content-type']||'').toLowerCase().startsWith('application/x-ndjson')){
  response.writeHead(415,{'content-type':'application/json'});response.end('{"error":"expected_ndjson"}');return;
 }
 let header=null,active=null,conversations=0,records=0,started=false,finished=false;
 try{
  for await(const frame of readNdjson(request)){
   if(finished)throw fail('trailing_frame','Data received after final frame');
   if(!header){
    header=validateStart(frame);
    response.writeHead(200,{'content-type':'application/x-ndjson; charset=utf-8',
     'cache-control':'no-store','x-content-type-options':'nosniff'});
    started=true;
    await writeFrame(response,{type:'start',version:1,upload_id:header.upload_id,
     conversation_count:header.conversation_count,record_count:header.record_count});
    continue;
   }
   if(frame?.type==='conversation'){
    if(active)throw fail('nested_conversation','Previous conversation is not closed');
    if(conversations>=header.conversation_count)throw fail('too_many_conversations','Too many conversations');
    active={...validateConversation(frame),records:[]};
    continue;
   }
   if(frame?.type==='message'){
    if(!active)throw fail('message_without_conversation','Message has no conversation header');
    if(records>=header.record_count)throw fail('too_many_records','More messages than declared');
    active.records.push(validateMessage(frame));records++;
    continue;
   }
   if(frame?.type==='conversation_end'){
    if(!active)throw fail('unexpected_conversation_end','No open conversation');
    if(frame.record_count!==active.records.length)
     throw fail('conversation_count_mismatch','Conversation record count mismatch');
    const normalized=normalizeConversation(active,active.records);
    await writeFrame(response,{type:'conversation',scopeid:normalized.scopeid,
     source_key:normalized.source_key,title:normalized.title});
    for(const row of normalized.records)await writeFrame(response,{type:'message',...row});
    await writeFrame(response,{type:'conversation_end',record_count:normalized.records.length});
    conversations++;active=null;
    continue;
   }
   if(frame?.type==='finish'){
    if(active)throw fail('unfinished_conversation','Conversation is not closed');
    if(frame.upload_id!==header.upload_id||
       frame.conversation_count!==conversations||
       frame.record_count!==records||
       conversations!==header.conversation_count||records!==header.record_count)
     throw fail('upload_count_mismatch','Final stream counts do not match');
    await writeFrame(response,{type:'finish',upload_id:header.upload_id,
     conversation_count:conversations,record_count:records});
    finished=true;continue;
   }
   throw fail('unknown_frame','Unknown NDJSON frame type');
  }
  if(!header||!finished)throw fail('incomplete_stream','Stream ended before final frame');
  response.end();
 }catch(error){jsonError(response,error);}
}
const server=createServer((request,response)=>{
 void handle(request,response).catch(error=>jsonError(response,error));
});
server.keepAliveTimeout=65000;
server.headersTimeout=66000;
server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>{});
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
