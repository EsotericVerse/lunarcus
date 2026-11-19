// LAS MCP Gateway: protocol + identity boundary, no LOC SQL or Galaxy
// business model bundled into this Cloudflare Worker.
import {handleMcp,preflight,protectedResourceMetadata}
  from './router.mjs';

const LOC='https://loc.lo3rwang.cc';
// MCP's public alias and this LAS Worker's version-preview hostnames.
const MCP_HOST='mcp.lo3rwang.cc';
const LAS_WORKERS_DEV=/^(?:[a-z0-9-]+-)?lunarcus\.esotericverse\.workers\.dev$/i;
const WEB='https://loc.lo3rwang.cc';
const EXT='chrome-extension://hiaeafonocnjaclcfgjmdopbcgnafnna';
const CORS=new Set([EXT,WEB]);

function error(status,message){return new Response(JSON.stringify({error:message}),{
  status,headers:{'content-type':'application/json','cache-control':'no-store'}
});}
function withCors(request,response){
  const origin=request.headers.get('origin');
  if(!origin||!CORS.has(origin))return response;
  const headers=new Headers(response.headers);
  headers.set('access-control-allow-origin',origin);
  headers.set('vary','Origin');
  headers.set('access-control-allow-methods','GET,POST,OPTIONS');
  headers.set('access-control-allow-headers','Authorization,Content-Type');
  return new Response(response.body,{status:response.status,headers});
}
// LOC owns the fixed business API only. Its retired provider endpoints
// must not be proxied as a second, nonfunctional MCP control plane.
const LOC_PROXY_ROUTES=new Map([
  ['/api/loc-native','/api/las-native']
]);

async function locProxy(request,target,env){
  const origin=request.headers.get('origin');
  if(origin&&!CORS.has(origin))return error(403,'Origin denied');
  if(request.method==='OPTIONS'){
    if(!origin)return new Response(null,{status:204});
    return withCors(request,new Response(null,{status:204}));
  }
  const method=request.method;
  if(target==='/api/las-native'&&method!=='POST')
    return error(405,'Method not allowed');
  if(target!=='/api/las-native'&&!['GET','POST'].includes(method))
    return error(405,'Method not allowed');
  const source=new URL(request.url);
  const url=new URL(target,LOC);
  url.search=source.search;
  const headers=new Headers();
  for(const key of ['authorization','content-type','accept','origin'])
    if(request.headers.has(key))headers.set(key,request.headers.get(key));
  // No forwarding of website session cookies or arbitrary client headers.
  const init={method,headers,redirect:'manual'};
  if(method==='POST'){init.body=request.body;init.duplex='half';}
  let response;
  try{response=await fetch(url,init);}
  catch{return error(503,'LOC business service unavailable');}
  return withCors(request,response);
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.hostname!==MCP_HOST&&!LAS_WORKERS_DEV.test(url.hostname))
      return error(404,'Not found');
    if(url.pathname==='/.well-known/oauth-protected-resource'||
       url.pathname==='/.well-known/oauth-protected-resource/mcp'){
      return request.method==='OPTIONS'?preflight():
        request.method==='GET'?protectedResourceMetadata(env):error(405,'Method not allowed');
    }
    if(url.pathname==='/'||url.pathname==='/mcp')return handleMcp(request,env);
    if(LOC_PROXY_ROUTES.has(url.pathname))
      return locProxy(request,LOC_PROXY_ROUTES.get(url.pathname),env);
    return error(404,'Not found');
  }
};
