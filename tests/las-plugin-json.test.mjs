import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../plugins/chrome/background.js',import.meta.url),'utf8');
const content=readFileSync(new URL('../plugins/chrome/content.js',import.meta.url),'utf8');
const start=source.indexOf('async function readChatgptSourceInPage(');
const end=source.indexOf('\nasync function captureChatgptOriginalSequence(',start);
assert.ok(start>0&&end>start,'Source parser must remain available');
const code='('+source.slice(start,end)+')';
const THREAD='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function sourceReader(conversationResponse){
  const calls=[];
  const fetch=async path=>{
    calls.push(path);
    if(path==='/api/auth/session')return new Response('',{status:403});
    if(path.startsWith('/backend-api/conversation/'))return conversationResponse;
    throw Error('Unexpected request '+path);
  };
  const context=vm.createContext({
    fetch,Response,ReadableStream,TextDecoder,URL,console,
    location:{hostname:'chatgpt.com',pathname:'/c/'+THREAD},
    document:{title:'Source test'}
  });
  return {read:vm.runInContext(code,context),calls};
}

test('LAS Plugins accepts small ordered source without returning raw JSON',async()=>{
  const body=JSON.stringify({
    conversation_id:THREAD,title:'對話',current_node:'one',mapping:{
      one:{parent:null,message:{id:'turn1',author:{role:'user'},
        content:{parts:['Hello LAS']}}}
    }
  });
  const obj=sourceReader(new Response(body,{headers:{'content-type':'application/json'}}));
  const result=await obj.read(THREAD,true);
  assert.equal(result.status,'ok');
  assert.equal(result.messages.length,1);
  assert.equal(result.messages[0].text,'Hello LAS');
  assert.equal(result.messages[0].source_order,0);
  assert.equal(Object.hasOwn(result,'mapping'),false);
  assert.equal(Object.hasOwn(result,'raw'),false);
});

test('LAS Plugins refuses oversized JSON by header without reading body',async()=>{
  const obj=sourceReader(new Response('not json',{
    headers:{'content-type':'application/json','content-length':String(2*1024*1024+1)}
  }));
  assert.equal((await obj.read(THREAD,true)).status,'source-too-large');
});

test('LAS Plugins cancels a headerless oversized JSON stream before parsing',async()=>{
  let cancelled=false;
  const body=new ReadableStream({
    start(controller){controller.enqueue(new Uint8Array(2*1024*1024+1));},
    cancel(){cancelled=true;}
  });
  const obj=sourceReader(new Response(body,{
    headers:{'content-type':'application/json'}
  }));
  const result=await obj.read(THREAD,false);
  assert.equal(result.status,'source-too-large');
  assert.equal(cancelled,true);
});

test('LAS Plugins does not duplicate each conversation text into content',()=>{
  assert.doesNotMatch(content,/content:'\\['\\+row\\.role/);
  assert.match(content,/fingerprint\\(typeof item\\.text==='string'\\?item\\.text:item\\.content\\)/);
  assert.match(content,/offset<pending\\.length;offset\\+=12/);
});

test('LAS Plugins Queue status uses IDB count instead of JSON materialization',()=>{
  const status=source.slice(source.indexOf("case 'loc-status':{"),source.indexOf("case 'loc-clear-local-captures':{"));
  assert.match(status,/queueCount\\(\\)/);
  assert.doesNotMatch(status,/scanQueue\\(/);
  const badge=source.slice(source.indexOf('async function updateQueueBadge('),
    source.indexOf('async function clearLegacyTabBadges('));
  assert.match(badge,/queueCount\\(\\)/);
  assert.doesNotMatch(badge,/scanQueue\\(/);
});
