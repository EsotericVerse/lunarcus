// LAS MCP protocol module. LOC import stays in LOC.
import {handleMcp,preflight,protectedResourceMetadata}
  from './router.mjs';
import {LAS_HOSTS,isLASPreviewHost,createLASRoutes} from '../las.mjs';
import {handlePluginImportStream} from './plugin-import-stream.mjs';

function error(status,message){
  return new Response(JSON.stringify({error:message}),{
    status,headers:{'content-type':'application/json','cache-control':'no-store'}
  });
}

const dispatch=createLASRoutes([
  [[
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/mcp'
  ],({request,env})=>request.method==='OPTIONS'?preflight():
    request.method==='GET'?protectedResourceMetadata(env):
    error(405,'Method not allowed')],
  [['/api/plugins/import/stream'],({request,env})=>handlePluginImportStream(request,env)],
  [['/','/mcp'],({request,env})=>handleMcp(request,env)]
],{notFound:()=>error(404,'Not found')});

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.hostname!==LAS_HOSTS.mcp&&!isLASPreviewHost(url.hostname))
      return error(404,'Not found');
    return dispatch({request,env,url});
  }
};
