// LAS MCP endpoint: protocol, OAuth resource metadata and tools only.
// LOC import endpoints belong to LOC and are called there directly.
import {handleMcp,preflight,protectedResourceMetadata}
  from './router.mjs';

const MCP_HOST='mcp.lo3rwang.cc';
const LAS_PREVIEW_HOST=/^(?:[a-z0-9-]+-)?lunarcus\.esotericverse\.workers\.dev$/i;

function error(status,message){
  return new Response(JSON.stringify({error:message}),{
    status,headers:{'content-type':'application/json','cache-control':'no-store'}
  });
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.hostname!==MCP_HOST&&!LAS_PREVIEW_HOST.test(url.hostname))
      return error(404,'Not found');
    if(url.pathname==='/.well-known/oauth-protected-resource'||
       url.pathname==='/.well-known/oauth-protected-resource/mcp'){
      return request.method==='OPTIONS'?preflight():
        request.method==='GET'?protectedResourceMetadata(env):
        error(405,'Method not allowed');
    }
    if(url.pathname==='/'||url.pathname==='/mcp')
      return handleMcp(request,env);
    return error(404,'Not found');
  }
};
