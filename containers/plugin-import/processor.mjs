export const LIMITS=Object.freeze({
  maxUploadBytes:128*1024*1024,
  maxLineBytes:750000,
  maxConversations:5000,
  maxRecords:50000,
  maxConversationRecords:10000,
  maxConversationChars:8000000,
  maxMessageChars:140000
});
const SCOPE=/^[a-z][a-z0-9]{0,14}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOSTS=new Set(['chatgpt.com','chat.openai.com','claude.ai','gemini.google.com']);
function invalid(code,message){return Object.assign(new Error(message),{code,httpStatus:400});}
export function validateStart(frame){
 if(frame?.type!=='start'||frame.version!==1||!UUID.test(String(frame.upload_id||''))||
    !Number.isSafeInteger(frame.conversation_count)||frame.conversation_count<1||
    frame.conversation_count>LIMITS.maxConversations||
    !Number.isSafeInteger(frame.record_count)||frame.record_count<1||
    frame.record_count>LIMITS.maxRecords)
  throw invalid('invalid_header','Invalid stream header');
 return {upload_id:frame.upload_id,conversation_count:frame.conversation_count,
  record_count:frame.record_count};
}
export function validateConversation(frame){
 const scopeid=String(frame?.scopeid||'');
 let url;
 try{url=new URL(String(frame?.source_key||''));}catch{}
 if(frame?.type!=='conversation'||!SCOPE.test(scopeid)||!url||
    url.protocol!=='https:'||!HOSTS.has(url.hostname)||url.username||url.password||
    typeof frame.title!=='string'||frame.title.length>350)
  throw invalid('invalid_conversation','Invalid conversation metadata');
 return {scopeid,source_key:url.href,title:frame.title||'對話'};
}
export function validateMessage(frame){
 const id=String(frame?.message_id||''),parent=frame?.parent_id??null;
 if(frame?.type!=='message'||!id||id.length>256||
    /[\u0000-\u001f\u007f]/.test(id)||
    !Number.isSafeInteger(frame.source_order)||frame.source_order<0||
    frame.source_order>1000000||
    !['user','assistant'].includes(frame.role)||
    typeof frame.text!=='string'||!frame.text.trim()||
    frame.text.length>LIMITS.maxMessageChars||
    parent!==null&&(typeof parent!=='string'||parent.length>256||
      /[\u0000-\u001f\u007f]/.test(parent)))
  throw invalid('invalid_message','Invalid conversation message');
 return {message_id:id,source_order:frame.source_order,
  parent_id:parent,role:frame.role,text:frame.text};
}
export function normalizeConversation(header,records){
 if(!Array.isArray(records)||!records.length||
    records.length>LIMITS.maxConversationRecords)
  throw invalid('invalid_conversation_size','Invalid conversation size');
 let characters=0;
 const ids=new Set(),orders=new Set();
 for(const row of records){
  if(!row||typeof row.message_id!=='string'||
     !Number.isSafeInteger(row.source_order)||row.source_order<0||
     !['user','assistant'].includes(row.role)||
     typeof row.text!=='string'||!row.text.trim())
   throw invalid('invalid_message','Invalid conversation message');
  if(ids.has(row.message_id)||orders.has(row.source_order))
   throw invalid('duplicate_message','Duplicate message ID or source order');
  ids.add(row.message_id);orders.add(row.source_order);
  characters+=row.text.length;
  if(characters>LIMITS.maxConversationChars)
   throw Object.assign(new Error('Conversation exceeds processing limit'),
    {code:'conversation_too_large',httpStatus:413});
 }
 const sorted=[...records].sort((a,b)=>a.source_order-b.source_order);
 const positions=new Map(sorted.map(row=>[row.message_id,row.source_order]));
 for(const row of sorted){
  if(row.parent_id&&positions.has(row.parent_id)&&
     positions.get(row.parent_id)>=row.source_order)
   throw invalid('invalid_parent_order','Parent message must precede its child');
 }
 return {...header,records:sorted,characters};
}
