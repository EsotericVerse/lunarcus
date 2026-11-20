// LAS / Luna Protocol Data Mapping: fixed public LOC operation envelopes.
// The LOC SaaS owns all Galaxy ZModel, Scope permissions, SQL dialects and
// data semantics. These mappings never construct SQL or DB connections.
const LOC_NATIVE='https://loc.lo3rwang.cc/api/las-native';
const PR=/(?:\bPR(?:[\s#:\-]*\d+)?\b|\bpull[ -]?request\b|\bgithub\b|\bcommit\b|合併請求|拉取請求)/i;
const SCOPE=/^[a-z][a-z0-9]{0,14}$/;
const UID=/^[A-Za-z0-9]{8}$/;
function invalid(message){return Object.assign(new Error(message),{code:'INVALID_ARGUMENT',httpStatus:400});}
function scope(value,defaultValue='lo3rwang'){
  const id=value??defaultValue;
  if(!SCOPE.test(String(id)))throw invalid('Invalid LOC Scope');
  return id;
}
export function mcpDatabaseConfiguration(){
  // The Gateway never receives the LOC business DB credential.
  return {owner:'loc',verification:'delegated-to-loc',
    publicReadConfigured:null,privateReadConfigured:null,privateWriteConfigured:null};
}
export async function callLocOperation(body,token,fetchImpl=globalThis.fetch){
  if(typeof token!=='string'||!token)throw invalid('LOC OAuth bearer token required');
  if(!body||!Object.hasOwn(body,'kind')||!SCOPE.test(String(body.scopeid||'')))
    throw invalid('Invalid fixed LOC operation');
  const allowed=new Set(['mcp-authorize','mcp-public-read','mcp-article-stat',
    'mcp-read','mcp-search','mcp-scope-status','mcp-conversation']);
  if(!allowed.has(body.kind))throw invalid('Unsupported LAS mapped LOC operation');
  let response;
  try{
    response=await fetchImpl(LOC_NATIVE,{
      method:'POST',redirect:'error',cache:'no-store',
      headers:{authorization:'Bearer '+token,'content-type':'application/json',
        accept:'application/json'},
      body:JSON.stringify(body),signal:AbortSignal.timeout(20000)
    });
  }catch(error){
    // Only a fixed error category is logged; never tokens, Request bodies,
    // user metadata, SQL messages or URLs. A same-zone Worker fetch error
    // must not be mistaken for a LOC business permission denial.
    const category=error?.name==='TimeoutError'?'timeout':
      error?.name==='AbortError'?'aborted':'transport';
    console.error('LAS LOC tunnel failed',{stage:'fetch',category});
    throw Object.assign(new Error('LOC data service unavailable'),
      {httpStatus:503,code:'LOC_TUNNEL_FETCH_UNAVAILABLE'});
  }
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    const category=response.status>=500?'upstream_server':
      response.status===401?'identity':response.status===403?'permission':
      response.status===429?'rate_limit':'upstream_other';
    console.warn('LAS LOC tunnel response',{
      stage:'response',status:response.status,category,
      format:data?.error?'loc_error':'unexpected'
    });
    const message=response.status>=500?'LOC data service unavailable':
      String(data?.error?.message||'LOC business permission denied');
    throw Object.assign(new Error(message),{httpStatus:response.status});
  }
  return data?.data??{};
}
export async function assertLocMcpRole(token,subject,fetchImpl=globalThis.fetch){
  // Only LOC's existing active api.manage reader may decide roles.
  // The verified bearer subject is bound to OAuth UserInfo inside LOC.
  if(typeof subject!=='string'||!subject)
    throw Object.assign(new Error('Verified OAuth subject required'),{httpStatus:401});
  const result=await callLocOperation({kind:'mcp-authorize',scopeid:'lo3rwang'},token,fetchImpl);
  if(result.authorized!==true)
    throw Object.assign(new Error('LOC MCP role not granted'),{httpStatus:403});
  return result;
}
export async function readMemory(args={},env={}){
  const scopeid=scope(args.scopeid);
  if(!UID.test(String(args.uid||'')))throw invalid('Invalid case-sensitive UID');
  const token=env?.lasOAuthToken;
  return callLocOperation({kind:'mcp-public-read',scopeid,args},token,env?.lasFetch||globalThis.fetch);
}
export async function privateGalaxyLink(args={},token,subject,env={}){
  const scopeid=scope(args.scopeid);
  if(args.source!==undefined)throw invalid('Galaxy Link source is fixed to mcp');
  const action=String(args.action||'');
  if(action==='read'){
    if(!UID.test(String(args.uid||'')))throw invalid('Invalid case-sensitive UID');
    const site=args.site??'mcp';
    if(!['mcp','LOC'].includes(site)||site==='LOC'&&scopeid!=='lo3rwang')
      throw invalid('Unsupported private Galaxy site');
    const offset=args.offset??0,maxChars=args.max_chars??20000;
    if(!Number.isInteger(offset)||offset<0||offset>1000000||
       !Number.isInteger(maxChars)||maxChars<1||maxChars>40000)
      throw invalid('Invalid read paging');
    const value=await callLocOperation({kind:'mcp-read',scopeid,
      uid:args.uid,site},token,env?.lasFetch||globalThis.fetch);
    const row=Array.isArray(value)?value[0]:null;
    if(!row)return {found:false,scopeid,uid:args.uid};
    const content=String(row.content||'');
    return {found:true,scopeid,uid:row.uid,title:row.title,date:row.date,
      createtime:row.createtime,site:row.site,url:row.url,
      content:content.slice(offset,offset+maxChars),offset,total_chars:content.length,
      next_offset:offset+maxChars<content.length?offset+maxChars:null};
  }
  if(action==='search'){
    if(args.user_requested!==true)throw invalid('Conversation search requires explicit user request');
    const query=String(args.query||'').trim(),limit=args.limit??5;
    if(PR.test(query))throw invalid('PR content cannot be searched via Galaxy');
    if(query.length<2||query.length>100||
      !Number.isInteger(limit)||limit<1||limit>5)
      throw invalid('Invalid private Galaxy search');
    const rows=await callLocOperation({kind:'mcp-search',scopeid,query,limit,
      user_requested:true},token,env?.lasFetch||globalThis.fetch);
    return {scopeid,results:Array.isArray(rows)?rows.map(row=>({
      uid:row.uid,title:row.title,createtime:row.createtime
    })):[]};
  }
  throw invalid('Unsupported private Galaxy action');
}
export async function articleDistribution(args={},env={}){
  return callLocOperation({kind:'mcp-article-stat',scopeid:'loc',args},
    env?.lasOAuthToken,env?.lasFetch||globalThis.fetch);
}
