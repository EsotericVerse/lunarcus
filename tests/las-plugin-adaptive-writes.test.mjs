import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const code=readFileSync(new URL('../plugins/chrome/background.js',import.meta.url),'utf8');
const first=code.indexOf('async function writeAdaptiveQueueBatches(');
const last=code.indexOf('\nfunction encode64(bytes){',first);
assert.ok(first>0&&last>first);
const encoder=new TextEncoder();
const adaptive=vm.runInNewContext('('+code.slice(first,last)+')',{
 WRITE_TARGET_CHARS:240000,WRITE_TARGET_BYTES:480000,QUEUE_HYDRATE_ROWS:8,
 sizeOf:r=>encoder.encode(JSON.stringify(r)).length,Error,Array,Number
});
const rows=(count,text)=>Array.from({length:count},(_,i)=>({
 id:String(i).padStart(8,'0'),content:text
}));
const setup=(items,maxBytes=601024)=>{
 const values=new Map(items.map(r=>[r.id,r])),calls=[],sent=[];
 return {calls,sent,options:{
  maxBytes,hydrate:async ids=>{
   calls.push(ids.length);
   return ids.map(id=>values.get(id));
  },
  project:r=>({id:r.id,content:r.content}),
  send:async(batch,records)=>{
   assert.ok(encoder.encode(JSON.stringify(records)).length+512<=maxBytes);
   sent.push(batch.map(r=>r.id));
  }
 }};
};
test('LAS writes hundreds of short turns in one character-sized batch',async()=>{
 const input=rows(720,'a'.repeat(40)),state=setup(input);
 const receipt=await adaptive(input,state.options);
 assert.equal(receipt.completed,720);
 assert.equal(state.sent.length,1);
 assert.equal(state.sent[0].length,720);
 assert.ok(state.calls.every(count=>count<=8));
 assert.deepEqual(state.sent.flat(),input.map(x=>x.id));
 assert.equal(code.includes('SHORT_WRITE_MAX_ROWS'),false);
 assert.equal(code.includes('ORDERED_WRITE_MAX_ROWS'),false);
 assert.equal(code.includes('records.length>100'),false);
});
test('summed text lengths split large conversation naturally',async()=>{
 const input=rows(20,'a'.repeat(85000)),state=setup(input);
 const receipt=await adaptive(input,state.options);
 assert.equal(receipt.completed,20);
 assert.ok(state.sent.length>=10);
 assert.ok(state.sent.every(part=>part.length<=2));
});
test('UTF-8 transport bytes protect Chinese and emoji even when character count fits',async()=>{
 const input=rows(20,'月'.repeat(85000)),state=setup(input);
 await adaptive(input,state.options);
 assert.ok(state.sent.every(part=>part.length===1));
 assert.equal(state.sent.length,20);
});
test('no deletion or acknowledgment if delivery fails',async()=>{
 const input=rows(200,'a'.repeat(1800)),state=setup(input);
 let attempts=0;
 state.options.send=async batch=>{
  attempts++;
  if(attempts===2)throw Error('LOC unavailable');
  state.sent.push(batch.map(x=>x.id));
 };
 await assert.rejects(adaptive(input,state.options),/LOC unavailable/);
 assert.equal(attempts,2);
 assert.ok(state.sent.flat().length<input.length);
});
test('single oversized row fails before attempting a write',async()=>{
 const input=rows(1,'a'.repeat(601024)),state=setup(input);
 await assert.rejects(adaptive(input,state.options),/單筆資料超過 LOC 寫入上限/);
 assert.equal(state.sent.length,0);
});
test('conversation preview stays bounded and no longer gates Queue delivery',()=>{
 const options=readFileSync(new URL('../plugins/chrome/options.js',import.meta.url),'utf8');
 assert.ok(code.includes('const MAX_REVIEW_ROWS=10000'));
 assert.ok(code.includes('const metadata=group.rows.slice(offset,offset+QUEUE_HYDRATE_ROWS)'));
 assert.ok(options.includes('group.messages.slice(visible,visible+100)'));
 assert.ok(code.includes('trustedSourceOrder(row)&&!blocked.has'));
 assert.ok(!code.includes('row.reviewed!==true||!trustedSourceOrder'));
 assert.ok(!code.includes('async function sendOrderedConversation('));
});

