import './test-las-capture-source-model.mjs';
import './test-las-conversation-source-model.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const root=new URL('../',import.meta.url);
const extension=new URL('../plugins/chrome/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',extension),'utf8'));
const bundled=JSON.parse(readFileSync(new URL('oauth-config.json',extension),'utf8'));
const canonical=JSON.parse(readFileSync(new URL('public/plugins/chrome/oauth/config.json',root),'utf8'));
const background=readFileSync(new URL('background.js',extension),'utf8');
const client=JSON.parse(readFileSync(new URL('public/plugins/chrome/oauth/client.json',root),'utf8'));
const EXTENSION_ID='hiaeafonocnjaclcfgjmdopbcgnafnna';
const EXTENSION_ORIGIN='chrome-extension://'+EXTENSION_ID;
const LOC_IMPORT='https://loc.lo3rwang.cc/api/loc-native';

function makeRuntime({config=bundled}={}){
  const values=new Map(),requests=[],listeners={};
  const listen=name=>({addListener:fn=>{listeners[name]=fn}});
  const chrome={
    runtime:{
      id:EXTENSION_ID,
      getURL:path=>EXTENSION_ORIGIN+'/'+path,
      onInstalled:listen('installed'),onStartup:listen('startup'),
      onMessage:listen('message')
    },
    contextMenus:{onClicked:listen('menu'),onShown:listen('shown')},
    action:{onClicked:listen('action')},
    alarms:{onAlarm:listen('alarm')},
    storage:{local:{
      async get(keys){
        const list=typeof keys==='string'?[keys]:keys||[];
        return Object.fromEntries(list.filter(k=>values.has(k)).map(k=>[k,values.get(k)]));
      },
      async set(items){for(const [k,v] of Object.entries(items))values.set(k,v);}
    }}
  };
  const metadata={issuer:config.issuer,
    authorization_endpoint:'https://auth.lo3rwang.cc/api/auth/oauth2/authorize',
    token_endpoint:'https://auth.lo3rwang.cc/api/auth/oauth2/token'};
  const mockFetch=async(url,options={})=>{
    requests.push({url:String(url),options});
    if(String(url)===EXTENSION_ORIGIN+'/oauth-config.json')
      return new Response(JSON.stringify(config),{status:200,headers:{'content-type':'application/json'}});
    if(String(url)==='https://auth.lo3rwang.cc/.well-known/oauth-authorization-server/api/auth')
      return new Response(JSON.stringify(metadata),{status:200,headers:{'content-type':'application/json'}});
    if(String(url)==='https://mcp.lo3rwang.cc/'){
      const rpc=JSON.parse(options.body);
      const records=rpc.params?.arguments?.records||[];
      return Response.json({jsonrpc:'2.0',id:rpc.id,result:{
        structuredContent:{accepted:true,uid:'ABCD1234',count:records.length,
          messages:records.length},
        content:[{type:'text',text:'accepted'}]
      }});
    }
    if(String(url)===LOC_IMPORT){
      const body=JSON.parse(options.body);
      return new Response(JSON.stringify({
        accepted:true,id:body.batch.id,
        articles:body.batch.records.map(r=>({
          source_key:r.source_key,uid:'ABCD1234',appended:1,duplicate:false
        }))
      }),{status:200,headers:{'content-type':'application/json'}});
    }
    throw new Error('Unexpected network request '+url);
  };
  const sandbox={chrome,fetch:mockFetch,URL,URLSearchParams,TextEncoder,crypto:webcrypto,
    Response,Headers,Request,console,Date,setTimeout,clearTimeout,TextDecoder};
  vm.createContext(sandbox);
  vm.runInContext(background,sandbox,{filename:'background.js'});
  return {sandbox,requests,values};
}

