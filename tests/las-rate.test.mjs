import test from 'node:test';
import assert from 'node:assert/strict';
import {lasAuthRatePolicy,createLASAuthRateRules}
  from '../server/auth/auth-rate.mjs';
import {createMcpGatewayQos,MCP_QOS_BUDGET}
  from '../server/mcp/gateway-rate.mjs';

const request=path=>new Request('https://auth.lo3rwang.cc/api/auth'+path);

test('LAS Auth uses native Better Auth budgets without duplicate counters',()=>{
  const rules=createLASAuthRateRules();
  assert.equal(rules['/jwks'],false);
  assert.deepEqual(rules['/**'](request('/oauth2/token'),{window:60,max:120}),
    {window:60,max:40});
  assert.deepEqual(rules['/**'](request('/oauth2/client/rotate-keys'),
    {window:60,max:120}),{window:60,max:5});
  const defaultRate={window:70,max:15};
  assert.equal(rules['/**'](request('/get-session'),defaultRate),defaultRate);
  assert.equal(lasAuthRatePolicy.enabled,true);
});
test('LAS MCP rolling quota gives correct retry-after without dropping identity isolation',()=>{
  let clock=1000;
  const limit=createMcpGatewayQos({
    now:()=>clock,max:3,windowMs:10000,blockMs:30000,maxEntries:3
  });
  for(let i=0;i<3;i++)assert.equal(limit('owner').allowed,true);
  assert.deepEqual(limit('owner'),{
    allowed:false,blocked:false,retryAfterMs:10000
  });
  assert.equal(limit('second').allowed,true);
  clock+=10001;
  assert.equal(limit('owner').allowed,true);
});
test('LAS MCP burst blocks temporarily while honoring fixed budget',()=>{
  let clock=10000;
  const limit=createMcpGatewayQos({
    now:()=>clock,max:120,windowMs:60000,blockMs:30000,maxEntries:5
  });
  for(let i=0;i<36;i++)assert.equal(limit('owner').allowed,true);
  const result=limit('owner');
  assert.deepEqual(result,{
    allowed:false,blocked:true,retryAfterMs:30000
  });
  clock+=1200;
  assert.equal(limit('owner').retryAfterMs,28800);
  clock+=29000;
  assert.equal(limit('owner').allowed,true);
  assert.equal(MCP_QOS_BUDGET.max,120);
});
test('LAS MCP entries are bounded and evict inactive identities',()=>{
  let clock=100;
  const limit=createMcpGatewayQos({
    now:()=>clock,max:1,windowMs:60000,maxEntries:2
  });
  assert.equal(limit('A').allowed,true);
  assert.equal(limit('B').allowed,true);
  assert.equal(limit('B').allowed,false);
  assert.equal(limit('C').allowed,true); // LRU A evicted
  assert.equal(limit('A').allowed,true);
});
