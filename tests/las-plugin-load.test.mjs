import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const source=readFileSync(new URL('../plugins/chrome/background.js',import.meta.url),'utf8');
function boot(url){
  const calls=[];
  const events={addListener(){}};
  const chrome={
    runtime:{getURL:path=>'chrome-extension://testing/'+path,
      onInstalled:events,onStartup:events,onMessage:events},
    action:{onClicked:events},
    alarms:{onAlarm:events},
    contextMenus:{onShown:events,onClicked:events},
    tabs:{get:async()=>({id:123,url})},
    scripting:{executeScript:async(args)=>{
      if(typeof args.func==='function')return [{result:false}];
      calls.push(args.files);
      return [];
    }}
  };
  const context=vm.createContext({chrome,URL,TextEncoder,crypto:webcrypto,
    console,setTimeout,clearTimeout});
  vm.runInContext(source,context,{filename:'plugins/chrome/background.js'});
  return {calls,inject:()=>vm.runInContext('inject(123)',context),
    toEvents:(items)=>vm.runInContext('toEvents',context)(items)};
}
test('LAS Plugins does not inject ChatGPT vendor into unrelated sites',async()=>{
  for(const url of ['https://example.org/page','https://claude.ai/new',
    'https://gemini.google.com/app/xyz','https://www.threads.net/@author']){
    const plugin=boot(url);
    await plugin.inject();
    assert.equal(plugin.calls.length,1);
    assert.equal(plugin.calls[0].at(-1),'content.js');
    assert.equal(plugin.calls[0].includes('vendor/ChatGPTShadowExtract.js'),false);
  }
});
test('LAS Plugins injects ChatGPT vendor before content only on ChatGPT',async()=>{
  for(const url of ['https://chatgpt.com/c/abcd','https://chat.openai.com/c/abcd']){
    const plugin=boot(url);
    await plugin.inject();
    assert.equal(plugin.calls.length,1);
    assert.equal(plugin.calls[0][0],'vendor/ChatGPTShadowExtract.js');
    assert.equal(plugin.calls[0].at(-1),'content.js');
  }
});
test('LAS Plugins imports original source-order turns without text duplication',async()=>{
  const plugin=boot('https://chatgpt.com/c/abcd');
  const records=await plugin.toEvents([{
    source_key:'https://chatgpt.com/c/abcd',
    url:'https://chatgpt.com/c/abcd',
    title:'原始對話',role:'user',message_id:'turn-a',source_order:0,
    order_evidence:'source-ordinal',parent_id:null,text:'長文字只應存一次'
  }]);
  assert.equal(records.length,1);
  const row=records[0];
  assert.equal(row.kind,'ordered_conversation');
  assert.equal(row.text,'長文字只應存一次');
  assert.equal(row.source_order,0);
  assert.equal(Object.hasOwn(row,'content'),false);
});
test('LAS Plugins rejects unordered source turns and still requires article content',async()=>{
  const plugin=boot('https://chatgpt.com/c/abcd');
  await assert.rejects(plugin.toEvents([{
    source_key:'https://chatgpt.com/c/abcd',
    url:'https://chatgpt.com/c/abcd',
    role:'user',message_id:'turn-a',text:'no order'
  }]),/來源沒有可靠的原始訊息序號/);
  assert.equal((await plugin.toEvents([{
    url:'https://example.org/entry',title:'空文章'
  }])).length,0);
});