test('LAS Extension packages its own OAuth config without changing Chrome identity',()=>{
  assert.deepEqual(bundled,canonical);
  assert.equal(manifest.name,'LunArcus');
  assert.equal(manifest.short_name,'LunArcus');
  assert.equal(manifest.action.default_title,'LunArcus');
  assert.match(background,/title:'LunArcus',contexts:/);
  const html=readFileSync(new URL('options.html',extension),'utf8');
  const pages=readFileSync(new URL('options-pages.js',extension),'utf8');
  for(const text of [html,pages])assert.doesNotMatch(text,/galaxy[ -]?link|彩虹橋/i);
  assert.doesNotMatch(html,/LOC 彩虹橋|LOC galaxy-link/);
  assert.equal(bundled.issuer,'https://auth.lo3rwang.cc/api/auth');
  assert.equal(bundled.client_id,'lunarcus');
  assert.equal(client.client_id,'lunarcus');
  assert.equal(client.client_name,'LunArcus');
  assert.equal(bundled.import_url,LOC_IMPORT);
  // Resource identifier remains backward-compatible with LOC token validation.
  assert.equal(bundled.resource,'https://mcp.lo3rwang.cc');
  assert.equal(manifest.key.length>300,true);
  assert.equal(client.redirect_uris[0],
    'https://'+EXTENSION_ID+'.chromiumapp.org/loc');
  assert.match(background,/chrome\.runtime\.getURL\('oauth-config\.json'\)/);
});

test('Extension discovers OAuth from its packaged config; short-import goes to LOC, never MCP',async()=>{
  const {sandbox,requests,values}=makeRuntime();
  const config=await vm.runInContext('getConfig()',sandbox);
  assert.equal(config.client_id,client.client_id);
  assert.equal(config.import_url,LOC_IMPORT);
  assert.equal(values.get('locConfig').import_url,LOC_IMPORT);
  assert.equal(requests[0].url,EXTENSION_ORIGIN+'/oauth-config.json');
  const batch={id:'test-batch',records:[{source_key:'https://example.test/article'}]};
  const result=await vm.runInContext(
    "sendViaAuth('lo3rwang',batch,'test-token',config)",
    Object.assign(sandbox,{batch,config}));
  assert.equal(result.accepted,true);
  assert.deepEqual(requests.map(r=>r.url),[
    EXTENSION_ORIGIN+'/oauth-config.json',
    'https://auth.lo3rwang.cc/.well-known/oauth-authorization-server/api/auth',
    LOC_IMPORT
  ]);
  assert.equal(requests.at(-1).options.headers.authorization,'Bearer test-token');
  assert.equal(values.has('locOAuth'),false,'no fake OAuth login or token persistence');
});

test('Extension rejects obsolete MCP short-import endpoints without writing',async()=>{
  const {sandbox,requests}=makeRuntime({config:{...bundled,import_url:'https://mcp.lo3rwang.cc/api/loc-native'}});
  await assert.rejects(vm.runInContext('getConfig()',sandbox),/認證/);
  assert.equal(requests.length,1,'invalid configuration must not contact OAuth or import APIs');
});

test('LunArcus clean install uses the new public OAuth client ID',async()=>{
  const {sandbox,requests,values}=makeRuntime();
  const config=await vm.runInContext('getConfig()',sandbox);
  assert.equal(config.client_id,'lunarcus');
  assert.equal(values.get('locConfig').client_id,'lunarcus');
  assert.match(background,/const clientId='lunarcus'/);
  assert.doesNotMatch(background,/loc-galaxy-link|upgradedImportConfig/);
  assert.ok(requests.every(item=>item.url!=='https://mcp.lo3rwang.cc/api/loc-native'));
});


test('Extension MCP uses LAS gateway without a user-selectable upstream Provider Hub',()=>{
  const options=readFileSync(new URL('options.html',extension),'utf8');
  const code=readFileSync(new URL('options.js',extension),'utf8');
  assert.ok(!options.includes('id="providers"'),'Inert MCP-only panel is removed');
  assert.ok(!options.includes('href="#providers"'),'No dead navigation links');
  assert.ok(options.includes('id="includeAI"'),'AI replies are a user-controlled preference');
  for(const removed of [
    'mcpProviders','ssoEmail','locSsoEmail','mcp-connect','mcp-disconnect',
    'mcp-status','MCP_PROVIDER_API','MCP_EXTENSION_RETURN',
    '/api/mcp-provider-extension','normalizeSsoEmail','connectMcpProvider',
    'disconnectMcpProvider','mcpProviderRequest'
  ]){
    assert.ok(!background.includes(removed),'Obsolete Provider runtime: '+removed);
    assert.ok(!code.includes(removed),'Obsolete Provider settings: '+removed);
  }
  assert.ok(!options.includes('id="mcpProviders"'));
  assert.ok(!options.includes('id="ssoEmail"'));
  assert.ok(!options.includes('mcp-connect'));
  assert.equal(bundled.resource,'https://mcp.lo3rwang.cc');
  assert.equal(bundled.import_url,LOC_IMPORT,'LOC data import remains independent');
});

