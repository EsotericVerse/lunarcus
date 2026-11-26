import test from 'node:test';
import assert from 'node:assert/strict';
import {createLAS,createLASRoutes,LAS_HOSTS,isLASPreviewHost}
  from '../server/las.mjs';

const PREVIEW='https://pr-core-lunarcus.esotericverse.workers.dev';
const urls={
  auth:'https://'+LAS_HOSTS.auth,
  mcp:'https://'+LAS_HOSTS.mcp,
  preview:PREVIEW
};

test('LAS owns production host routing and explicit workers.dev preview paths',async()=>{
  const hits=[];
  const framework=createLAS({
    auth:async ({request,preview,module})=>{
      hits.push({host:new URL(request.url).hostname,preview,module});
      return new Response('auth');
    },
    mcp:async ({request,preview,module})=>{
      hits.push({host:new URL(request.url).hostname,preview,module});
      return new Response('mcp');
    },
    previewMcpPaths:['/','/mcp','/.well-known/oauth-protected-resource']
  });
  const ask=async(host,path)=>framework.fetch(new Request(host+path),{});
  assert.equal(await (await ask(urls.auth,'/mcp')).text(),'auth');
  assert.equal(await (await ask(urls.mcp,'/login')).text(),'mcp');
  assert.equal(await (await ask(urls.preview,'/mcp')).text(),'mcp');
  assert.equal(await (await ask(urls.preview,'/login')).text(),'auth');
  assert.equal(await (await ask(urls.preview,'/api/auth/get-session')).text(),'auth');
  assert.equal((await ask('https://unknown.esotericverse.workers.dev','/')).status,404);
  assert.deepEqual(hits.map(x=>x.module),['auth','mcp','mcp','auth','auth']);
});
test('LAS preview host checks are strict (no suffix tricks)',()=>{
  assert.equal(isLASPreviewHost('lunarcus.esotericverse.workers.dev'),true);
  assert.equal(isLASPreviewHost('branch-lunarcus.esotericverse.workers.dev'),true);
  assert.equal(isLASPreviewHost('lunarcus.esotericverse.workers.dev.evil.com'),false);
  assert.equal(isLASPreviewHost('other.workers.dev'),false);
});
test('LAS resource finalizers run once after response, on error and with waitUntil',async()=>{
  const ended=[];
  const pending=[];
  const app=createLAS({
    auth:async ({onFinish})=>{
      onFinish(()=>ended.push('first'));
      onFinish(()=>ended.push('second'));
      return new Response('ok');
    },
    mcp:async()=>new Response('mcp')
  });
  const ctx={waitUntil(p){pending.push(p);}};
  const result=await app.fetch(new Request(urls.auth+'/health'),{},ctx);
  assert.equal(result.status,200);
  await Promise.all(pending);
  assert.deepEqual(ended,['second','first']);
  assert.equal(pending.length,2);

  const failing=createLAS({
    auth:async ({onFinish})=>{
      onFinish(()=>ended.push('failed'));
      throw new Error('handler failed');
    },
    mcp:async()=>new Response('ok')
  });
  await assert.rejects(()=>failing.fetch(new Request(urls.auth+'/'),{}),
    /handler failed/);
  assert.equal(ended.at(-1),'failed');
});
test('LAS routes dispatch exact paths and reject duplicates',async()=>{
  const dispatch=createLASRoutes([
    [['/','/mcp'],()=>new Response('mcp')],
    [['/status'],()=>new Response('status')]
  ]);
  const ctx={url:new URL('https://mcp.lo3rwang.cc/mcp')};
  assert.equal(await (await dispatch(ctx)).text(),'mcp');
  ctx.url.pathname='/missing';
  assert.equal((await dispatch(ctx)).status,404);
  assert.throws(()=>createLASRoutes([
    [['/mcp'],()=>{}],
    [['/mcp'],()=>{}]
  ]),/Duplicate LAS route/);
});
