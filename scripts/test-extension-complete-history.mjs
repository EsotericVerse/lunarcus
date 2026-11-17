import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const folder=new URL('../plugins/chrome/',import.meta.url);
const temporal=readFileSync(new URL('source-temporal-order.js',folder),'utf8');
const vendor=readFileSync(new URL('vendor/ChatGPTShadowExtract.js',folder),'utf8');
const content=readFileSync(new URL('content.js',folder),'utf8');
const background=readFileSync(new URL('background.js',folder),'utf8');
const url='https://chatgpt.com/c/6af8ff99-6b54-83ee-8ee5-06f99616d940';
const count=80;
let listener,inserted=[],queued=0,cacheTop=NaN,mounted=[];
class Element {
  constructor(attrs={},text=''){this.attrs=attrs;this.innerText=text;this.textContent=text;}
  getAttribute(name){return this.attrs[name]||'';}
  querySelector(){return null;}
  querySelectorAll(){return [];}
  closest(){return null;}
  getClientRects(){return [{}];}
}
const scroller=new Element();
scroller.clientHeight=1000;scroller.scrollHeight=10000;
scroller.scrollTop=scroller.scrollHeight-scroller.clientHeight;
scroller.scrollTo=({top})=>{scroller.scrollTop=Math.max(0,Math.min(9000,top));};
scroller.contains=()=>true;
function visibleNodes(){
  if(cacheTop===scroller.scrollTop)return mounted;
  cacheTop=scroller.scrollTop;
  const first=Math.floor(scroller.scrollTop/9000*(count-9));
  mounted=Array.from({length:9},(_,k)=>{
    const i=first+k;
    const role=i%2?'assistant':'user';
    const node=new Element({
      'data-chatgpt-search-unit-key':'fallback-turn-'+i+':2:'+role,
      'data-chatgpt-selection-message-id':'real-message-'+i
    },'Same repeated words');
    node.parentElement=scroller;
    return node;
  });
  return mounted;
}
const main=new Element();
main.querySelector=sel=>sel.includes('data-chatgpt-search-unit-key')?visibleNodes()[0]:null;
main.querySelectorAll=sel=>{
  if(sel==='[data-message-author-role]')return [];
  if(sel.includes('data-chatgpt-search-unit-key'))return visibleNodes();
  return [];
};
const doc={
  title:'Virtualized 80 turns - ChatGPT',
  body:main,scrollingElement:scroller,documentElement:{appendChild(){}},
  querySelector(sel){return sel==='main'?main:null;},
  querySelectorAll(){return [];},
  addEventListener(){},removeEventListener(){},
  getElementById(){return null;},
  createElement(){return {style:{},setAttribute(){},remove(){}};}
};
const context=vm.createContext({
  document:doc,location:{href:url,hostname:'chatgpt.com'},URL,
  Element,innerHeight:1000,
  getComputedStyle:el=>({overflowY:el===scroller?'auto':'visible',display:'block',visibility:'visible'}),
  MutationObserver:class{observe(){}disconnect(){}},
  IntersectionObserver:class{observe(){}disconnect(){}},
  window:{addEventListener(){},removeEventListener(){}},
  setTimeout:fn=>{fn();return 1;},clearTimeout(){},
  chrome:{runtime:{
    onMessage:{addListener(fn){listener=fn}},
    async sendMessage(msg){
      if(msg.type==='items.captured'){
        inserted.push(...msg.items);
        queued+=msg.items.length;
        return {queued,insertedCaptures:msg.items.length};
      }
      return {queued};
    }
  }}
});
vm.runInContext(temporal,context,{filename:'source-temporal-order.js'});
vm.runInContext(vendor,context,{filename:'ChatGPTShadowExtract.js'});
vm.runInContext(content,context,{filename:'content.js'});

test('capture uses the currently mounted 9 turns and never scrolls the reader',async()=>{
  assert.equal(typeof listener,'function');
  const initialTop=scroller.scrollTop;
  const reply=await new Promise(resolve=>{
    const keepAlive=listener({type:'page.capture',selection:'',includeAssistant:true},null,resolve);
    assert.equal(keepAlive,true);
  });
  assert.equal(reply.error,undefined,String(reply.error));
  assert.equal(reply.detected,9);
  assert.equal(reply.user,4);
  assert.equal(reply.assistant,5);
  assert.equal(reply.partial,true);
  assert.equal(reply.queuedCaptures,9);
  assert.equal(inserted.length,9);
  assert.deepEqual(inserted.map(x=>x.source_order),[71,72,73,74,75,76,77,78,79]);
  assert.ok(inserted.every(x=>x.order_evidence==='source-unit-ordinal'));
  assert.ok(inserted.every(x=>x.message_id?.startsWith('real-message-')));

  assert.equal(new Set(inserted.map(item=>item.key)).size,9);
  assert.equal(scroller.scrollTop,initialTop,'reading position must remain unchanged');
  assert.match(reply.message,/不是完整歷史/);
});
test('nested GPT conversation URLs retain the saved chat identifier',()=>{
  assert.equal(
    context.ChatGPTShadowExtract.conversationIdFromUrl(
      'https://chatgpt.com/g/g-example/c/6af8ff99-6b54-83ee-8ee5-06f99616d940'),
    '6af8ff99-6b54-83ee-8ee5-06f99616d940');
});
test('capture does not probe external scrollbars or change scroll position',async()=>{
  const initialTop=scroller.scrollTop;
  inserted=[];queued=0;
  const reply=await new Promise(resolve=>{
    const keepAlive=listener({type:'page.capture',selection:'',includeAssistant:true},null,resolve);
    assert.equal(keepAlive,true);
  });
  assert.equal(reply.error,undefined,String(reply.error));
  assert.equal(reply.detected,9,'a snapshot must not claim 80 virtualized turns');
  assert.equal(reply.queuedCaptures,0,'repeat snapshot does not requeue messages');
  assert.equal(scroller.scrollTop,initialTop);
});
test('full-history auto-scroll loop is absent',()=>{
  assert.doesNotMatch(content,/setChatScroll|chatHistoryScroller|upSteps|downSteps/);
  assert.match(content,/未自動捲動/);
});
test('background accepts direct Queue acknowledgement rather than requiring one DOM snapshot',()=>{
  assert.ok(background.includes('reply?.directQueued===true'));
  assert.ok(background.includes('insertedCaptures:reply.queuedCaptures||0'));
});