test('conversation fragments without source order never enter the Queue',async()=>{
  const {sandbox}=makeRuntime();
  await assert.rejects(
    vm.runInContext("toEvents([{source_key:'https://chatgpt.com/c/abc',url:'https://chatgpt.com/c/abc',key:'turn-1',content:'[user]\\nquestion'}],'lo3rwang')",sandbox),
    /來源沒有可靠的原始訊息序號/
  );
  for(const host of ['chatgpt.com','chat.openai.com','claude.ai','gemini.google.com']){
    assert.match(background,new RegExp(host.replaceAll('.','\\.')));
  }
  assert.ok(background.includes('includeAssistant:includeAssistant===true'));
  assert.ok(background.includes("function partitionQueueForFlush(pending)"));
 assert.ok(background.includes("row.reviewed===true&&!blocked.has("));
  assert.match(background,/legacyConversationCount/);
});

test('options views contain only live actions and no obsolete Provider pages',()=>{
 const options=readFileSync(new URL('options.html',extension),'utf8');
 const pages=readFileSync(new URL('options-pages.js',extension),'utf8');
 const styles=readFileSync(new URL('options.css',extension),'utf8');
 const js=readFileSync(new URL('options.js',extension),'utf8');
 const functional=['overview','daily','capture','activity','settings'];
 for(const id of functional){
  assert.ok(options.includes('id="'+id+'"'),'Missing functional page '+id);
  assert.ok(options.includes('href="#'+id+'"'),'Missing navigation '+id);
  assert.ok(pages.includes(id+':'),'Unregistered view '+id);
 }
 for(const token of ['providers:', 'provider-grid','provider-actions','mcpProviders',
   'Provider Vault','id="providers"','href="#providers"']){
  assert.ok(!options.includes(token),'Stale options markup: '+token);
  assert.ok(!pages.includes(token),'Stale route: '+token);
  assert.ok(!styles.includes(token),'Stale CSS: '+token);
 }
 assert.ok(js.includes("$('includeAI').addEventListener('change'"));
 assert.ok(options.includes('id="scope"'));
 assert.ok(options.includes('id="flush"'));
 assert.ok(options.includes('id="connect"'));
 assert.ok(options.includes('id="diagnostics"'));
 assert.equal(bundled.resource,'https://mcp.lo3rwang.cc');
});

