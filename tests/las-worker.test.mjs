import test from 'node:test';
import assert from 'node:assert/strict';
import las from '../server/index.mjs';

const AUTH='https://auth.lo3rwang.cc';
const MCP='https://mcp.lo3rwang.cc';
const PREVIEW='https://check-lunarcus.esotericverse.workers.dev';
const get=(url)=>las.fetch(new Request(url),{});

test('LAS Auth /health is lazy and needs no Auth DB credentials',async()=>{
  for(const host of [AUTH,PREVIEW]){
    const response=await get(host+'/health');
    assert.equal(response.status,200,host);
    assert.equal((await response.json()).issuer,AUTH);
  }
});

test('LAS canonical Auth login and redirect stay on production issuer',async()=>{
  const root=await get(AUTH+'/');
  assert.equal(root.status,302);
  assert.equal(root.headers.get('location'),AUTH+'/login');
  const page=await get(PREVIEW+'/login');
  assert.equal(page.status,200);
  assert.match(await page.text(),/使用 Google OAuth 登入/);
});

test('LAS MCP metadata and unrelated hosts are isolated',async()=>{
  for(const host of [MCP,PREVIEW]){
    const response=await get(host+'/.well-known/oauth-protected-resource');
    assert.equal(response.status,200);
    assert.equal((await response.json()).resource,MCP);
  }
  assert.equal((await get('https://unrelated.esotericverse.workers.dev/health')).status,404);
});
