// LAS native bounded WHATWG stream readers. No JSON parser dependency.
// MCP messages are capped at 700 KB by the caller before JSON.parse.
export class BodyTooLargeError extends Error {
  constructor(limit){
    super('Payload exceeds '+limit+' bytes');
    this.name='BodyTooLargeError';
    this.httpStatus=413;
  }
}
async function consume(body,limit,accept){
  if(!body?.getReader)throw new SyntaxError('Empty response body');
  if(!Number.isSafeInteger(limit)||limit<0)throw new TypeError('Invalid body limit');
  const reader=body.getReader();
  let size=0,finished=false;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done){finished=true;break;}
      if(!(value instanceof Uint8Array))
        throw new SyntaxError('Expected a UTF-8 byte stream');
      size+=value.byteLength;
      if(size>limit)throw new BodyTooLargeError(limit);
      accept(value);
    }
  }finally{
    if(!finished)await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
}
export async function readBoundedJson(body,limit){
  // TextDecoder handles multi-byte UTF-8 split across stream chunks.
  // Reject malformed UTF-8 instead of silently mutating signed/JSON content.
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let text='';
  await consume(body,limit,chunk=>{text+=decoder.decode(chunk,{stream:true});});
  text+=decoder.decode();
  if(!text.trim())throw new SyntaxError('Invalid or empty JSON');
  // Rejects trailing JSON roots and malformed input exactly once.
  return JSON.parse(text);
}
// SSE framing is text, not JSON; cap bytes before decoding event data.
export async function readBoundedText(body,limit){
  const decoder=new TextDecoder();
  let text='';
  await consume(body,limit,chunk=>{text+=decoder.decode(chunk,{stream:true});});
  return text+decoder.decode();
}