test('ordered source turns have stable Queue identities independent of arrival time',async()=>{
 const {sandbox}=makeRuntime();
 const source='https://chatgpt.com/c/6af8ff99-6b54-83ee-8ee5-06f99616d940';
 const items=[{source_key:source,url:source,title:'Conversation',role:'assistant',
   message_id:'msg-100',source_order:100,parent_id:'msg-99',
   order_evidence:'source-ordinal',text:'answer',
   content:'[assistant]\\nanswer'},
   {source_key:source,url:source,title:'Conversation',role:'user',
   message_id:'msg-20',source_order:20,parent_id:'msg-19',
   order_evidence:'source-ordinal',text:'question',
   content:'[user]\\nquestion'}];
 const records=await vm.runInContext('toEvents(orderedItems,\'lo3rwang\')',
   Object.assign(sandbox,{orderedItems:items}));
 assert.equal(records.length,2);
 assert.equal(records[0].kind,'ordered_conversation');
 assert.equal(records[0].source_order,100);
 assert.equal(records[1].source_order,20);
 assert.ok(records[0].id!==records[1].id);
 const repeat=await vm.runInContext('toEvents(orderedItems,\'lo3rwang\')',sandbox);
 assert.equal(records[0].id,repeat[0].id);
 assert.equal(records[1].id,repeat[1].id);
});
test('ordered Queue goes only to canonical MCP tool, validates receipt',async()=>{
 const {sandbox,requests}=makeRuntime();
 const src='https://chatgpt.com/c/6af8ff99-6b54-83ee-8ee5-06f99616d940';
 const queued=[{id:'event-1',kind:'ordered_conversation',scopeid:'lo3rwang',
   source_key:src,url:src,title:'Conversation',message_id:'msg-20',
   source_order:20,parent_id:null,role:'user',text:'question'}];
 const receipt=await vm.runInContext(
   'sendOrderedConversation(\'lo3rwang\',orderedRows,\'test-token\',config)',
   Object.assign(sandbox,{orderedRows:queued,config:bundled}));
 assert.equal(receipt.accepted,true);
 assert.equal(requests.length,1);
 assert.equal(requests[0].url,'https://mcp.lo3rwang.cc/');
 assert.equal(requests[0].options.headers.authorization,'Bearer test-token');
 const body=JSON.parse(requests[0].options.body);
 assert.equal(body.params.name,'galaxy_link');
 assert.equal(body.params.arguments.action,'record_ordered');
 assert.equal(body.params.arguments.records[0].source_order,20);
 assert.equal(body.params.arguments.records[0].message_id,'msg-20');
 assert.equal(requests.some(req=>req.url===LOC_IMPORT),false);
});

test('six function keys include pre-send message organizer without restoring provider selection',()=>{
 const html=readFileSync(new URL('options.html',extension),'utf8');
 const pages=readFileSync(new URL('options-pages.js',extension),'utf8');
 const js=readFileSync(new URL('options.js',extension),'utf8');
 for(const id of ['overview','daily','capture','organize','activity','settings']){
  assert.ok(html.includes('id="'+id+'"'),'Missing page: '+id);
  assert.equal((html.match(new RegExp('data-page="'+id+'"','g'))||[]).length,1);
  assert.ok(pages.includes(id+':'),'Missing page registration: '+id);
 }
 assert.match(html,/id="organizeGroups"/);
 assert.match(html,/id="organizeRefresh"/);
 assert.ok(js.includes("call('conversation.review')"));
 assert.ok(js.includes("call('conversation.approve'"));
 assert.ok(js.includes("call('loc-flush')"));
 assert.ok(!html.includes('href="#providers"'));
 assert.ok(!html.includes('mcpProviders'));
});
test('pre-send organizer restores source order, but blocks duplicate ordinals and quarantines legacy',()=>{
 const {sandbox}=makeRuntime();
 const base={scopeid:'lo3rwang',kind:'ordered_conversation',
  order_evidence:'source-ordinal',
  source_key:'https://chatgpt.com/c/6af8ff99-6b54-83ee-8ee5-06f99616d940',
  title:'Test',role:'user',text:'message'};
 const items=[
  {...base,id:'late',message_id:'m100',source_order:100},
  {...base,id:'early',message_id:'m20',source_order:20},
  {id:'legacy',kind:'capture',source_key:base.source_key,url:base.source_key,
    content:'[user]\\nold'}
 ];
 const preview=vm.runInContext('reviewGroups(organizeRows)',
  Object.assign(sandbox,{organizeRows:items}));
 assert.equal(preview.ordered_count,2);
 assert.equal(preview.legacy_count,1);
 assert.equal(preview.conversations[0].valid,true);
 assert.equal(preview.conversations[0].ready,false);
 assert.equal(preview.conversations[0].messages[0].source_order,20);
 assert.equal(preview.conversations[0].messages[1].source_order,100);
 const duplicate=vm.runInContext('reviewGroups(organizeRows)',
  Object.assign(sandbox,{organizeRows:[items[0],{...items[1],source_order:100}]}));
 assert.equal(duplicate.conversations[0].valid,false);
 assert.ok(background.includes("function partitionQueueForFlush(pending)"));
 assert.ok(background.includes("row.reviewed===true&&!blocked.has("));
 assert.ok(background.includes("sender?.id!==chrome.runtime.id"));
});

