import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedJson,readBoundedText,BodyTooLargeError}
  from '../server/mcp/stream-json.mjs';

const enc=new TextEncoder();
function body(...parts){
  return new ReadableStream({
    start(controller){
      for(const part of parts)controller.enqueue(
        typeof part==='string'?enc.encode(part):part);
      controller.close();
    }
  });
}

test('LAS parses native streamed JSON without third-party parser',async()=>{
  const result=await readBoundedJson(body('{"records":[{"text":"',
    enc.encode('月'),enc.encode('亮'),'"}],"count":1}'),700000);
  assert.deepEqual(result,{records:[{text:'月亮'}],count:1});
});
test('LAS preserves UTF-8 split across chunks',async()=>{
  const emoji=enc.encode('🎐');
  const result=await readBoundedJson(body(
    enc.encode('{"x":"'),emoji.slice(0,1),emoji.slice(1,3),
    emoji.slice(3),enc.encode('"}')),100);
  assert.equal(result.x,'🎐');
});
test('LAS accepts exact byte limit and rejects one byte beyond it',async()=>{
  assert.deepEqual(await readBoundedJson(body('{"a":1}'),7),{a:1});
  await assert.rejects(readBoundedJson(body('{"a":1}'),6),
    error=>error instanceof BodyTooLargeError&&error.httpStatus===413);
});
test('LAS refuses invalid, duplicate-root and empty JSON',async()=>{
  for(const value of ['',' ','{} {}','{"oops":','[1,]']){
    await assert.rejects(readBoundedJson(body(value),100),SyntaxError);
  }
});
test('LAS refuses malformed UTF-8 rather than corrupting a conversation',async()=>{
  await assert.rejects(readBoundedJson(body(enc.encode('"'),
    new Uint8Array([0xff]),enc.encode('"')),100),TypeError);
});
test('LAS keeps bounded SSE decoding independent from JSON parsing',async()=>{
  const text=await readBoundedText(body('event: update\n','data: hello\n\n'),100);
  assert.equal(text,'event: update\ndata: hello\n\n');
  await assert.rejects(readBoundedText(body('event: update'),3),
    BodyTooLargeError);
});
