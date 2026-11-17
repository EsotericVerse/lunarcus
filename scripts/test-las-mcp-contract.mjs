import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {callLocOperation,assertLocMcpRole,readMemory,articleDistribution}
 from '../app/las/mcp/loc-mapping.mjs';
import {MCP_TOOL_INPUTS} from '../app/las/mcp/tool-contracts.mjs';
import {advertisedTools} from '../app/las/mcp/router.mjs';
import {providerStatuses} from '../app/las/mcp/upstream/upstream-policy.mjs';
import {callLocOperation as tunnelCallLocOperation} from '../app/las/tunnel/loc-mapping.mjs';

const samples=[];
const fetchFake=async (url,opts)=>{
  assert.equal(url,'https://loc.lo3rwang.cc/api/las-native');
  assert.equal(opts.method,'POST');
  assert.equal(opts.headers.authorization,'Bearer verified');
  const body=JSON.parse(opts.body);samples.push(body);
  return new Response(JSON.stringify({data:body.kind==='mcp-authorize'?{authorized:true}:
    body.kind==='mcp-public-read'?{uid:'Aa123456',found:true}:[]}),
    {status:200,headers:{'content-type':'application/json'}});
};
test('MCP compatibility import preserves tunnel function identity',()=>{
  assert.strictEqual(callLocOperation,tunnelCallLocOperation);
});
test('LAS does not advertise SQL or own LOC route-index source',()=>{
  assert.equal(MCP_TOOL_INPUTS.read_memory.safeParse({uid:'Aa123456',scopeid:'lrunes'}).success,true);
  const source=readFileSync(new URL('../app/las/mcp/tool-contracts.mjs',import.meta.url),'utf8');
  assert.ok(!source.includes('SCOPE_ROUTE_INDEX'));
});
test('Luna Protocol uses fixed LOC API and verified bearer only',async()=>{
  await assertLocMcpRole('verified','subject',fetchFake);
  const result=await readMemory({uid:'Aa123456',scopeid:'lo3rwang'},
    {lasOAuthToken:'verified',lasFetch:fetchFake});
  assert.equal(result.found,true);
  await articleDistribution({year:2026},{lasOAuthToken:'verified',lasFetch:fetchFake});
  assert.deepEqual(samples.map(x=>x.kind),
    ['mcp-authorize','mcp-public-read','mcp-article-stat']);
  assert.equal(samples[2].scopeid,'loc');
});
test('invalid direct SQL action and missing identity are rejected',async()=>{
  await assert.rejects(callLocOperation({kind:'managed-write',scopeid:'loc'},'verified',fetchFake));
  await assert.rejects(callLocOperation({kind:'mcp-read',scopeid:'lo3rwang'},'',fetchFake));
  await assert.rejects(assertLocMcpRole('verified','',fetchFake));
});
test('LAS does not import LOC Galaxy sources across repos',()=>{
  for(const file of ['router.mjs','loc-mapping.mjs','access-roles.mjs','tool-contracts.mjs']){
    const src=readFileSync(new URL('../app/las/mcp/'+file,import.meta.url),'utf8');
    assert.ok(!src.includes('/app/loc/'));
    assert.ok(!src.includes('/packages/zenstack/'));
    assert.ok(!src.includes('DATABASE_ACCESS_LIST'));
  }
});

// SSO identifies users; provider invocation cannot be enabled by identity alone.
test('MCP provider catalog is observable but execution stays closed without encrypted store',async()=>{
  const withoutStore=advertisedTools({});
  assert.ok(withoutStore.some(t=>t.name==='provider_list'));
  for(const name of ['provider_tools','provider_call','provider_receipt'])
    assert.ok(!withoutStore.some(t=>t.name===name));
  const status=await providerStatuses({},'loc_'+'a'.repeat(32));
  assert.equal(status.ready,false);
  assert.deepEqual(status.providers.map(p=>p.id).sort(),
    ['clerk','github','neon','supabase']);
  assert.ok(status.providers.every(p=>p.connected===false));
  const fakeStore={get:async()=>null,put:async()=>{}};
  assert.ok(!advertisedTools({LOC_MCP_PROVIDER_STORE:fakeStore})
    .some(t=>t.name==='provider_call'));
  const withStore=advertisedTools({LOC_MCP_PROVIDER_STORE:fakeStore,
    LOC_MCP_PROVIDER_ENCRYPTION_KEY:'x'.repeat(32)});
  for(const name of ['provider_tools','provider_call','provider_receipt'])
    assert.ok(withStore.some(t=>t.name===name));
});
