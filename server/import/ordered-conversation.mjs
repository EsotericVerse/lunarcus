// LAS owns ordered imports for the connector. Message IDs and source ordinals
// remain the idempotency keys so a retried Queue/Workflow cannot duplicate
// turns or silently rewrite a conversation.
const PREFIX='[[LOC-OrderedConversation:v1]]\n';
const END='\n[[/LOC-OrderedConversation]]\n';
const MAX_MESSAGES=10000;
const MAX_MESSAGE_CHARS=140000;
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{httpStatus:status});};
const safeId=id=>typeof id==='string'&&id.length>0&&id.length<=256&&
 !/[\u0000-\u001f\u007f]/.test(id);

function plainMessage(row){
 if(!row||typeof row!=='object'||Array.isArray(row)||
    !safeId(row.message_id)||!['user','assistant'].includes(row.role)||
    typeof row.text!=='string'||!row.text.trim()||row.text.length>MAX_MESSAGE_CHARS||
    !Number.isSafeInteger(row.source_order)||row.source_order<0||
    row.parent_id!=null&&!safeId(row.parent_id))
  fail('Original message id, role and source ordinal are required');
 return {message_id:row.message_id,role:row.role,source_order:row.source_order,
  parent_id:row.parent_id||null,text:row.text};
}

export function orderedBatch(records){
 if(!Array.isArray(records)||!records.length)fail('Ordered conversation batch requires messages');
 const ids=new Set(),orders=new Set();
 return records.map(raw=>{
  const row=plainMessage(raw);
  if(ids.has(row.message_id)||orders.has(row.source_order))
   fail('Duplicate message ID or source ordinal in one batch',409);
  ids.add(row.message_id);orders.add(row.source_order);
  return row;
 });
}

export function readOrdered(content){
 if(typeof content!=='string'||!content.startsWith(PREFIX))return null;
 const at=content.indexOf(END,PREFIX.length);
 if(at<0)fail('Invalid ordered conversation envelope',409);
 let source;
 try{source=JSON.parse(content.slice(PREFIX.length,at));}
 catch{fail('Invalid ordered conversation JSON',409);}
 if(!source||source.version!==1||!Array.isArray(source.messages)||
    !source.messages.length||source.messages.length>MAX_MESSAGES)
  fail('Invalid ordered conversation state',409);
 const messages=source.messages.map(plainMessage);
 const ids=new Set(messages.map(x=>x.message_id));
 const orders=new Set(messages.map(x=>x.source_order));
 if(ids.size!==messages.length||orders.size!==messages.length)
  fail('Stored conversation order conflicts',409);
 return messages;
}

export function mergeOrdered(previous,incoming){
 const existing=previous==null?[]:readOrdered(previous);
 if(previous!=null&&!existing)
  fail('Legacy conversation format cannot be rewritten as ordered data',409);
 const byId=new Map(existing.map(row=>[row.message_id,row]));
 const byOrder=new Map(existing.map(row=>[row.source_order,row.message_id]));
 let added=0;
 for(const row of orderedBatch(incoming)){
  const prior=byId.get(row.message_id);
  if(prior){
   if(prior.source_order!==row.source_order||prior.role!==row.role||
      prior.parent_id!==row.parent_id)
    fail('Existing message ID has conflicting source position',409);
   continue;
  }
  if(byOrder.has(row.source_order))fail('Original turn ordinal belongs to another message',409);
  byId.set(row.message_id,row);byOrder.set(row.source_order,row.message_id);added++;
 }
 if(byId.size>MAX_MESSAGES)fail('Conversation exceeds message bound',413);
 const messages=[...byId.values()].sort((a,b)=>a.source_order-b.source_order);
 const content=PREFIX+JSON.stringify({version:1,messages})+END+'\n'+
  messages.map(row=>'### '+(row.source_order+1)+'. '+
   (row.role==='user'?'使用者':'AI 回覆')+'  #'+row.message_id+'\n\n'+row.text).join('\n\n');
 return {content,added,count:messages.length};
}
