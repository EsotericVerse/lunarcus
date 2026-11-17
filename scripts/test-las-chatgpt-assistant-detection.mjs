import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const folder=new URL('../plugins/chrome/',import.meta.url);
const vendor=readFileSync(new URL('vendor/ChatGPTShadowExtract.js',folder),'utf8');
const temporal=readFileSync(new URL('source-temporal-order.js',folder),'utf8');
const content=readFileSync(new URL('content.js',folder),'utf8');
const url='https://chatgpt.com/g/g-project/c/6af8ff99-6b54-83ee-8ee5-06f99616d940';

function createTurn(role,order,{label=false,marker=true}={}){
  const attributes={
    'data-testid':'conversation-turn-'+order,
    'data-turn-index':String(order),
    'data-message-id':'message-'+order,
    ...(label?{'aria-label':role==='assistant'?'ChatGPT said':'You said'}:{})
  };
  const text=role==='assistant'?'The assistant response text.':'The user question text.';
  const body={innerText:text,textContent:text,childNodes:[],tagName:'DIV',
    querySelector:()=>null,getAttribute:()=>null};
  const child={
    getAttribute(name){return name==='data-testid'?role+'-message':null;},
    querySelector:()=>null,querySelectorAll:()=>[],innerText:text,textContent:text,
    closest(selector){return selector.includes('conversation-turn-')?turn:null;}
  };
  const turn={
    getAttribute(name){return attributes[name]||null;},
    querySelector(selector){
      if(selector==='[data-testid="'+role+'-message"]')return marker?child:null;
      if(selector==='.markdown'&&role==='assistant')return body;
      if(selector==='.whitespace-pre-wrap'&&role==='user')return body;
      if(selector==='[data-message-id],[data-chatgpt-selection-message-id]')return child;
      return null;
    },
    querySelectorAll:()=>[],
    closest(selector){return selector.includes('conversation-turn-')?turn:null;},
    innerText:text,textContent:text
  };
  return {turn,child};
}
function setup(roles){
  let listener,inserted=[];
  const pairs=roles.map((role,i)=>createTurn(role,i,{label:i===1,marker:i!==1}));
  const domNodes=pairs.flatMap(({turn,child},i)=>i===1?[turn]:[turn,child]);
  const main={
    ownerDocument:null,
    querySelector:()=>null,
    querySelectorAll(selector){
      if(selector==='[data-message-author-role]'||selector==='[data-chatgpt-search-unit-key]')return [];
      if(selector.includes('[data-testid^="conversation-turn-"]'))return domNodes;
      return [];
    }
  };
  const document={
    title:'ChatGPT assistant detection regression',
    body:main,querySelector(selector){return selector==='main'?main:null;},
    querySelectorAll:()=>[],getElementById:()=>null,
    documentElement:{appendChild(){}}
  };
  main.ownerDocument=document;
  const context=vm.createContext({
    document,location:{href:url,hostname:'chatgpt.com'},URL,Element:class {},
    getComputedStyle:()=>({display:'block',visibility:'visible'}),
    window:{addEventListener(){},removeEventListener(){}},
    setTimeout(){return 1;},clearTimeout(){},console,
    chrome:{runtime:{
      onMessage:{addListener(fn){listener=fn;}},
      async sendMessage(message){
        if(message.type==='items.captured'){
          inserted.push(...message.items);
          return {queued:inserted.length,insertedCaptures:message.items.length};
        }
        return {};
      }
    }}
  });
  vm.runInContext(temporal,context,{filename:'source-temporal-order.js'});
  vm.runInContext(vendor,context,{filename:'ChatGPTShadowExtract.js'});
  vm.runInContext(content,context,{filename:'content.js'});
  return {context,document,main,listener:()=>listener,inserted};
}
async function capture(fixture,includeAssistant=true){
  return new Promise(resolve=>{
    const keep=fixture.listener()({type:'page.capture',selection:'',includeAssistant},null,resolve);
    assert.equal(keep,true);
  });
}
test('assistant turn is recognized from explicit accessible role on a ChatGPT project chat',async()=>{
  const fixture=setup(['user','assistant']);
  const reply=await capture(fixture,true);
  assert.equal(reply.error,undefined,String(reply.error));
  assert.equal(reply.user,1);
  assert.equal(reply.assistant,1);
  assert.equal(reply.detected,2);
  assert.deepEqual(fixture.inserted.map(r=>r.role),['user','assistant']);
  assert.deepEqual(fixture.inserted.map(r=>r.source_order),[0,1]);
  assert.ok(fixture.inserted.every(r=>r.source_key==='https://chatgpt.com/c/6af8ff99-6b54-83ee-8ee5-06f99616d940'));
});
test('assistant marker is recognized on standalone conversation-turn markup without search-unit keys',async()=>{
  const fixture=setup(['assistant','user']);
  const reply=await capture(fixture,true);
  assert.equal(reply.error,undefined,String(reply.error));
  assert.equal(reply.assistant,1);
  assert.equal(reply.user,1);
  assert.equal(new Set(fixture.inserted.map(r=>r.message_id)).size,2);
  assert.equal(fixture.inserted.length,2,'nested assistant marker is not duplicated');
});
test('user-only mounted viewport preserves user text with explicit warning, without fabricating an AI reply',async()=>{
  const fixture=setup(['user']);
  const reply=await capture(fixture,true);
  assert.equal(reply.error,undefined,String(reply.error));
  assert.equal(reply.detected,1);
  assert.equal(reply.user,1);
  assert.equal(reply.assistant,0);
  assert.equal(reply.queuedCaptures,1);
  assert.match(reply.message,/目前載入範圍未辨識到 AI 回覆/);
  assert.equal(fixture.inserted.length,1);
});
test('include AI setting off never records assistant reply even when it is rendered',async()=>{
  const fixture=setup(['user','assistant']);
  const reply=await capture(fixture,false);
  assert.equal(reply.error,undefined,String(reply.error));
  assert.equal(reply.user,1);
  assert.equal(reply.assistant,0);
  assert.equal(fixture.inserted.length,1);
});