test('source unit ordinal enters a stable local ordered Queue record',async()=>{
 const {sandbox}=makeRuntime();
 const url='https://chatgpt.com/c/6af8ff99-6b54-83ee-8ee5-06f99616d940';
 const item={url,source_key:url,role:'assistant',message_id:'real-msg-13',
  source_order:13,order_evidence:'source-conversation-turn',parent_id:null,
  text:'answer',content:'[assistant]\\nanswer'};
 const rows=await vm.runInContext("toEvents([sourceTurn],'lo3rwang')",
   Object.assign(sandbox,{sourceTurn:item}));
 assert.equal(rows.length,1);
 assert.equal(rows[0].kind,'ordered_conversation');
 assert.equal(rows[0].source_order,13);
 assert.equal(rows[0].message_id,'real-msg-13');
});
test('automatic flush excludes every previously reviewed turn when its source has new unreviewed turns',()=>{
 const {sandbox}=makeRuntime();
 const src='https://chatgpt.com/c/6af8ff99-6b54-83ee-8ee5-06f99616d940';
 const base={kind:'ordered_conversation',scopeid:'lo3rwang',source_key:src,
   order_evidence:'source-ordinal'};
 const prepared=[
  {...base,id:'a',source_order:4,reviewed:true},
  {...base,id:'b',source_order:2,reviewed:false},
  {...base,id:'c',source_order:7,reviewed:true},
  {id:'unrelated',kind:'capture',source_key:'https://example.org/a'}
 ];
 const pending=vm.runInContext('partitionQueueForFlush(reviewPending)',
   Object.assign(sandbox,{reviewPending:prepared}));
 assert.equal(pending.ordered.length,0,'No partial conversation is sent');
 assert.equal(pending.unreviewed.length,1);
 assert.equal(pending.rows.length,1,'Unrelated page capture remains available');
 const approved=vm.runInContext('partitionQueueForFlush(reviewPending)',
   Object.assign(sandbox,{reviewPending:prepared.slice(0,3).map(r=>({...r,reviewed:true}))}));
 assert.deepEqual(Array.from(approved.ordered,x=>x.id),['a','b','c']);
});
test('full local turn preview is trusted extension settings only and never injected into a website',()=>{
 const js=readFileSync(new URL('options.js',extension),'utf8');
 assert.ok(js.includes("call('conversation.turn'"));
 assert.ok(js.includes("organizerElement('pre','organize-turn-full'"));
 assert.ok(background.includes("case 'conversation.turn':"));
 assert.ok(background.includes("sender?.id!==chrome.runtime.id"));
 assert.ok(background.includes("row.kind!=='ordered_conversation'"));
});

test('include AI replies checkbox stays functional for both capture and passive recording',async()=>{
 const {sandbox}=makeRuntime();
 const options=readFileSync(new URL('options.html',extension),'utf8');
 const code=readFileSync(new URL('options.js',extension),'utf8');
 assert.match(options,/id="includeAI" type="checkbox"/);
 assert.match(options,/一併保存 AI 回覆/);
 assert.ok(code.includes("chrome.storage.local.get(['locTargetScope','locIncludeAssistant'])"));
 assert.ok(code.includes("chrome.storage.local.set({locIncludeAssistant:next})"));
 // Exercise the actual Extension functions rather than only checking strings.
 vm.runInContext(`
  inject=async()=>{};
  queueCount=async()=>0;
  chrome.tabs={
    sendMessage:async(id,msg)=>{
      globalThis.lastCaptureMessage=msg;
      return msg.type==='page.capture'
        ?{directQueued:true,detected:1,user:1,assistant:0,queuedCaptures:0,
          message:'captured'}
        :{ok:true,mode:'record'};
    }
  };`,sandbox);
 const tab={id:22,url:'https://chatgpt.com/c/6af8ff99-6b54-83ee-8ee5-06f99616d940'};
 for(const enabled of [false,true]){
   sandbox.inputTab=tab;
   sandbox.inputAI=enabled;
   await vm.runInContext("capture(inputTab,'',inputAI)",sandbox);
   assert.equal(sandbox.lastCaptureMessage.includeAssistant,enabled);
   await vm.runInContext("selectOrRecord('page.record',inputAI,inputTab)",sandbox);
   assert.equal(sandbox.lastCaptureMessage.includeAssistant,enabled);
 }
});