test('ordered conversations stream Queue records to LAS Container without client sorting',async()=>{
 const src=readFileSync(new URL('../plugins/chrome/background.js',import.meta.url),'utf8');
 const start=src.indexOf('function queueConversationGroups(');
 const end=src.indexOf(String.fromCharCode(10)+'async function flush(',start);
 assert.ok(start>0&&end>start);
 const fullRows=new Map();
 const source='https://chatgpt.com/c/12345678-1234-4234-8234-123456789abc';
 const metadata=[
  {id:'q2',kind:'ordered_conversation',scopeid:'lo3rwang',source_key:source,title:'Test',
   order_evidence:'source-ordinal',source_order:2,message_id:'m2',role:'assistant',text:'second'},
  {id:'q1',kind:'ordered_conversation',scopeid:'lo3rwang',source_key:source,title:'Test',
   order_evidence:'source-ordinal',source_order:1,message_id:'m1',role:'user',text:'first'}
 ];
 for(const row of metadata)fullRows.set(row.id,row);
 const ctx={
  QUEUE_HYDRATE_ROWS:8,encoder:new TextEncoder(),
  Map,String,Array,JSON,Date,Error,URL,
  trustedSourceOrder:r=>r.order_evidence==='source-ordinal'||r.order_evidence==='source-conversation-turn',
  loadQueueRows:async ids=>ids.map(id=>fullRows.get(id)),
  contractError:m=>Error(m)
 };
 const api=vm.runInNewContext(src.slice(start,end)+';({queueConversationGroups,queueConversationFrames,sendConversationStream})',ctx);
 const groups=api.queueConversationGroups(metadata),frames=[];
 for await(const frame of api.queueConversationFrames(metadata,'d7c2a7b8-3e8f-4b7d-9a61-72e5d3b6a1c4',groups))
  frames.push(frame);
 assert.equal(frames[0].type,'start');
 assert.equal(frames.at(-1).type,'finish');
 assert.deepEqual(frames.filter(x=>x.type==='message').map(x=>x.source_order),[2,1]);
 const uploadCode=src.slice(start,end);
 assert.ok(uploadCode.includes("duplex:'half'"));
 assert.ok(uploadCode.includes("'content-type':'application/x-ndjson'"));
 assert.ok(uploadCode.includes('https://mcp.lo3rwang.cc/api/plugins/import/stream'));
 assert.ok(!uploadCode.includes('sendOrderedConversation('));
});
test('LAS short import uses canonical slash URL even with cached legacy config',()=>{
 const src=readFileSync(new URL('../plugins/chrome/background.js',import.meta.url),'utf8');
 const config=JSON.parse(readFileSync(new URL('../plugins/chrome/oauth-config.json',import.meta.url),'utf8'));
 assert.equal(config.import_url,'https://loc.lo3rwang.cc/api/loc-native/');
 assert.match(src,/endpoint\.pathname='\/api\/loc-native\/'/);
 assert.match(src,/!\['\/api\/loc-native','\/api\/loc-native\/'\]\.includes\(endpoint\.pathname\)/);
});
test('conversation request body emits all frames when total payload is below 64 KiB',async()=>{
 const start=code.indexOf('function queueConversationGroups(');
 const end=code.indexOf(String.fromCharCode(10)+'async function flush(',start);
 const fullRows=new Map();
 const source='https://chatgpt.com/c/12345678-1234-4234-8234-123456789abc';
 const metadata=[1,2].map(n=>({id:'small-'+n,kind:'ordered_conversation',
  scopeid:'lo3rwang',source_key:source,title:'Small',
  order_evidence:'source-ordinal',source_order:n,message_id:'m'+n,
  parent_id:null,role:n%2?'user':'assistant',text:'preview'}));
 for(const row of metadata)fullRows.set(row.id,{...row,text:'short message '+row.id});
 const ctx={QUEUE_HYDRATE_ROWS:8,encoder:new TextEncoder(),ReadableStream,
  Map,String,Array,JSON,Date,Error,URL,
  trustedSourceOrder:r=>r.order_evidence==='source-ordinal',
  loadQueueRows:async ids=>ids.map(id=>fullRows.get(id)),
  contractError:m=>Error(m)};
 const api=vm.runInNewContext(code.slice(start,end)+
  ';({queueConversationGroups,createQueueConversationBody})',ctx);
 const groups=api.queueConversationGroups(metadata);
 const body=api.createQueueConversationBody(metadata,
  'd7c2a7b8-3e8f-4b7d-9a61-72e5d3b6a1c4',groups);
 const reader=body.getReader(),chunks=[];
 for(;;){const part=await reader.read();if(part.done)break;chunks.push(part.value);}
 const bytes=chunks.reduce((n,x)=>n+x.byteLength,0);
 const raw=Buffer.concat(chunks.map(x=>Buffer.from(x))).toString('utf8');
 const frames=raw.trim().split('\\n').map(JSON.parse);
 assert.ok(bytes>0);
 assert.deepEqual(frames.map(x=>x.type),
  ['start','conversation','message','message','conversation_end','finish']);
 assert.equal(frames.at(-1).type,'finish');
});

test('conversation request body flushes the final partial chunk after a 64 KiB frame',async()=>{
 const start=code.indexOf('function queueConversationGroups(');
 const end=code.indexOf(String.fromCharCode(10)+'async function flush(',start);
 const fullRows=new Map();
 const source='https://chatgpt.com/c/12345678-1234-4234-8234-123456789abc';
 const metadata=[{id:'large-1',kind:'ordered_conversation',
  scopeid:'lo3rwang',source_key:source,title:'Large',
  order_evidence:'source-ordinal',source_order:1,message_id:'m1',
  parent_id:null,role:'user',text:'preview'}];
 fullRows.set('large-1',{...metadata[0],text:'x'.repeat(70000)});
 const ctx={QUEUE_HYDRATE_ROWS:8,encoder:new TextEncoder(),ReadableStream,
  Map,String,Array,JSON,Date,Error,URL,
  trustedSourceOrder:r=>r.order_evidence==='source-ordinal',
  loadQueueRows:async ids=>ids.map(id=>fullRows.get(id)),
  contractError:m=>Error(m)};
 const api=vm.runInNewContext(code.slice(start,end)+
  ';({queueConversationGroups,createQueueConversationBody})',ctx);
 const groups=api.queueConversationGroups(metadata);
 const body=api.createQueueConversationBody(metadata,
  'd7c2a7b8-3e8f-4b7d-9a61-72e5d3b6a1c4',groups);
 const reader=body.getReader(),chunks=[];
 for(;;){const part=await reader.read();if(part.done)break;chunks.push(part.value);}
 const raw=Buffer.concat(chunks.map(x=>Buffer.from(x))).toString('utf8');
 const frames=raw.trim().split('\\n').map(JSON.parse);
 assert.equal(frames.filter(x=>x.type==='message')[0].text.length,70000);
 assert.equal(frames.at(-1).type,'finish');
});

