import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMcpToolArgs} from '../server/mcp/tool-contracts.mjs';
import {privateGalaxyLink} from '../server/tunnel/loc-mapping.mjs';

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
