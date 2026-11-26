import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {callLocOperation} from '../server/tunnel/loc-mapping.mjs';
import {businessAction} from '../server/mcp/business-actions.mjs';
import {MCP_TOOL_INPUTS,parseMcpToolArgs} from '../server/mcp/tool-contracts.mjs';
import {handleMcp} from '../server/mcp/router.mjs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('LAS MCP exposes tools, not obsolete permission/Scope probes',()=>{
  const router=source('server/mcp/router.mjs');
  const tunnel=source('server/tunnel/loc-mapping.mjs');
  const commands=source('server/mcp/business-actions.mjs');
  const expected=['loc_connection_status','read_memory','galaxy_link','article_distribution'];
  assert.deepEqual(Object.keys(MCP_TOOL_INPUTS),expected);
  assert.equal(parseMcpToolArgs('scope_storage',{scopeid:'lo3rwang'}),null);
  for(const content of [router,tunnel,commands]){
    assert.doesNotMatch(content,/mcp-authorize|mcp-scope-status|scope_storage|assertLocMcpRole/);
  }
  assert.doesNotMatch(router,/authorizeMcpBearer|mcpRoleFailure/);
  assert.match(router,/verifyOAuthToken\(request,config,env\)/);
  assert.match(router,/dispatchMcpPayload\(payload,identity,match\[1\],config,env\)/);
});

test('LAS never forwards retired operations, even with a token',async()=>{
  let called=0;
  const fetchImpl=async()=>{called++;throw Error('Should not fetch');};
  for(const kind of ['mcp-authorize','mcp-scope-status']){
    await assert.rejects(
      callLocOperation({kind,scopeid:'lo3rwang'},'signed-token',fetchImpl),
      error=>error.code==='INVALID_ARGUMENT');
  }
  assert.equal(called,0);
});

test('LAS sends business tool to LOC exactly once without a role probe',async()=>{
  const calls=[];
  const fetchImpl=async (url,init)=>{
    calls.push({url,method:init.method,redirect:init.redirect,
      body:JSON.parse(init.body),bearer:init.headers.authorization});
    return new Response(JSON.stringify({data:{found:false}}),{
      status:200,headers:{'content-type':'application/json'}
    });
  };
  const answer=await businessAction('galaxy_link',{
    scopeid:'lo3rwang',action:'check',conversation_id:'conversation-1',
    updated_at:'2026-11-22T00:00:00.000Z'
  },'signed-token',{},fetchImpl);
  assert.deepEqual(answer,{found:false});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://loc.lo3rwang.cc/api/las-native');
  assert.equal(calls[0].redirect,'manual');
  assert.equal(calls[0].bearer,'Bearer signed-token');
  assert.equal(calls[0].body.kind,'mcp-conversation');
});

test('LAS rejects unauthenticated MCP traffic before exposing tools',async()=>{
  const request=new Request('https://mcp.lo3rwang.cc/',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})
  });
  const response=await handleMcp(request,{});
  assert.equal(response.status,401);
  assert.match(response.headers.get('www-authenticate')||'',/Bearer/);
});

test('LAS prefers the direct LOC Worker service binding over public hostname fetch',async()=>{
  const calls=[];
  const service={fetch:async(url,init)=>{
    calls.push({url,method:init.method,redirect:init.redirect,
      body:JSON.parse(init.body),bearer:init.headers.authorization});
    return new Response(JSON.stringify({data:{accepted:true}}),{
      status:200,headers:{'content-type':'application/json'}
    });
  }};
  const fallback=async()=>{throw Error('Public hostname fetch must not be used');};
  const answer=await businessAction('galaxy_link',{
    scopeid:'lo3rwang',action:'check',conversation_id:'conversation-2',
    updated_at:'2026-11-26T00:00:00.000Z'
  },'signed-token',{LOC_SERVICE:service},fallback);
  assert.deepEqual(answer,{accepted:true});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://loc.lo3rwang.cc/api/las-native');
  assert.equal(calls[0].redirect,'manual');
  assert.equal(calls[0].bearer,'Bearer signed-token');
  assert.equal(calls[0].body.kind,'mcp-conversation');
});

