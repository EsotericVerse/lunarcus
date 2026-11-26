import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeSortedImportStream} from '../server/mcp/plugin-import-stream-core.mjs';

const upload='d7c2a7b8-3e8f-4b7d-9a61-72e5d3b6a1c4';
const enc=new TextEncoder();
function response(frames,status=200){
 const chunks=frames.map(frame=>enc.encode(JSON.stringify(frame)+'\\n'));
 return new Response(new ReadableStream({start(controller){
  for(const chunk of chunks)controller.enqueue(chunk);controller.close();
 }}),{status,headers:{'content-type':'application/x-ndjson'}});
}
function start(record_count=3,conversation_count=1){return {type:'start',version:1,
 upload_id:upload,record_count,conversation_count};}
const conv={type:'conversation',scopeid:'lo3rwang',
 source_key:'https://chatgpt.com/c/12345678-1234-4234-8234-123456789abc',title:'對話'};
const msg=(id,n)=>({type:'message',message_id:id,source_order:n,parent_id:null,
 role:n%2?'assistant':'user',text:'訊息 '+n});
const end={type:'conversation_end',record_count:3};
const finish={type:'finish',upload_id:upload,conversation_count:1,record_count:3};
function receipt(scopeid,records){return {accepted:true,scopeid,uid:'AbCd1234',
 count:records.length,duplicate:false,messages:records.length};}

test('Worker consumes sorted NDJSON and commits LOC writes in bounded batches',async()=>{
 const calls=[];
 const frames=[start(),conv,msg('m1',1),msg('m2',2),msg('m3',3),end,finish];
 const result=await consumeSortedImportStream(response(frames),{
  writeConversation:async args=>{calls.push(args);return receipt(args.scopeid,args.records);}
 });
 assert.deepEqual(result,{accepted:true,upload_id:upload,conversations:1,records:3,
  appended:3,duplicate_batches:0,batches:1});
 assert.deepEqual(calls[0].records.map(x=>x.message_id),['m1','m2','m3']);
});
test('Worker dynamically splits by message characters before API record cap',async()=>{
 const calls=[],frames=[start(3),conv,msg('m1',1),msg('m2',2),msg('m3',3),end,finish];
 const result=await consumeSortedImportStream(response(frames),{
  writeConversation:async args=>{calls.push(args);return receipt(args.scopeid,args.records);}
 });
 assert.equal(result.records,3);assert.equal(calls.length,1);
});
test('Worker rejects malformed order and incomplete final receipt',async()=>{
 await assert.rejects(consumeSortedImportStream(response([
  start(),conv,msg('m2',2),msg('m1',1),msg('m3',3),end,finish
 ]),{writeConversation:async args=>receipt(args.scopeid,args.records)}),
 /unordered message/);
 await assert.rejects(consumeSortedImportStream(response([start(),conv,msg('m1',1)]),
  {writeConversation:async args=>receipt(args.scopeid,args.records)}),
 /final acknowledgement/);
});
test('Worker stops on Container error frame and never acknowledges partial import',async()=>{
 await assert.rejects(consumeSortedImportStream(response([
  start(1),{type:'error',code:'invalid_stream',message:'Invalid stream'}
 ]),{writeConversation:async()=>{throw Error('must not write');}}),
 /Invalid stream/);
});
test('Worker verifies LOC receipts before accepting a streamed batch',async()=>{
 await assert.rejects(consumeSortedImportStream(response([
  start(1),conv,msg('m1',1),{type:'conversation_end',record_count:1},
  {type:'finish',upload_id:upload,conversation_count:1,record_count:1}
 ]),{writeConversation:async()=>({accepted:true,scopeid:'wrong',uid:'x',count:1,
  duplicate:false,messages:1})}),/complete conversation batch/);
});
