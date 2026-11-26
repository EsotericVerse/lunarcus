const encoder=new TextEncoder();
const LIMITS=Object.freeze({
 maxLineBytes:750000,maxConversations:5000,maxRecords:50000,
 maxBatchRecords:100,targetChars:240000,targetBytes:480000,maxBatchBytes:600000
});
function invalid(code,message,status=502){
 return Object.assign(new Error(message),{code,httpStatus:status});
}
async function* readNdjson(body){
 if(!body?.getReader)throw invalid('empty_container_stream','Container returned no stream');
 const reader=body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
 let buffer='',done=false;
 try{
  for(;;){
   const part=await reader.read();
   if(part.done){done=true;break;}
   buffer+=decoder.decode(part.value,{stream:true});
   let newline;
   while((newline=buffer.indexOf('\\n'))>=0){
    const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);
    if(!line.trim())throw invalid('empty_container_frame','Container emitted an empty frame');
    if(encoder.encode(line).byteLength>LIMITS.maxLineBytes)
     throw invalid('container_frame_too_large','Container frame exceeded limit',413);
    let frame;
    try{frame=JSON.parse(line);}catch{throw invalid('invalid_container_frame','Container emitted invalid NDJSON');}
    yield frame;
   }
   if(encoder.encode(buffer).byteLength>LIMITS.maxLineBytes)
    throw invalid('container_frame_too_large','Container frame exceeded limit',413);
  }
  buffer+=decoder.decode();
  if(buffer.length){
   if(encoder.encode(buffer).byteLength>LIMITS.maxLineBytes)
    throw invalid('container_frame_too_large','Container frame exceeded limit',413);
   let frame;
   try{frame=JSON.parse(buffer);}catch{throw invalid('invalid_container_frame','Container emitted invalid NDJSON');}
   yield frame;
  }
 }catch(error){
  if(!done)await reader.cancel().catch(()=>{});
  throw error;
 }finally{reader.releaseLock();}
}
function validateStart(frame){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(frame?.type!=='start'||frame.version!==1||!uuid.test(String(frame.upload_id||''))||
    !Number.isSafeInteger(frame.conversation_count)||frame.conversation_count<1||
    frame.conversation_count>LIMITS.maxConversations||
    !Number.isSafeInteger(frame.record_count)||frame.record_count<1||
    frame.record_count>LIMITS.maxRecords)
  throw invalid('invalid_container_header','Container stream header is invalid');
 return frame;
}
function validateConversation(frame){
 const scopeid=String(frame?.scopeid||'');let source;
 try{source=new URL(String(frame?.source_key||''));}catch{}
 if(frame?.type!=='conversation'||!(/^[a-z][a-z0-9]{0,14}$/).test(scopeid)||
    !source||source.protocol!=='https:'||
    !['chatgpt.com','chat.openai.com','claude.ai','gemini.google.com'].includes(source.hostname)||
    typeof frame.title!=='string'||frame.title.length>350)
  throw invalid('invalid_container_conversation','Container conversation metadata is invalid');
 return {scopeid,source_key:source.href,title:frame.title};
}
function validateRecord(frame,previousOrder){
 const id=String(frame?.message_id||''),parent=frame?.parent_id??null;
 if(frame?.type!=='message'||!id||id.length>256||
    !Number.isSafeInteger(frame.source_order)||frame.source_order<0||
    frame.source_order<=previousOrder||
    !['user','assistant'].includes(frame.role)||
    typeof frame.text!=='string'||!frame.text.trim()||frame.text.length>140000||
    parent!==null&&(typeof parent!=='string'||parent.length>256))
  throw invalid('invalid_container_message','Container emitted invalid or unordered message');
 return {message_id:id,source_order:frame.source_order,parent_id:parent,
  role:frame.role,text:frame.text};
}
function validateReceipt(receipt,scopeid,records){
 if(receipt?.accepted!==true||receipt.scopeid!==scopeid||
    !/^[A-Za-z0-9]{8}$/.test(String(receipt.uid||''))||
    !Number.isSafeInteger(receipt.count)||receipt.count<0||
    receipt.count>records.length||receipt.duplicate!==(receipt.count===0)||
    !Number.isSafeInteger(receipt.messages)||receipt.messages<records.length)
  throw invalid('loc_receipt_invalid','LOC did not confirm the complete conversation batch');
 return receipt;
}
export async function consumeSortedImportStream(response,{writeConversation}={}){
 if(!response?.ok)throw invalid('container_http_error','Container processing failed',response?.status||502);
 if(typeof writeConversation!=='function')throw new TypeError('writeConversation callback required');
 let start=null,active=null,finished=false,totalRecords=0,totalConversations=0;
 let appended=0,duplicateBatches=0,batches=0;
 let batch=[],batchBytes=0,batchChars=0,lastOrder=-1,conversationRecords=0;
 const flush=async()=>{
  if(!batch.length)return;
  const records=batch,context=active;
  const receipt=validateReceipt(await writeConversation({
   scopeid:context.scopeid,conversation_id:context.source_key,
   updated_at:new Date().toISOString(),title:context.title,records
  }),context.scopeid,records);
  appended+=receipt.count;
  if(receipt.duplicate)duplicateBatches++;
  batches++;batch=[];batchBytes=0;batchChars=0;
 };
 for await(const frame of readNdjson(response.body)){
  if(finished)throw invalid('container_trailing_frame','Container sent data after final frame');
  if(!start){
   start=validateStart(frame);
   continue;
  }
  if(frame?.type==='error')
   throw invalid(String(frame.code||'container_processing_error'),
    String(frame.message||'Container processing failed'),Number(frame.status)||422);
  if(frame?.type==='conversation'){
   if(active)throw invalid('container_nested_conversation','Container opened a nested conversation');
   active=validateConversation(frame);batch=[];batchBytes=0;batchChars=0;
   lastOrder=-1;conversationRecords=0;
   continue;
  }
  if(frame?.type==='message'){
   if(!active)throw invalid('container_message_without_conversation','Message arrived outside a conversation');
   const record=validateRecord(frame,lastOrder);
   lastOrder=record.source_order;conversationRecords++;totalRecords++;
   if(totalRecords>start.record_count)throw invalid('container_record_overflow','Container emitted too many records');
   const bytes=encoder.encode(JSON.stringify(record)).byteLength+1;
   const chars=record.text.length;
   if(bytes+4096>LIMITS.maxBatchBytes)
    throw invalid('record_exceeds_loc_batch','One message exceeds the LOC write limit',413);
   if(batch.length&&(batch.length>=LIMITS.maxBatchRecords||
      batchChars+chars>LIMITS.targetChars||
      batchBytes+bytes>LIMITS.targetBytes||
      batchBytes+bytes+4096>LIMITS.maxBatchBytes))
    await flush();
   batch.push(record);batchBytes+=bytes;batchChars+=chars;
   continue;
  }
  if(frame?.type==='conversation_end'){
   if(!active||!conversationRecords||frame.record_count!==conversationRecords)
    throw invalid('container_conversation_count_mismatch','Container conversation count mismatch');
   await flush();active=null;totalConversations++;
   continue;
  }
  if(frame?.type==='finish'){
   if(active||!start||frame.upload_id!==start.upload_id||
      frame.record_count!==totalRecords||frame.conversation_count!==totalConversations||
      totalRecords!==start.record_count||totalConversations!==start.conversation_count)
    throw invalid('container_final_count_mismatch','Container final stream counts do not match');
   finished=true;
   continue;
  }
  throw invalid('container_unknown_frame','Container emitted an unknown frame');
 }
 if(!start||!finished)throw invalid('container_incomplete_stream','Container stream ended without final acknowledgement');
 return {accepted:true,upload_id:start.upload_id,conversations:totalConversations,
  records:totalRecords,appended,duplicate_batches:duplicateBatches,batches};
}
