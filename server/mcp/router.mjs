import {verifyJwsAccessToken,getDpopJktFromPayload} from 'better-auth/oauth2';
import {createLocAuth} from '../auth/auth.mjs';
import {businessAction} from './business-actions.mjs';
import {readMemory,privateGalaxyLink,articleDistribution,mcpDatabaseConfiguration} from '../tunnel/loc-mapping.mjs';
import {checkMcpGatewayQos} from './gateway-rate.mjs';
import {mcpToolJsonSchema,parseMcpToolArgs,McpRpcSchema} from './tool-contracts.mjs';
import {handleStatelessMcpPost,streamMcpSseResponse} from './stateless-transport.mjs';
// LOC MCP HTTP entry point. No database write is granted by an OAuth login.
// Both values are public protocol identities, not deployment targets.
// They must match the issuer's fixed OAuth resource registration even when
// an old Cloudflare environment variable survives a Worker migration.
export const MCP_RESOURCE='https://mcp.lo3rwang.cc';
export const LOC_OAUTH_ISSUER='https://auth.lo3rwang.cc/api/auth';
export function mcpConfig(){
  return {resource:MCP_RESOURCE,issuer:LOC_OAUTH_ISSUER};
}
const PR_SEARCH_WARNING='請至github頁面找尋PR相關資料！不開放搜尋PR!';
const SEARCH_PERMISSION_WARNING='只有使用者明確要求時，才允許搜尋對話；禁止代理自行搜尋。';
const SCOPES=['openid','profile','email','offline_access','loc:import'];
const DEFAULT_PROTOCOL='2025-06-18';
const SUPPORTED_PROTOCOLS=new Set(['2025-03-26','2025-06-18','2025-11-25']);
const COMMON_HEADERS={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS', 'Access-Control-Expose-Headers':'WWW-Authenticate, MCP-Session-Id'};

function response(body,status=200,extra={}){
  return new Response(body==null?null:JSON.stringify(body),{
    status,headers:{...COMMON_HEADERS,...(body==null?{}:{'Content-Type':'application/json; charset=utf-8'}),...extra}
  });
}
export function preflight(){return response(null,204);}
export function protectedResourceMetadata(env={}){
  const {resource,issuer}=mcpConfig(env);
  return response({resource,authorization_servers:[issuer],
    bearer_methods_supported:['header'],scopes_supported:SCOPES});
}
function oauthChallenge(config){
  return 'Bearer resource_metadata="'+
    config.resource+'/.well-known/oauth-protected-resource", scope="openid"';
}
function unauthorized(config){
  return response({error:'unauthorized',error_description:'LOC OAuth access token required'},401,{
    'WWW-Authenticate':oauthChallenge(config)
  });
}
// MCP and Auth share one LAS Worker. Do not fetch its JWKS through the
// protected public Auth hostname: Cloudflare Access returns a 302 login page
// to service-to-service JWKS requests (causing a false MCP HTTP 401).
// Instead call the existing Better Auth JWKS handler *inside this Worker*.
// Better Auth's RFC 9068 JOSE verifier still checks signature, time,
// issuer, audience, typ and authorized party. No private keys are exported.
const LOCAL_JWKS_CACHE_KEY={};
async function localAuthJwks(env){
  let pool;
  try{
    const built=createLocAuth(env);
    pool=built.pool;
    const request=new Request(LOC_OAUTH_ISSUER+'/jwks',{
      method:'GET',headers:{accept:'application/json'}
    });
    const response=await built.auth.handler(request);
    if(!response.ok)throw Error('Auth JWKS response unavailable');
    const keys=await response.json().catch(()=>null);
    if(!Array.isArray(keys?.keys)||!keys.keys.length)
      throw Error('Auth JWKS response invalid');
    return keys;
  }catch{
    // Includes environment, pool, and key-store failures. No credentials
    // or driver messages propagate across the MCP boundary.
    throw Object.assign(new Error('LAS JWKS unavailable'),
      {code:'LAS_JWKS_UNAVAILABLE'});
  }finally{
    if(pool)await pool.end().catch(()=>{});
  }
}
// Better Auth's built-in JWKS verifier caches trusted keys for five minutes
// using this stable per-isolate key. Key-rotation misses trigger its bounded
// re-fetch mechanism; no separate KV/cache/SQL verifier is introduced.
export async function verifyOAuthToken(request,config,env={}){
  try{
    const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'')?.[1];
    if(!token||request.headers.has('dpop'))return null;
    const payload=await verifyJwsAccessToken(token,{
      jwksFetch:()=>localAuthJwks(env),
      jwksCacheKey:LOCAL_JWKS_CACHE_KEY,
      verifyOptions:{issuer:config.issuer,audience:config.resource,
        typ:'at+jwt',requiredClaims:['azp']}
    });
    // The gateway accepts only ordinary Bearer tokens. Refuse a token bound
    // to a DPoP key rather than silently dropping sender constraints.
    if(getDpopJktFromPayload(payload))return null;
    if(typeof payload.sub!=='string'||!payload.sub)return null;
    const scopes=typeof payload.scope==='string'
      ?payload.scope.split(/\s+/).filter(Boolean):[];
    if(!scopes.includes('openid'))return null;
    return {subject:payload.sub,scopes};
  }catch(error){
    // Service-side key retrieval is an availability failure, not evidence
    // that an issued OAuth token is invalid. Do not force refresh/reconnect
    // on an unavailable JWKS. Never log tokens, claims or request bodies.
    const name=String(error?.name||'');
    // JOSE distinguishes key-store failures from cryptographic rejection.
    // A timeout or invalid/multiple-key JWKS is a server issue, NOT a
    // revoked OAuth bearer. Keep signature/issuer/audience checks intact.
    if(error?.code==='LAS_JWKS_UNAVAILABLE'||
       ['JWKSTimeout','JWKSInvalid','JWKSMultipleMatchingKeys'].includes(name))
      throw Object.assign(new Error('LAS JWKS unavailable'),
        {code:'LAS_JWKS_UNAVAILABLE'});
    const known=new Set(['JWTExpired','JWTClaimValidationFailed',
      'JWSSignatureVerificationFailed','JWKSNoMatchingKey','JWSInvalid']);
    console.warn('LAS MCP token verification failed',
      known.has(name)?name:'jwks_or_verifier_unavailable');
    return null;
  }
}
function result(id,value){return response({jsonrpc:'2.0',id,result:value});}
function rpcError(id,code,message,httpStatus=200,headers={}){
  return response({jsonrpc:'2.0',id,error:{code,message}},httpStatus,headers);
}
const TOOLS=[
  {name:'loc_connection_status',description:'Report verified LAS OAuth and configured LOC tunnel; not a database or Scope permission probe.',
    inputSchema:mcpToolJsonSchema('loc_connection_status'),
    annotations:{readOnlyHint:true,destructiveHint:false}},
  {name:'read_memory',description:'Read a PUBLIC LOC Galaxy article by exact, case-sensitive UID; supports content paging with offset/max_chars.',
    inputSchema:mcpToolJsonSchema('read_memory'),
    annotations:{readOnlyHint:true,destructiveHint:false}}
,
  {name:'galaxy_link',description:'Galaxy conversation continuity. Search ONLY when the human user explicitly requests a conversation search; never search automatically. PR/GitHub search is forbidden: 請至github頁面找尋PR相關資料！不開放搜尋PR! The business data service handles authorization and persistence.',
    inputSchema:mcpToolJsonSchema('galaxy_link')},
  {name:'article_distribution',description:'Get monthly published LOC article-count statistics for a calendar year or rolling 12 months. No SQL or article text; chart-ready numbers.',
    inputSchema:mcpToolJsonSchema('article_distribution'),
    annotations:{readOnlyHint:true,destructiveHint:false}},
];
function toolResponse(id,value){
 const warning=typeof value?.warning==='string'?value.warning:'';
 return result(id,{content:[{type:'text',text:(warning?warning+'\n':'')+JSON.stringify(value)}],
   structuredContent:value});
}
// LOC MCP business operations are independent of Auth-owned rate counters.
export async function handleMcp(request,env={}){
  const config=mcpConfig(env);
  if(request.method==='OPTIONS')return preflight();
  if(!['GET','POST'].includes(request.method))return response({error:'method_not_allowed'},405,{Allow:'GET, POST, OPTIONS'});
  const match=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!match)return unauthorized(config);
  let identity=null;
  try{identity=await verifyOAuthToken(request,config,env);}
  catch(error){
    if(error?.code==='LAS_JWKS_UNAVAILABLE')
      return response({error:'temporarily_unavailable',
        error_description:'LOC OAuth verification keys unavailable'},503,
        {'Retry-After':'15'});
    return unauthorized(config);
  }
  if(!identity)return unauthorized(config);
  if(request.method==='GET')return response({error:'SSE_not_supported',message:'Use Streamable HTTP POST'},405,{Allow:'POST, OPTIONS'});
  // One bounded, per-OAuth-subject request budget before reading a JSON-RPC
  // payload or dispatching any Function. No identity/role/Scope lookup, storage
  // service, timer, or client-controlled quota configuration is introduced.
  const qos=checkMcpGatewayQos(identity.subject);
  if(!qos.allowed)return response({error:'rate_limited',
    error_description:'LOC MCP request rate limited'},429,{
    'Retry-After':String(Math.max(1,Math.ceil(qos.retryAfterMs/1000)))
  });
  return handleStatelessMcpPost(request,async payload=>{
    // JSON remains the default for lightweight handshake/list requests.
    // An MCP tool call can stream its JSON-RPC response over this same POST
    // when the client advertises text/event-stream (including Accept: both).
    const stream=payload.method==='tools/call'&&
      String(request.headers.get('accept')||'').toLowerCase()
        .split(',').some(type=>type.trim().split(';',1)[0]==='text/event-stream');
    if(stream){
      // The signed OAuth bearer has already been verified. A business tool
      // is authorized by LOC's published JS rights as part of the *actual*
      // operation, not through a second role-probe HTTP/SQL request.
      // MCP tool errors are returned in the JSON-RPC/SSE result.
      return streamMcpSseResponse(()=>
        dispatchMcpPayload(payload,identity,match[1],config,env),payload.id);
    }
    return dispatchMcpPayload(payload,identity,match[1],config,env);
  });
}
async function dispatchMcpPayload(payload,identity,bearer,config,env){
  // The listed tool schemas are metadata, not permission grants.
  // LOC enforces its own JS Manage grants after verifying bearer identity,
  // within each operation that actually accesses Galaxy or Anchor data.
  switch(payload.method){
    case 'initialize':{
      const proposed=payload.params?.protocolVersion;
      return result(payload.id,{protocolVersion:SUPPORTED_PROTOCOLS.has(proposed)?proposed:DEFAULT_PROTOCOL,
        capabilities:{tools:{listChanged:false}},serverInfo:{name:'loc-mcp',version:'0.2.0',
           ...(proposed==='2025-11-25'?{icons:[{src:'https://loc.lo3rwang.cc/assets/site/icons/loc-favicon.png',mimeType:'image/png'}]}:{})},
        instructions:'Public Galaxy reads use the scoped ZenStack Galaxy ZModel with Kysely visibility filters. Private Galaxy reads use that scoped model after permission checks, while writes retain Kysely after Better Auth identity validation and LOC published JS Manage permissions. loc_connection_status reports configuration only, not successful database read/write. galaxy_link.search is permitted only by explicit human user request and user_requested=true. 請至github頁面找尋PR相關資料！不開放搜尋PR!'});
    }
    case 'ping':return result(payload.id,{});
    case 'tools/list':return result(payload.id,{tools:TOOLS});
    case 'tools/call':{
      const name=payload.params?.name;
      if(!TOOLS.some(tool=>tool.name===name))return rpcError(payload.id,-32602,'Unknown tool');
      const args=parseMcpToolArgs(name,payload.params?.arguments??{});
      if(args===null)return rpcError(payload.id,-32602,'Invalid MCP tool arguments');
      if(name==='galaxy_link'&&args.action==='search'&&
        /(?:\bPR(?:[\s#:\-]*\d+)?\b|\bpull[ -]?request\b|\bgithub\b|\bcommit\b|合併請求|拉取請求)/i.test(String(args.query||''))){
        return result(payload.id,{isError:true,content:[{type:'text',
          text:PR_SEARCH_WARNING}]});
      }
      if(name==='galaxy_link'&&args.action==='search'&&args.user_requested!==true)
        return result(payload.id,{isError:true,content:[{type:'text',
          text:SEARCH_PERMISSION_WARNING}]});
      if(name==='galaxy_link'&&args.action==='update_pr')
        return result(payload.id,{isError:true,content:[{type:'text',
          text:PR_SEARCH_WARNING}]});
      if(name==='loc_connection_status')return toolResponse(payload.id,{
        connected:true,oauthVerified:true,provider:'loc',subject:identity.subject,
        resource:config.resource,galaxyPublicReadSupported:true,
        galaxyWriteSupported:true,writeRequiresScopeAuthorization:true,
        businessAuthorization:'checked-by-LOC-published-JS-per-operation',
        nativeDatabase:mcpDatabaseConfiguration(env),
        availableTools:TOOLS.map(tool=>tool.name)});
      try{
        const directPrivate=name==='galaxy_link'&&['read','search'].includes(args.action);
        const value=name==='article_distribution'?
          await articleDistribution(args,{...env,lasOAuthToken:bearer}):
          name==='read_memory'?
          await readMemory(args,{...env,lasOAuthToken:bearer}):
          directPrivate?await privateGalaxyLink(args,bearer,identity.subject,env):
          await businessAction(name,args,bearer,env);
        return toolResponse(payload.id,value);
      }catch(error){
        const validation=error?.code==='INVALID_ARGUMENT';
        return result(payload.id,{isError:true,content:[{type:'text',
          text:validation?error.message:
            error?.httpStatus&&error.httpStatus<500?error.message:
            'LOC data service unavailable; please retry later.'}]});
      }
    }
    default:return rpcError(payload.id,-32601,'Method not found');
  }
}
