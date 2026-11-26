import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMcpToolArgs} from '../server/mcp/tool-contracts.mjs';
import {privateGalaxyLink} from '../server/tunnel/loc-mapping.mjs';
import {businessAction} from '../server/mcp/business-actions.mjs';

const sources=['web','Github','ChatGPT','Claude','Gemini'];
test('Galaxy Link accepts five actual From sources but not the MCP parent Domain',()=>{
 for(const site of sources){
  const parsed=parseMcpToolArgs('galaxy_link',{
   action:'read',scopeid:'lo3rwang',uid:'ABCDEFGH',site
  });
  assert.equal(parsed.site,site);
 }
 assert.equal(parseMcpToolArgs('galaxy_link',{
  action:'read',scopeid:'lo3rwang',uid:'ABCDEFGH',site:'mcp'
 }),null);
});
test('unspecified site stays unspecified through LAS and LOC chooses source',async()=>{
 let sent=null;
 const fetcher=async(_url,options)=>{
  sent=JSON.parse(options.body);
  return Response.json({data:[{uid:'ABCDEFGH',title:'Conversation',
    site:'ChatGPT',content:'hello'}]});
 };
 const out=await privateGalaxyLink({
  action:'read',scopeid:'lo3rwang',uid:'ABCDEFGH'
 },'delegated-token',null,{lasFetch:fetcher});
 assert.equal(out.found,true);
 assert.equal(out.site,'ChatGPT');
 assert.equal(Object.hasOwn(sent,'site'),false);
});
test('explicit From source remains an exact LOC read selection',async()=>{
 let sent=null;
 const fetcher=async(_url,options)=>{
  sent=JSON.parse(options.body);
  return Response.json({data:[]});
 };
 await privateGalaxyLink({action:'read',scopeid:'lo3rwang',
  uid:'ABCDEFGH',site:'Claude'},'delegated-token',null,{lasFetch:fetcher});
 assert.equal(sent.site,'Claude');
});
test('ordered conversation writes pass the original URL to LOC and never supply site=mcp',async()=>{
 let sent=null;
 const fetcher=async(_url,options)=>{
  sent=JSON.parse(options.body);
  return Response.json({data:{accepted:true}});
 };
 await businessAction('galaxy_link',{
  action:'record_ordered',scopeid:'lo3rwang',
  conversation_id:'https://chatgpt.com/c/12345678-1234-4234-8234-123456789abc',
  updated_at:'2026-11-26T07:00:00.000Z',title:'Conversation',
  records:[{message_id:'m1',source_order:0,parent_id:null,role:'user',text:'hello'}]
 },'delegated-token',{},fetcher);
 assert.equal(sent.kind,'mcp-conversation');
 assert.equal(sent.conversation_id,'https://chatgpt.com/c/12345678-1234-4234-8234-123456789abc');
 assert.equal(Object.hasOwn(sent,'site'),false);
});
test('ordered conversation writes reject caller-supplied From instead of silently ignoring it',async()=>{
 await assert.rejects(businessAction('galaxy_link',{
  action:'record_ordered',scopeid:'lo3rwang',
  conversation_id:'https://chatgpt.com/c/12345678-1234-4234-8234-123456789abc',
  updated_at:'2026-11-26T07:00:00.000Z',title:'Conversation',site:'ChatGPT',
  records:[{message_id:'m1',source_order:0,parent_id:null,role:'user',text:'hello'}]
 },'delegated-token',{},async()=>{throw Error('must not call LOC');}),
 /derived by LOC from the conversation URL/);
});

