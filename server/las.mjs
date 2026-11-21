// LAS is the application framework. Workers is only its execution host.
// Keep dispatch, route matching and request resource ownership independent
// from Better Auth, MCP, LOC and the Chrome Extension. No extra dependencies.
export const LAS_HOSTS=Object.freeze({
  auth:'auth.lo3rwang.cc',
  mcp:'mcp.lo3rwang.cc'
});

const PREVIEW_HOST=/^(?:[a-z0-9-]+-)?lunarcus\.esotericverse\.workers\.dev$/i;

export function isLASPreviewHost(hostname){
  return PREVIEW_HOST.test(hostname);
}

export function createLASRoutes(entries,{notFound=()=>new Response('Not found',{status:404})}={}){
  const handlers=new Map();
  for(const [paths,handler] of entries){
    if(typeof handler!=='function')throw new TypeError('LAS route handler must be a function');
    for(const path of paths){
      if(handlers.has(path))throw new Error('Duplicate LAS route: '+path);
      handlers.set(path,handler);
    }
  }
  return context=>(handlers.get(context.url.pathname)||notFound)(context);
}

export function createLAS({auth,mcp,previewMcpPaths=[]}){
  if(typeof auth!=='function'||typeof mcp!=='function')
    throw new TypeError('LAS Auth and MCP handlers are required');
  const previewMcp=new Set(previewMcpPaths);
  return {
    async fetch(request,env={},execution){
      const url=new URL(request.url);
      const preview=isLASPreviewHost(url.hostname);
      // Production is strictly host-based. Preview is isolated on workers.dev:
      // only explicitly registered paths are MCP; everything else is Auth.
      const module=url.hostname===LAS_HOSTS.mcp||
        (preview&&previewMcp.has(url.pathname))?'mcp':
        url.hostname===LAS_HOSTS.auth||preview?'auth':null;
      if(!module)return new Response('Not found',{status:404});

      // Request-owned resources: no global pools, sockets or session state.
      const finalizers=[];
      const context={request,env,execution,url,preview,module,
        onFinish(finalizer){
          if(typeof finalizer!=='function')throw new TypeError('Invalid LAS finalizer');
          finalizers.push(finalizer);
        }
      };
      try{
        return await (module==='mcp'?mcp:auth)(context);
      }finally{
        // Closing runs after request handling; keep Cloudflare's execution
        // context alive until async cleanup settles, without blocking output.
        for(const finalizer of finalizers.reverse()){
          const done=Promise.resolve().then(finalizer).catch(()=>{});
          if(typeof execution?.waitUntil==='function')execution.waitUntil(done);
          else await done;
        }
      }
    }
  };
}