test('unverified legacy window-relative chronology is quarantined, even when marked reviewed',async()=>{
 const {sandbox}=makeRuntime();
 const src='https://chatgpt.com/c/6af8ff99-6b54-83ee-8ee5-06f99616d940';
 const rows=[{id:'old',kind:'ordered_conversation',scopeid:'lo3rwang',
   source_key:src,message_id:'msg-old',source_order:9,role:'user',
   text:'old',reviewed:true,order_evidence:'source-unit-ordinal'}];
 const pending=vm.runInContext('partitionQueueForFlush(untrusted)',
   Object.assign(sandbox,{untrusted:rows}));
 assert.equal(pending.ordered.length,0);
 assert.equal(pending.unreviewed.length,1);
 const review=vm.runInContext('reviewGroups(untrusted)',sandbox);
 assert.equal(review.conversations[0].valid,false);
 await assert.rejects(vm.runInContext("toEvents([untrustedInput],'lo3rwang')",
   Object.assign(sandbox,{untrustedInput:{...rows[0],
     source_key:src,url:src,content:'[user]\nold'}})),/來源沒有可靠的原始訊息序號/);
});

const conversationIdForRead='6af8ff99-6b54-83ee-8ee5-06f99616d940';
const fullConversationFixture=()=>{
 const content=(role,text,id,channel='final')=>({
  id,author:{role},content:{content_type:'text',parts:[text]},
  metadata:{channel}
 });
 return {conversation_id:conversationIdForRead,title:'Source graph demo',
  // Object key order deliberately disagrees with the source parent chain.
  current_node:'reply-2',mapping:{
   'reply-2':{parent:'user-2',message:content('assistant','answer two','a2')},
   'user-1':{parent:'root',message:content('user','question one','u1')},
   'root':{parent:null,message:null},
   'hidden':{parent:'reply-1',message:content('assistant','private reasoning','hidden','analysis')},
   'user-2':{parent:'hidden',message:content('user','question two','u2')},
   'reply-1':{parent:'user-1',message:content('assistant','answer one','a1')}
  }};
};
function sourceReadRuntime(payload=fullConversationFixture()){
 const {sandbox}=makeRuntime();
 sandbox.location={hostname:'chatgpt.com',pathname:'/c/'+conversationIdForRead};
 sandbox.document={title:'On-screen conversation'};
 const calls=[];
 sandbox.fetch=async (url,options={})=>{
  calls.push({url,options});
  return Response.json(payload,{headers:{'content-type':'application/json'}});
 };
 return {sandbox,calls};
}
test('ChatGPT first-party parent graph yields original sequence, never mapping order or capture time',async()=>{
 const {sandbox,calls}=sourceReadRuntime();
 sandbox.threadIdForRead=conversationIdForRead;
 const output=await vm.runInContext(
   'readChatgptSourceInPage(threadIdForRead,true)',sandbox);
 assert.equal(output.status,'ok');
 assert.equal(output.title,'Source graph demo');
 assert.deepEqual(Array.from(output.messages,x=>x.message_id),['u1','a1','u2','a2']);
 assert.deepEqual(Array.from(output.messages,x=>x.source_order),[1,2,4,5]);
 assert.deepEqual(Array.from(output.messages,x=>x.role),['user','assistant','user','assistant']);
 assert.equal(output.messages.some(x=>x.text.includes('private reasoning')),false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'/backend-api/conversation/'+conversationIdForRead);
 assert.equal(calls[0].options.credentials,'same-origin');
 assert.equal(calls[0].options.method,'GET');
});
test('Include AI off excludes assistant content without losing original user ordinals',async()=>{
 const {sandbox}=sourceReadRuntime();
 sandbox.threadIdForRead=conversationIdForRead;
 const output=await vm.runInContext(
   'readChatgptSourceInPage(threadIdForRead,false)',sandbox);
 assert.equal(output.status,'ok');
 assert.deepEqual(Array.from(output.messages,x=>x.source_order),[1,4]);
 assert.ok(output.messages.every(x=>x.role==='user'));
});
test('source graph does not expose another conversation or ambiguous paginated records',async()=>{
 const {sandbox,calls}=sourceReadRuntime();
 sandbox.threadIdForRead=conversationIdForRead;
 sandbox.location.pathname='/c/00000000-0000-4000-8000-000000000000';
 let output=await vm.runInContext(
   'readChatgptSourceInPage(threadIdForRead,true)',sandbox);
 assert.equal(output.status,'changed-conversation');
 assert.equal(calls.length,0,'No requests are issued for another chat');
 const second=sourceReadRuntime({...fullConversationFixture(),has_more:true});
 second.sandbox.threadIdForRead=conversationIdForRead;
 output=await vm.runInContext(
   'readChatgptSourceInPage(threadIdForRead,true)',second.sandbox);
 assert.equal(output.status,'source-paginated');
});
test('successful original graph snapshot enters Queue without touching page scroll or DOM',async()=>{
 const {sandbox}=sourceReadRuntime();
 let injected=0,queued=null;
 sandbox.chrome.scripting={
  executeScript:async({target,world,func,args})=>{
   injected++;
   assert.equal(target.tabId,7);
   assert.equal(world,'MAIN');
   assert.equal(args[0],conversationIdForRead);
   return [{result:await func(...args)}];
  }};
 sandbox.spyRows=rows=>{queued=rows};
 vm.runInContext(
  'acceptItems=async rows=>{spyRows(rows);return {detected:rows.length,insertedCaptures:rows.length,message:"queued"}}',
  sandbox);
 sandbox.tabForRead={id:7,url:'https://chatgpt.com/c/'+conversationIdForRead};
 const receipt=await vm.runInContext('capture(tabForRead,"",true)',sandbox);
 assert.equal(injected,1);
 assert.equal(receipt.read_source,'original-message-chain');
 assert.equal(receipt.insertedCaptures,4);
 assert.equal(queued.length,4);
 assert.deepEqual(Array.from(queued,row=>row.source_order),[1,2,4,5]);
 assert.ok(queued.every(row=>row.order_evidence==='source-ordinal'));
 assert.ok(queued.every(row=>row.source_key==='https://chatgpt.com/c/'+conversationIdForRead));
});

