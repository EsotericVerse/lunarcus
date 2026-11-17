import assert from 'node:assert/strict';
import {test} from 'node:test';
import worker from '../app/las/mcp/server.mjs';

const HOST='https://mcp.lo3rwang.cc';
const LOC='https://loc.lo3rwang.cc';
const EXT='chrome-extension://hiaeafonocnjaclcfgjmdopbcgnafnna';

test('LAS MCP Worker serves discovery and does not treat discovery as a login',async()=>{
  const res=await worker.fetch(new Request(HOST+'/.well-known/oauth-protected-resource'));
  assert.equal(res.status,200);
  const payload=await res.json();
  assert.equal(payload.resource,HOST);
  assert.deepEqual(payload.authorization_servers,['https://auth.lo3rwang.cc/api/auth']);
  assert.ok(payload.scopes_supported.includes('openid'));
  const bad=await worker.fetch(new Request(HOST+'/.well-known/oauth-protected-resource',{method:'POST'}));
  assert.equal(bad.status,405);
});

test('LAS MCP Worker enforces OAuth challenge and rejects unexpected paths/hostnames',async()=>{
  for(const method of ['GET','POST']){
    const res=await worker.fetch(new Request(HOST+'/mcp',{method}));
    assert.equal(res.status,401);
    assert.match(res.headers.get('www-authenticate')||'',/^Bearer /);
  }
  const other=await worker.fetch(new Request('https://other.example/mcp'));
  assert.equal(other.status,404);
  const absent=await worker.fetch(new Request(HOST+'/api/not-a-proxy'));
  assert.equal(absent.status,404);
});

test('LAS MCP LOC proxy forwards fixed operation route but never a website Cookie or Host header',async()=>{
  const originalFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,init)=>{
    calls.push({url:String(url),method:init.method,
      headers:new Headers(init.headers),
      body:init.body?await new Response(init.body).text():''});
    return new Response(JSON.stringify({data:{ok:true}}),{
      status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const payload=JSON.stringify({kind:'mcp-authorize',scopeid:'lo3rwang'});
    const req=new Request(HOST+'/api/loc-native?source=extension',{
      method:'POST',
      headers:{Authorization:'Bearer test',Cookie:'session=never-forward',
        Host:'attacker.invalid',Origin:EXT,'Content-Type':'application/json',
        'X-Unsafe-Header':'no'},
      body:payload});
    const response=await worker.fetch(req);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('access-control-allow-origin'),EXT);
    assert.deepEqual(await response.json(),{data:{ok:true}});
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,LOC+'/api/las-native?source=extension');
    assert.equal(calls[0].method,'POST');
    assert.equal(calls[0].headers.get('authorization'),'Bearer test');
    assert.equal(calls[0].headers.get('cookie'),null);
    assert.equal(calls[0].headers.get('host'),null);
    assert.equal(calls[0].headers.get('x-unsafe-header'),null);
    assert.equal(calls[0].body,payload);

    const wrongMethod=await worker.fetch(new Request(HOST+'/api/loc-native'));
    assert.equal(wrongMethod.status,405);
    assert.equal(calls.length,1,'Unsupported methods must not reach LOC');

    const denied=await worker.fetch(new Request(HOST+'/api/loc-native',{
      method:'POST',headers:{Origin:'https://evil.example'},body:payload}));
    assert.equal(denied.status,403);
    assert.equal(calls.length,1,'Unapproved browser origins must not reach LOC');
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test('LAS MCP Worker only opens supported preflight routes to trusted origins',async()=>{
  const ok=await worker.fetch(new Request(HOST+'/api/loc-native',{
    method:'OPTIONS',headers:{Origin:EXT}}));
  assert.equal(ok.status,204);
  assert.equal(ok.headers.get('access-control-allow-origin'),EXT);
  const denied=await worker.fetch(new Request(HOST+'/api/loc-native',{
    method:'OPTIONS',headers:{Origin:'https://evil.example'}}));
  assert.equal(denied.status,403);
});


import {streamMcpSseResponse,handleStatelessMcpPost}
  from '../app/las/mcp/stateless-transport.mjs';
import {readBoundedJson,BodyTooLargeError} from '../app/las/mcp/stream-json.mjs';

function chunks(...parts){
  const encoder=new TextEncoder();
  return new ReadableStream({
    start(controller){
      for(const part of parts)controller.enqueue(encoder.encode(part));
      controller.close();
    }
  });
}

test('POST SSE emits a request-scoped result and closes without a session or extra connection',async()=>{
  const res=streamMcpSseResponse(async()=>Response.json({
    jsonrpc:'2.0',id:9,result:{tools:[]}
  }),9);
  assert.equal(res.status,200);
  assert.match(res.headers.get('content-type'),/text\/event-stream/);
  const body=await res.text();
  assert.match(body,/: loc-mcp stream opened/);
  assert.match(body,/data: \{"jsonrpc":"2.0","id":9,"result":\{"tools":\[\]\}\}/);
});

test('Stateless MCP rejects batched operations before dispatching any tool',async()=>{
  let dispatched=0;
  const req=new Request(HOST+'/',{method:'POST',body:JSON.stringify([
    {jsonrpc:'2.0',id:1,method:'ping'},
    {jsonrpc:'2.0',id:2,method:'ping'}
  ])});
  const res=await handleStatelessMcpPost(req,async()=>{
    dispatched++;
    return Response.json({ok:true});
  });
  assert.equal(res.status,200);
  assert.equal((await res.json()).error.code,-32600);
  assert.equal(dispatched,0);
});

test('Bounded JSON reader rejects oversized payloads and releases the stream',async()=>{
  await assert.rejects(readBoundedJson(chunks('{"value":"'+ 'a'.repeat(128)+'"}'),16),
    error=>error instanceof BodyTooLargeError);
});


test('Retired LOC provider routes are not forwarded or reintroduced by LAS',async()=>{
  const originalFetch=globalThis.fetch;
  let forwarded=0;
  globalThis.fetch=async()=>{forwarded++;throw Error('Unexpected retired provider proxy');};
  try{
    for(const path of ['/api/mcp-provider','/api/mcp-provider-callback',
      '/api/mcp-provider-extension']){
      const res=await worker.fetch(new Request(HOST+path,{method:'POST',
        headers:{Origin:EXT,'Content-Type':'application/json'},body:'{}'}));
      assert.equal(res.status,404,path+' must not be forwarded to retired LOC route');
    }
    assert.equal(forwarded,0);
  }finally{globalThis.fetch=originalFetch;}
});
