import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRows,previewReadable} from './reconcile-mcp-conversations.mjs';
const id='6af8ff99-6b54-83ee-8ee5-06f99616d940';
const url='https://chatgpt.com/c/'+id;
const header=(id,url,role,text)=>`[[LOC-Append-Event:${id}:a${'b'.repeat(63)}]]
[來源：${url}；段落 1/1]
[${role}]
${text}
`;
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const exported={
  id,current_node:'assistant-2',mapping:{
    'user-1':{parent:null,message:{id:'user-1',author:{role:'user'},content:{parts:['first question']}}},
    'assistant-1':{parent:'user-1',message:{id:'assistant-1',author:{role:'assistant'},content:{parts:['first answer']}}},
    'user-2':{parent:'assistant-1',message:{id:'user-2',author:{role:'user'},content:{parts:['second question']}}},
    'assistant-2':{parent:'user-2',message:{id:'assistant-2',author:{role:'assistant'},content:{parts:['second answer']}}}
  }
};
const row={site:'mcp',uid:'Abc12345',url,title:'conversation',
  content:header(uuid(4),url,'assistant','second answer')+
    '\n'+header(uuid(2),url,'assistant','first answer')+
    '\n'+header(uuid(3),url,'user','second question')+
    '\n'+header(uuid(1),url,'user','first question')};
test('reconstructs event order only from original parent-linked message graph',()=>{
 const [result]=analyzeRows([row],[exported]);
 assert.equal(result.status,'verified-order-preview');
 assert.equal(result.matched,4);
 assert.deepEqual(result.ordered_event_ids,[uuid(1),uuid(2),uuid(3),uuid(4)]);
 assert.equal(result.original_message_count,4);
});
test('original conversation missing: no guess from append sequence or event IDs',()=>{
 const [result]=analyzeRows([row],[]);
 assert.equal(result.status,'not-reconstructed');
 assert.equal(result.reason,'original-conversation-export-not-provided');
 assert.deepEqual(result.ordered_event_ids,undefined);
});
test('duplicate text creates ambiguity; parent graph is mandatory',()=>{
 const duplicate={...exported,mapping:{...exported.mapping,
   'assistant-1':{...exported.mapping['assistant-1'],
     message:{...exported.mapping['assistant-1'].message,content:{parts:['second answer']}}}}};
 assert.equal(analyzeRows([row],[duplicate])[0].status,'not-reconstructed');
 const missingParent={...exported,current_node:null};
 assert.equal(analyzeRows([row],[missingParent])[0].reason,'missing-parent-graph');
});
test('PR metadata stays outside conversation reconstruction',()=>{
 const [pr]=analyzeRows([{site:'mcp',uid:'Xyz12345',title:'PR #1777',content:'hello'}],[exported]);
 assert.equal(pr.source_type,'github-pr');
 assert.equal(pr.reason,'not-a-conversation');
});
test('generic conversation requires explicit ordinal sequence rather than captured_at',()=>{
 const generic={id,messages:[
  {id:'2',sequence:1,role:'assistant',text:'answer'},
  {id:'1',sequence:0,role:'user',text:'question'}
 ]};
 const single={site:'mcp',uid:'Abc12345',title:'chat',url,
  content:header(uuid(2),url,'assistant','answer')+'\n'+header(uuid(1),url,'user','question')};
 assert.deepEqual(analyzeRows([single],[generic])[0].ordered_event_ids,[uuid(1),uuid(2)]);
 const withoutSeq={...generic,messages:generic.messages.map(({sequence,...rest})=>rest)};
 assert.equal(analyzeRows([single],[withoutSeq])[0].reason,'no-unique-original-sequence');
});

test('readable preview restores conversational order without user reassembly',()=>{
 const {report,readableRows}=previewReadable([row],[exported]);
 assert.equal(report[0].status,'verified-order-preview');
 assert.equal(report[0].complete_capture,true);
 assert.equal(readableRows.length,1);
 const rendered=readableRows[0].markdown;
 const position=['first question','first answer','second question','second answer']
   .map(token=>rendered.indexOf(token));
 assert.ok(position.every(p=>p>=0));
 assert.deepEqual([...position].sort((a,b)=>a-b),position);
 assert.match(rendered,/順序依據：原始對話訊息父子關係／明確訊息序號/);
 assert.equal(readableRows[0].capture_complete,true);
});
test('source-only replies are included and marked as restored, never falsely attributed to Extension',()=>{
 const partial={...row,content:header(uuid(1),url,'user','first question')};
 const {report,readableRows}=previewReadable([partial],[exported]);
 assert.equal(report[0].source_messages_missing_from_capture,3);
 assert.equal(report[0].complete_capture,false);
 assert.equal(readableRows.length,1);
 assert.match(readableRows[0].markdown,/來源：原始匯出補回（Extension 未擷取）/);
 assert.match(readableRows[0].markdown,/second answer/);
 assert.equal(readableRows[0].capture_complete,false);
});
test('same UUID under a different platform cannot be matched by source ID alone',()=>{
 const claude='https://claude.ai/chat/'+id;
 const malicious={...row,url:claude,
  content:header(uuid(1),claude,'user','first question')};
 assert.equal(analyzeRows([malicious],[exported])[0].reason,
  'original-conversation-export-not-provided');
});
test('ambiguous duplicated source exports block reconstruction',()=>{
 const r=analyzeRows([row],[exported,structuredClone(exported)])[0];
 assert.equal(r.reason,'multiple-original-conversation-exports');
 assert.equal(r.status,'not-reconstructed');
});
test('never emit readable reconstructed content when the event match is unverified',()=>{
 const bad={...row,content:header(uuid(1),url,'user','something else')};
 const result=previewReadable([bad],[exported]);
 assert.equal(result.readableRows.length,0);
 assert.equal(result.report[0].status,'not-reconstructed');
});
