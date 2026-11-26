import {getContainer} from '@cloudflare/containers';
import {mcpConfig,verifyOAuthToken} from './router.mjs';
import {checkMcpGatewayQos} from './gateway-rate.mjs';
import {businessAction} from './business-actions.mjs';
import {consumeSortedImportStream} from './plugin-import-stream-core.mjs';
import {readBoundedText} from './stream-json.mjs';

const EXTENSION_ORIGIN='chrome-extension://hiaeafonocnjaclcfgjmdopbcgnafnna';
const MAX_UPLOAD_BYTES=128*1024*1024;
function headers(origin='*'){
 return {'cache-control':'no-store','x-content-type-options':'nosniff',
  'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS',
  'access-control-allow-headers':'Authorization, Content-Type',
  'access-control-expose-headers':'Retry-After','vary':'Origin'};
}
function json(body,status=200,origin='*',extra={}){
 return new Response(JSON.stringify(body),{status,headers:{
  ...headers(origin),'content-type':'application/json; charset=utf-8',...extra
 }});
}
export async function handlePluginImportStream(request,env={}){
 const origin=request.headers.get('origin')||'';
 const allowedOrigin=origin?origin: '*';
 if(request.method==='OPTIONS'){
  if(origin!==EXTENSION_ORIGIN)return json({error:'origin_not_allowed'},403,'null');
  return new Response(null,{status:204,headers:headers(EXTENSION_ORIGIN)});
 }
 if(origin&&origin!==EXTENSION_ORIGIN)return json({error:'origin_not_allowed'},403,'null');
 if(request.method!=='POST')return json({error:'method_not_allowed'},405,allowedOrigin,{allow:'POST, OPTIONS'});
 const contentType=String(request.headers.get('content-type')||'').split(';',1)[0].trim().toLowerCase();
 if(contentType!=='application/x-ndjson')return json({error:'expected_ndjson'},415,allowedOrigin);
 if(request.headers.has('content-encoding')&&request.headers.get('content-encoding')!=='identity')
  return json({error:'unsupported_content_encoding'},415,allowedOrigin);
 if(!request.body)return json({error:'empty_stream'},400,allowedOrigin);
 const contentLength=Number(request.headers.get('content-length')||0);
 if(contentLength>MAX_UPLOAD_BYTES)return json({error:'upload_too_large'},413,allowedOrigin);
 const bearer=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'')?.[1];
 if(!bearer)return json({error:'unauthorized'},401,allowedOrigin,
  {'www-authenticate':'Bearer resource_metadata="https://mcp.lo3rwang.cc/.well-known/oauth-protected-resource"'});
 let identity;
 try{identity=await verifyOAuthToken(request,mcpConfig(),env);}
 catch(error){
  if(error?.code==='LAS_JWKS_UNAVAILABLE')
   return json({error:'oauth_temporarily_unavailable'},503,allowedOrigin,{'retry-after':'15'});
  return json({error:'unauthorized'},401,allowedOrigin);
 }
 if(!identity)return json({error:'unauthorized'},401,allowedOrigin);
 if(!identity.scopes?.includes('loc:import'))return json({error:'import_scope_required'},403,allowedOrigin);
 const qos=checkMcpGatewayQos(identity.subject);
 if(!qos.allowed)return json({error:'rate_limited'},429,allowedOrigin,
  {'retry-after':String(Math.max(1,Math.ceil(qos.retryAfterMs/1000)))});
 if(!env.LAS_PLUGIN_IMPORT)return json({error:'container_binding_unavailable'},503,allowedOrigin);
 try{
  // Credentials stay in the Worker. Only the NDJSON body crosses into the
  // isolated CPU/memory container; it has no internet egress or DB secrets.
  const container=getContainer(env.LAS_PLUGIN_IMPORT,'las-plugin-import-v1');
  const forwarded=new Request('http://container/ingest',{
   method:'POST',headers:{'content-type':'application/x-ndjson'},
   body:request.body,signal:request.signal
  });
  const upstream=await container.fetch(forwarded);
  if(!upstream.ok){
   const detail=await readBoundedText(upstream.body,8192).catch(()=> '');
   return json({error:'container_rejected_stream',detail:detail.slice(0,300)},upstream.status,allowedOrigin);
  }
  const receipt=await consumeSortedImportStream(upstream,{
   writeConversation:args=>businessAction('galaxy_link',{
    action:'record_ordered',scopeid:args.scopeid,
    conversation_id:args.conversation_id,updated_at:args.updated_at,
    title:args.title,records:args.records
   },bearer,env)
  });
  return json(receipt,200,allowedOrigin);
 }catch(error){
  const status=Number(error?.httpStatus);
  const safeStatus=status>=400&&status<=599?status:502;
  console.warn('LAS plugin stream import stopped',{
   stage:error?.code?.startsWith('loc_')?'loc-write':'container-stream',
   status:safeStatus,code:String(error?.code||'stream_failed').slice(0,64)
  });
  const extra=error?.retryAfter?{'retry-after':String(error.retryAfter)}:{};
  return json({error:String(error?.code||'plugin_import_failed'),
   message:safeStatus>=500?'LAS conversation import unavailable':
    String(error?.message||'Conversation import rejected').slice(0,180)},
   safeStatus,allowedOrigin,extra);
 }
}
