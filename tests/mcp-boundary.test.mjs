import test from 'node:test';
import assert from 'node:assert/strict';
import mcpWorker from '../server/mcp/server.mjs';

const LIVE='https://mcp.lo3rwang.cc';
const PREVIEW='https://pr-check-lunarcus.esotericverse.workers.dev';
async function request(host,path,method='GET'){
  return mcpWorker.fetch(new Request(host+path,{method}),{});
}
test('MCP OAuth resource metadata remains available on both host classes',async()=>{
  for(const host of [LIVE,PREVIEW]){
    const response=await request(host,'/.well-known/oauth-protected-resource');
    assert.equal(response.status,200);
    const metadata=await response.json();
    assert.equal(metadata.resource,LIVE);
    assert.deepEqual(metadata.authorization_servers,
      ['https://auth.lo3rwang.cc/api/auth']);
  }
});
test('MCP no longer proxies either LOC import endpoint',async()=>{
  for(const host of [LIVE,PREVIEW]){
    for(const path of ['/api/loc-native','/api/las-native']){
      const response=await request(host,path);
      assert.equal(response.status,404,host+path);
      assert.deepEqual(await response.json(),{error:'Not found'});
    }
  }
});
test('MCP cannot be reached through unrelated Worker hostnames',async()=>{
  const response=await request('https://another.esotericverse.workers.dev',
    '/.well-known/oauth-protected-resource');
  assert.equal(response.status,404);
});
