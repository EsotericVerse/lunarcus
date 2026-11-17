import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {callLocOperation,assertLocMcpRole,readMemory,articleDistribution}
 from '../app/las/mcp/loc-mapping.mjs';
import {MCP_TOOL_INPUTS} from '../app/las/mcp/tool-contracts.mjs';
import {businessAction} from '../app/las/mcp/business-actions.mjs';
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

test('MCP business actions and Tunnel share one fixed LOC HTTPS transport',async()=>{
  const operations=[];
  const fetchImpl=async(url,opts)=>{
    assert.equal(url,'https://loc.lo3rwang.cc/api/las-native');
    assert.equal(opts.method,'POST');
    assert.equal(opts.headers.authorization,'Bearer verified');
    assert.equal(opts.redirect,'error');
    assert.equal(opts.cache,'no-store');
    const body=JSON.parse(opts.body);
    operations.push(body);
    return Response.json({data:{ok:true,kind:body.kind}});
  };
  const scope=await businessAction('scope_storage',{scopeid:'lo3rwang'},
    'verified',{},fetchImpl);
  assert.deepEqual(scope,{ok:true,kind:'mcp-scope-status'});
  const galaxy=await businessAction('galaxy_link',{
    action:'check',scopeid:'lo3rwang',conversation_id:'c1',
    updated_at:'2026-11-17T00:00:00Z'
  },'verified',{},fetchImpl);
  assert.deepEqual(galaxy,{ok:true,kind:'mcp-conversation'});
  assert.deepEqual(operations.map(x=>x.kind),['mcp-scope-status','mcp-conversation']);
  assert.deepEqual(operations[1],{
    kind:'mcp-conversation',scopeid:'lo3rwang',action:'check',
    conversation_id:'c1',updated_at:'2026-11-17T00:00:00Z'
  });
});
test('MCP business mapping still rejects arbitrary actions before transport',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;return Response.json({data:{}});};
  await assert.rejects(businessAction('galaxy_link',{
    action:'delete',scopeid:'lo3rwang',conversation_id:'c1',
    updated_at:'2026-11-17T00:00:00Z'
  },'verified',{},fetchImpl),/Unsupported Galaxy Link action/);
  assert.equal(calls,0);
});

test('existing galaxy_link exposes ordered turns without any MCP provider selector',async()=>{
 const records=[{role:'user',message_id:'m20',source_order:20,
   parent_id:null,text:'hello'}];
 const args={action:'record_ordered',scopeid:'lo3rwang',
   conversation_id:'https://chatgpt.com/c/6af8ff99-6b54-83ee-8ee5-06f99616d940',
   updated_at:'2026-11-18T00:00:00Z',records};
 assert.equal(MCP_TOOL_INPUTS.galaxy_link.safeParse(args).success,true);
 const sent=[];
 const fetchImpl=async(_url,opts)=>{
   sent.push(JSON.parse(opts.body));return Response.json({data:{accepted:true}});
 };
 const result=await businessAction('galaxy_link',args,'verified',{},fetchImpl);
 assert.equal(result.accepted,true);
 assert.equal(sent.length,1);
 assert.equal(sent[0].kind,'mcp-conversation');
 assert.equal(sent[0].action,'record_ordered');
 assert.equal(sent[0].records[0].source_order,20);
 assert.equal('provider' in sent[0],false);
});
