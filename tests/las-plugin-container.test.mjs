import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStart,validateConversation,validateMessage,normalizeConversation,LIMITS}
 from '../containers/plugin-import/processor.mjs';

const upload='d7c2a7b8-3e8f-4b7d-9a61-72e5d3b6a1c4';
const conversation={type:'conversation',scopeid:'lo3rwang',
 source_key:'https://chatgpt.com/c/12345678-1234-4234-8234-123456789abc',
 title:'LAS stream test'};
const msg=(message_id,source_order)=>({type:'message',message_id,source_order,
 parent_id:null,role:source_order%2?'assistant':'user',text:'訊息 '+source_order});
test('Container validates the stream header and trusted conversation source',()=>{
 assert.equal(validateStart({type:'start',version:1,upload_id:upload,
  conversation_count:1,record_count:3}).record_count,3);
 assert.equal(validateConversation(conversation).source_key,conversation.source_key);
});
test('Container sorts message records by source ordinal independent of Queue order',()=>{
 const rows=[msg('m3',3),msg('m1',1),msg('m2',2)].map(validateMessage);
 const result=normalizeConversation(validateConversation(conversation),rows);
 assert.deepEqual(result.records.map(x=>x.message_id),['m1','m2','m3']);
});
test('Container rejects duplicate message IDs and duplicate source ordinals',()=>{
 const duplicateId=[msg('m1',1),msg('m1',2)].map(validateMessage);
 assert.throws(()=>normalizeConversation(validateConversation(conversation),duplicateId),
  /Duplicate message ID/);
 const duplicateOrder=[msg('m1',1),msg('m2',1)].map(validateMessage);
 assert.throws(()=>normalizeConversation(validateConversation(conversation),duplicateOrder),
  /Duplicate message ID/);
});
test('Container rejects untrusted sources, malformed roles and future parents',()=>{
 assert.throws(()=>validateConversation({...conversation,source_key:'https://example.com/chat'}));
 assert.throws(()=>validateMessage({...msg('x',1),role:'system'}));
 const rows=[{...msg('child',1),parent_id:'parent'},
  {...msg('parent',2),role:'assistant'}].map(validateMessage);
 assert.throws(()=>normalizeConversation(validateConversation(conversation),rows),
  /Parent message must precede/);
});
test('Container enforces per-message and per-conversation limits',()=>{
 assert.throws(()=>validateMessage({...msg('x',1),text:'x'.repeat(LIMITS.maxMessageChars+1)}));
 const rows=[msg('m1',1),msg('m2',2)].map(validateMessage);
 assert.throws(()=>normalizeConversation(validateConversation(conversation),rows.concat(rows[0])),
  /Duplicate message ID/);
});
