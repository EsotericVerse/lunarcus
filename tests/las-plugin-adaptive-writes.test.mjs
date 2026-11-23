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
test('long conversation review is cursor-bounded and DOM paginated',()=>{
 const options=readFileSync(new URL('../plugins/chrome/options.js',import.meta.url),'utf8');
 assert.match(code,/const MAX_REVIEW_ROWS=10000/);
 assert.match(code,/for\(let offset=0;offset<group\.messages\.length;offset\+=QUEUE_HYDRATE_ROWS\)/);
 assert.match(options,/group\.messages\.slice\(visible,visible\+100\)/);
 assert.doesNotMatch(code,/pendingCount>MAX_QUEUE_BODY_SCAN/);
});
