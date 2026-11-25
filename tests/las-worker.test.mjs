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

test('LAS Hyperdrive keeps direct TLS policy separate and uses only its binding',async()=>{
  const {authDatabaseConnection,createAuthPostgresPool}=await import('../server/auth/pg-driver.mjs');
  const direct='postgresql://direct.invalid/db';
  const pooled='postgresql://hyperdrive.invalid/db';
  assert.deepEqual(authDatabaseConnection({LAS_DATABASE_URL:direct}),{connectionString:direct,hyperdrive:false});
  assert.deepEqual(authDatabaseConnection({LAS_DATABASE_URL:direct,LAS_HYPERDRIVE:{connectionString:pooled}}),{connectionString:pooled,hyperdrive:true});
  assert.equal(authDatabaseConnection({LAS_DATABASE_URL:direct,LAS_HYPERDRIVE:{}}).connectionString,undefined);
  let options;
  class Client{
    constructor(config){options=config;}
    on(){}
    async connect(){}
    async end(){}
  }
  const directPool=createAuthPostgresPool(direct,Client,{attempts:1});
  await directPool.connect();
  assert.deepEqual(options.ssl,{rejectUnauthorized:true});
  await directPool.end();
  const pooledPool=createAuthPostgresPool(pooled,Client,{attempts:1,hyperdrive:true});
  await pooledPool.connect();
  assert.equal(options.connectionString,pooled);
  assert.equal(Object.hasOwn(options,'ssl'),false);
  await pooledPool.end();
});