test('nested search-unit user wrapper never suppresses a distinct assistant reply',()=>{
  const ctx=vm.createContext({});
  vm.runInContext(temporal,ctx);
  vm.runInContext(vendor,ctx);
  function unit(role,order,text,id,parent){
    const attrs={
      'data-chatgpt-search-unit-key':'fallback-turn-'+order+':2:'+role,
      'data-chatgpt-selection-message-id':id
    };
    const bubble={innerText:text,textContent:text,
      querySelector:()=>null,getAttribute:()=>null};
    const obj={
      getAttribute:key=>attrs[key]||null,innerText:text,textContent:text,
      parentElement:parent?{closest:selector=>selector==='[data-chatgpt-search-unit-key]'?parent:null}:null,
      querySelector:selector=>role==='user'&&selector.includes('[data-user-message-bubble]')
        ?bubble:null,
      querySelectorAll:()=>[],closest:()=>null
    };
    return obj;
  }
  const user=unit('user',2,'Question','user-stable-id',null);
  const assistant=unit('assistant',3,'Answer','assistant-stable-id',user);
  const source={
    querySelectorAll(selector){
      if(selector==='[data-message-author-role]')return [];
      if(selector==='[data-chatgpt-search-unit-key]')return [user,assistant];
      return selector.includes('[data-chatgpt-search-unit-key]')
        ?[user,assistant]:[];
    }
  };
  const rows=ctx.ChatGPTShadowExtract.extractMessages(source);
  assert.deepEqual(Array.from(rows,r=>r.role),['user','assistant']);
  assert.deepEqual(Array.from(rows,r=>r.id),['user-stable-id','assistant-stable-id']);
  assert.deepEqual(Array.from(rows,r=>r.source_order),[2,3]);
});
