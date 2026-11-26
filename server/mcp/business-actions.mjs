// LOC MCP business actions: validate and map tool arguments only.
// The single LAS Tunnel transport owns POST, bearer, timeout and errors.
// LOC remains the authority for Scope rights and Galaxy business behavior.
import {callLocOperation,locTransport} from '../tunnel/loc-mapping.mjs';
const SCOPE=/^[a-z][a-z0-9]{0,14}$/;
const PR=/(?:\bPR(?:[\s#:\-]*\d+)?\b|\bpull[ -]?request\b|\bgithub\b|\bcommit\b|合併請求|拉取請求)/i;
function invalid(message){
  return Object.assign(new Error(message),{code:'INVALID_ARGUMENT',httpStatus:400});
}
export async function businessAction(name,args,token,env={},fetchImpl=globalThis.fetch){
  if(typeof token!=='string'||!token)
    throw invalid('LOC OAuth bearer token required');
  const a=args||{};
  const scope=String(a.scopeid||'');
  if(!SCOPE.test(scope))throw invalid('Invalid LOC Scope');
  let payload;
  if(name==='galaxy_link'){
    if(!['check','record','record_ordered'].includes(a.action))
      throw invalid('Unsupported Galaxy Link action');
    if(a.source!==undefined)throw invalid('Galaxy From is derived by LOC from the conversation URL; caller-supplied source is not accepted');
    if(['record','record_ordered'].includes(a.action)&&a.site!==undefined)
      throw invalid('Galaxy From is derived by LOC from the conversation URL; omit site');
    if(typeof a.conversation_id!=='string'||!a.conversation_id||
      typeof a.updated_at!=='string'||!Number.isFinite(Date.parse(a.updated_at)))
      throw invalid('Valid conversation_id and updated_at required');
    if(['record','record_ordered'].includes(a.action)){
      if(PR.test(String(a.title||'')))throw invalid('PR records must use GitHub');
      if(!Array.isArray(a.records)||!a.records.length||a.records.length>100)
        throw invalid('Source records required');
    }
    payload={kind:'mcp-conversation',scopeid:scope,action:a.action,
      conversation_id:a.conversation_id,updated_at:a.updated_at,
      ...(['record','record_ordered'].includes(a.action)?{created_at:a.created_at,
        title:a.title||'',records:a.records}:{}),
    };
  }else{
    throw invalid('Obsolete Auth-owned MCP action is not supported');
  }
  const value=await callLocOperation(payload,token,locTransport(env,fetchImpl));
  return value||{};
}
