import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const root=new URL('../plugins/chrome/',import.meta.url);
const declarations=readFileSync(new URL('conversation-source.zmodel',root),'utf8');
const source=readFileSync(new URL('conversation-source-model.js',root),'utf8');
const bridge=readFileSync(new URL('content.js',root),'utf8');
const background=readFileSync(new URL('background.js',root),'utf8');
const vm={};
runInNewContext(source,vm);
const registry=vm.LasConversationSourceModel;
const node=({role,id,text,selector,busy=false})=>({
  matches:q=>q.split(',').map(x=>x.trim()).includes(role),
  getAttribute:key=>key==='data-message-id'?id:null,
  querySelector:q=>busy&&q==='[aria-busy="true"]'?{}:
    q.split(',').includes(selector)?{text}:null,
  closest:()=>null,
  text
});
const callbacks={visible:()=>true,readText:el=>el.text,fingerprint:content=>content};
test('LOC #1765 source value-type pattern: all declared conversation fields are modeled',()=>{
  const fields=['role','content','sourceId','key'];
  for(const profile of Object.values(registry.sources)){
    const block=declarations.match(new RegExp('type '+profile.model+' \\{([\\s\\S]*?)\\}'));
    assert.ok(block,'Missing virtual ZModel '+profile.model);
    const declared=block[1].trim().split(/\r?\n/).map(line=>line.trim().split(/\s+/)[0]);
    assert.deepEqual(declared,fields);
    const name=profile.model==='ChatGPTConversationTurn'?'chatgpt':
      profile.model==='ClaudeConversationTurn'?'claude':'gemini';
    assert.equal(registry.profileFor(name,profile.source).model,profile.model);
  }
  assert.equal(registry.profileFor('gemini','evil.gemini.google.com'),null);
  assert.equal(registry.profileFor('claude','gemini.google.com'),null);
  assert.ok(!declarations.includes('model '),'No persistent DB model or migration');
});
test('Gemini extracts only declared user and assistant turn bodies',()=>{
  const profile=registry.sources.gemini;
  const rows=[
    node({role:'user-query',id:'u1',selector:'.query-text',text:'user question'}),
    node({role:'model-response',id:'a1',selector:'.markdown',text:'assistant answer'}),
    node({role:'model-response',id:'busy',selector:'.markdown',text:'streaming',busy:true}),
    node({role:'sidebar',id:'side',selector:'.markdown',text:'sidebar'})
  ];
  const result=registry.project(profile,{querySelectorAll:()=>rows},{
    ...callbacks,includeAssistant:true
  });
  assert.deepEqual(Array.from(result,r=>r.role),['user','assistant']);
  assert.deepEqual(Array.from(result,r=>r.content),['user question','assistant answer']);
  assert.equal(new Set(Array.from(result,r=>r.key)).size,2);
});
test('Claude no longer silently invents assistant content from a user-only snapshot',()=>{
  const profile=registry.sources.claude;
  const user=node({role:'[data-testid="user-message"]',id:'u1',
    selector:'[data-testid="user-message"]',text:'question'});
  const body={querySelectorAll:()=>[user]};
  assert.throws(()=>registry.project(profile,body,{...callbacks,includeAssistant:true}),/無法辨識/);
  assert.equal(registry.project(profile,body,{...callbacks,includeAssistant:true,record:true}).length,1);
});
test('LLM source capture registry is injected and used; no duplicated per-platform parser',()=>{
  assert.ok(background.includes("'capture-source-model.js','conversation-source-model.js','source-temporal-order.js','content.js'"));
  assert.match(bridge,/LasConversationSourceModel/);
  assert.match(bridge,/registry\.project\(profile/);
  assert.doesNotMatch(bridge,/const selector=provider==='gemini'/);
});
