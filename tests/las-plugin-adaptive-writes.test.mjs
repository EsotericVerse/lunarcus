import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const code=readFileSync(new URL('../plugins/chrome/background.js',import.meta.url),'utf8');
const begin=code.indexOf('async function writeAdaptiveQueueBatches(');
const end=code.indexOf('\nfunction encode64(bytes){',begin);
assert.ok(begin>0&&end>begin,'Adaptive LAS Queue writer is defined');
const encoder=new TextEncoder();
const sandbox={
  WRITE_TARGET_BYTES:480000,SHORT_WRITE_MAX_BYTES:601024,
  ORDERED_WRITE_MAX_BYTES:700000,SHORT_WRITE_MAX_ROWS:50,
  ORDERED_WRITE_MAX_ROWS:100,QUEUE_HYDRATE_ROWS:8,
  sizeOf:row=>encoder.encode(JSON.stringify(row)).byteLength,
  Error,Math,Array,Number
};
const adaptive=vm.runInNewContext('('+code.slice(begin,end)+')',sandbox);

function fixture(count,textBytes){
  return Array.from({length:count},(_,id)=>({
    id:String(id).padStart(8,'0'),content:'x'.repeat(textBytes)
  }));
}
function config(rows,maxRows=50,maxBytes=601024){
  const map=new Map(rows.map(r=>[r.id,r]));
  const fetched=[],writes=[];
  return {
    calls:fetched,sent:writes,
    options:{
      maxRows,maxBytes,
      hydrate:async ids=>{
        fetched.push(ids.length);
        return ids.map(id=>map.get(id));
      },
      project:row=>({id:row.id,content:row.content}),
      send:async (batch,records)=>{
        assert.equal(batch.length,records.length);
        assert.ok(batch.length<=maxRows);
        assert.ok(encoder.encode(JSON.stringify(records)).byteLength+512<=maxBytes);
        writes.push(batch.map(x=>x.id));
      }
    }
  };
}
test('LAS writes long Queues in bounded adaptive batches, without a 256-row stop',async()=>{
  const rows=fixture(720,64);
  const state=config(rows);
  const result=await adaptive(rows,state.options);
  assert.equal(result.completed,720);
  assert.ok(state.sent.some(part=>part.length>8),'batch count must adapt upward');
  assert.ok(state.sent.every(part=>part.length<=50));
  assert.ok(state.calls.every(n=>n<=8),'IDB hydrate must stay bounded');
  assert.deepEqual(state.sent.flat(),rows.map(x=>x.id));
  assert.doesNotMatch(code.slice(code.indexOf('async function flush(force=false)'),code.indexOf('function sourceOrderFailureLabel(')),/pendingCount>MAX_QUEUE_BODY_SCAN/);
});

test('LAS shrinks count for large text based on measured UTF-8 bytes',async()=>{
  const rows=fixture(29,85000);
  const state=config(rows);
  const result=await adaptive(rows,state.options);
  assert.equal(result.completed,29);
  assert.ok(state.sent.length>1);
  assert.ok(state.sent.every(part=>part.length<=5));
  assert.deepEqual(state.sent.flat(),rows.map(x=>x.id));
});

test('LAS has separate strict native API record ceilings',async()=>{
  for(const [maxRows,maxBytes] of [[50,601024],[100,700000]]){
    const rows=fixture(241,250);
    const state=config(rows,maxRows,maxBytes);
    const result=await adaptive(rows,state.options);
    assert.equal(result.completed,241);
    assert.ok(state.sent.every(part=>part.length<=maxRows));
  }
});

test('LAS keeps unsent Queue rows if the current batch fails',async()=>{
  const rows=fixture(78,100);
  const state=config(rows);
  let sent=0;
  state.options.send=async(batch)=>{
    sent++;
    if(sent===2)throw Error('LOC unavailable');
    state.sent.push(batch.map(x=>x.id));
  };
  await assert.rejects(adaptive(rows,state.options),/LOC unavailable/);
  assert.equal(sent,2);
  assert.ok(state.sent.flat().length<rows.length);
});

test('LAS fails closed for an individual oversized row',async()=>{
  const rows=fixture(1,601024);
  const state=config(rows);
  await assert.rejects(adaptive(rows,state.options),/單筆資料超過 LOC 寫入上限/);
  assert.equal(state.sent.length,0);
});

test('long conversation approvals and previews do not materialize every full turn',()=>{
  const opts=readFileSync(new URL('../plugins/chrome/options.js',import.meta.url),'utf8');
  assert.match(code,/const MAX_REVIEW_ROWS=10000/);
  assert.match(code,/for\(let offset=0;offset<group\.messages\.length;offset\+=QUEUE_HYDRATE_ROWS\)/);
  assert.match(opts,/group\.messages\.slice\(visible,visible\+100\)/);
  assert.match(opts,/details\.addEventListener\('toggle'/);
  assert.doesNotMatch(code,/pendingCount>MAX_QUEUE_BODY_SCAN/);
});

test('adaptive accounting measures actual UTF-8 not UTF-16 text length',async()=>{
  const rows=Array.from({length:22},(_,i)=>({
    id:String(i).padStart(8,'0'),content:'月'.repeat(35000)
  }));
  const state=config(rows);
  await adaptive(rows,state.options);
  assert.ok(state.sent.length>=5,'multi-byte text must reduce batch density');
  assert.ok(state.sent.every(x=>x.length<=4));
});