test('incomplete source graph is not misreported as the full conversation',async()=>{
 const incomplete=fullConversationFixture();
 incomplete.mapping['paginated-root']={parent:null,message:null};
 const {sandbox}=sourceReadRuntime(incomplete);
 sandbox.threadIdForRead=conversationIdForRead;
 const output=await vm.runInContext('readChatgptSourceInPage(threadIdForRead,true)',sandbox);
 assert.equal(output.status,'source-paginated');
});
test('ChatGPT forbidden original source returns a precise reason without guessing DOM order',async()=>{
 const {sandbox}=sourceReadRuntime();
 sandbox.fetch=async()=>new Response('',{status:403});
 sandbox.threadIdForRead=conversationIdForRead;
 const output=await vm.runInContext('readChatgptSourceInPage(threadIdForRead,true)',sandbox);
 assert.equal(output.status,'source-http-403');
 let requested=0;
 sandbox.chrome.scripting={executeScript:async()=>{requested++;return [{result:output}]}};
 vm.runInContext("inject=async()=>{}",sandbox);
 sandbox.chrome.tabs={sendMessage:async()=>({
  error:'來源沒有可靠的原始訊息序號；不使用頁面位置或 Queue 時間排序'})};
 sandbox.tabForRead={id:7,url:'https://chatgpt.com/c/'+conversationIdForRead};
 await assert.rejects(vm.runInContext('capture(tabForRead,"",true)',sandbox),
  /ChatGPT 原始對話讀取遭拒（403）/);
 assert.equal(requested,1,'Do not retry unauthorized source reads');
});
