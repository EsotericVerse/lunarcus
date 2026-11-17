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
