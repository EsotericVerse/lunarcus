import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import worker from '../app/las/index.mjs';
import {checkLocAuthEnvironment} from '../app/las/auth/auth.mjs';
import {authKaraulRatePolicy} from '../app/las/auth/auth-qos.mjs';
import {RAINBOW_TABLES} from '../app/las/auth/rainbow-tables.mjs';
import {extensionClientDiscovery} from '../app/las/auth/extension-client.mjs';
import {rainbowSchema} from '../app/las/auth/rainbow-zmodel.mjs';

const BASE='https://auth.lo3rwang.cc';
const EXTENSION='chrome-extension://hiaeafonocnjaclcfgjmdopbcgnafnna';
const WEB='https://loc.lo3rwang.cc';

const request=(path,init={})=>worker.fetch(new Request(BASE+path,init),{});

test('Routine Session and OAuth resource reads have no shared-IP admission quota',()=>{
  const rules=authKaraulRatePolicy.customRules;
  for(const path of ['/jwks','/get-session','/oauth2/userinfo','/oauth2/introspect'])
    assert.equal(rules[path],false,'Read endpoint must not self-throttle: '+path);
  const budget=rules['/**'];
  const native={window:60,max:120};
  const limited=path=>budget(new Request(BASE+'/api/auth'+path,{headers:{
    'cf-connecting-ip':'192.0.2.5'
  }}),native);
  assert.deepEqual(limited('/oauth2/token'),{window:60,max:40});
  assert.deepEqual(limited('/oauth2/authorize'),{window:60,max:60});
  assert.deepEqual(limited('/oauth2/register'),{window:60,max:5});
  assert.deepEqual(limited('/sign-in/social'),native);
});

test('LunArcus Auth health metadata needs no database, secrets or session',async()=>{
  const response=await request('/health');
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{
    service:'LOC Auth',module:'better-auth',
    issuer:BASE
  });
});

test('LunArcus login is Google OAuth only; Cloudflare Access SSO was removed 2026-11-17',async()=>{
  const response=await request('/login');
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type')||'',/text\/html/);
  const html=await response.text();
  assert.match(html,/id="oauth"/);
  assert.doesNotMatch(html,/id="sso"/);
  assert.match(html,/\/api\/auth\/sign-in\/social/);
  assert.doesNotMatch(html,/\/api\/auth\/sign-in\/sso/);
  assert.doesNotMatch(html,/cloudflare-access/);
  assert.match(response.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
});

test('LunArcus never serves canonical Auth routes under a different hostname',async()=>{
  const response=await worker.fetch(new Request('https://some-other.example/health'),{});
  assert.equal(response.status,404);
  const bogus=await request('/missing');
  assert.equal(bogus.status,404);
});

test('LunArcus rejects unsigned OAuth consent before opening a database',async()=>{
  const response=await request('/consent');
  assert.equal(response.status,400);
  assert.match(await response.text(),/Signed OAuth request required/);
});

test('LunArcus rejects browser requests from unknown origins',async()=>{
  const res=await request('/login',{headers:{Origin:'https://attacker.example'}});
  assert.equal(res.status,403);
  const preflight=await request('/login',{method:'OPTIONS',headers:{
    Origin:'https://attacker.example'}});
  assert.equal(preflight.status,403);
});

test('LunArcus preflight only adds credential access for known website origin',async()=>{
  const website=await request('/login',{method:'OPTIONS',headers:{Origin:WEB}});
  assert.equal(website.status,204);
  assert.equal(website.headers.get('access-control-allow-origin'),WEB);
  assert.equal(website.headers.get('access-control-allow-credentials'),'true');
  const extension=await request('/login',{method:'OPTIONS',headers:{Origin:EXTENSION}});
  assert.equal(extension.status,204);
  assert.equal(extension.headers.get('access-control-allow-origin'),EXTENSION);
  assert.equal(extension.headers.get('access-control-allow-credentials'),null);
});

test('Public OAuth protocol preflight remains public without allowing session credentials',async()=>{
  const response=await request('/api/auth/oauth2/token',{method:'OPTIONS',
    headers:{Origin:'https://client.example'}});
  assert.equal(response.status,204);
  assert.equal(response.headers.get('access-control-allow-origin'),'*');
  assert.equal(response.headers.get('access-control-allow-credentials'),null);
});

test('LAS requires LAS_DATABASE_URL and maps all twelve models to existing las_* tables',()=>{
  const env={
    LAS_DATABASE_URL:'postgresql://test:test@database.example.test:5432/las',
    LOC_CONTROL_ENCRYPTION_KEY:'x'.repeat(48),
    GOOGLE_CLIENT_ID:'test-client',
    GOOGLE_CLIENT_SECRET:'test-secret'
  };
  assert.equal(checkLocAuthEnvironment(env),true);
  assert.throws(()=>checkLocAuthEnvironment({
    ...env,LAS_DATABASE_URL:undefined
  }),/LAS requires PostgreSQL/);
  assert.throws(()=>checkLocAuthEnvironment({
    ...env,GOOGLE_CLIENT_ID:undefined,GOOGLE_CLIENT_SECRET:undefined
  }),/requires Google OAuth credentials/);
  const mapped=Object.values(RAINBOW_TABLES);
  assert.equal(mapped.length,12);
  assert.equal(new Set(mapped).size,12);
  const modelSnapshot=JSON.stringify(rainbowSchema.models);
  for(const table of mapped){
    assert.match(table,/^las_[a-z_]+$/);
    assert.ok(modelSnapshot.includes('"value":"'+table+'"'),
      'ZenStack must use the physical PostgreSQL table '+table);
  }
  assert.doesNotMatch(modelSnapshot,/"value":"rainbow_/);
});

test('LunArcus public OAuth client is discoverable without dynamic registration',async()=>{
  const extension=extensionClientDiscovery();
  assert.equal(extension.id,'lunarcus');
  assert.equal(extension.matches('lunarcus'),true);
  assert.equal(extension.matches('legacy-client'),false);
  const client=await extension.resolve({},'lunarcus',null);
  assert.equal(client.clientId,'lunarcus');
  assert.equal(client.name,'LunArcus');
  assert.equal(client.requirePKCE,true);
  assert.equal(client.tokenEndpointAuthMethod,'none');
  assert.deepEqual(client.redirectUris,[
    'https://hiaeafonocnjaclcfgjmdopbcgnafnna.chromiumapp.org/loc'
  ]);
});

test('Existing LunArcus Worker serves MCP without opening an Auth DB',async()=>{
  const origin='https://mcp.lo3rwang.cc';
  const resource=await worker.fetch(new Request(origin+'/.well-known/oauth-protected-resource'),{});
  assert.equal(resource.status,200);
  const metadata=await resource.json();
  assert.equal(metadata.resource,origin);
  assert.deepEqual(metadata.authorization_servers,['https://auth.lo3rwang.cc/api/auth']);
  const challenge=await worker.fetch(new Request(origin+'/mcp'),{});
  assert.equal(challenge.status,401);
  assert.match(challenge.headers.get('www-authenticate')||'',/^Bearer /);
  const disallowed=await worker.fetch(new Request(origin+'/api/auth/get-session'),{});
  assert.equal(disallowed.status,404);
});


test('OAuth consent UI requests JSON and handles approve/deny redirects',async()=>{
  // Better Auth returns a 302 redirect without Accept: application/json.
  // fetch() would follow it instead of receiving {redirect:true,url}, leaving
  // the consent screen on a generic "Consent failed" status.
  const src=readFileSync(new URL('../app/las/index.mjs',import.meta.url),'utf8');
  const match=src.match(/^const CONSENT_JS=("(?:\\.|[^"\\])*");/m);
  assert.ok(match,'Consent page must have a testable, self-contained script');
  const script=JSON.parse(match[1]);
  const signed='client_id=lunarcus&scope=openid%20email&redirect_uri=https%3A%2F%2Fexample.test%2Fcallback&sig=test-signature';
  for(const accept of [true,false]){
    const elements=new Map();
    const byId=id=>{
      if(!elements.has(id))elements.set(id,{textContent:'',onclick:null});
      return elements.get(id);
    };
    let destination='',call=null;
    const context={
      URLSearchParams,
      document:{getElementById:byId},
      location:{assign:url=>{destination=url}},
      fetch:async(path,options)=>{
        call={path,options};
        return {ok:true,status:200,json:async()=>({
          redirect:true,url:'https://example.test/callback?state=verified'
        })};
      }
    };
    runInNewContext('const OAUTH_QUERY='+JSON.stringify(signed)+';\n'+script,context);
    assert.equal(byId('client').textContent,'lunarcus');
    await byId(accept?'approve':'deny').onclick();
    assert.equal(call.path,'/api/auth/oauth2/consent');
    assert.equal(call.options.method,'POST');
    assert.equal(call.options.credentials,'include');
    assert.equal(call.options.headers.accept,'application/json');
    const payload=JSON.parse(call.options.body);
    assert.equal(payload.accept,accept);
    assert.equal(payload.oauth_query,signed,'Use the original verified signed query');
    assert.equal(payload.scope,'openid email');
    assert.equal(destination,'https://example.test/callback?state=verified');
    assert.equal(byId('status').textContent,'');
  }
});

test('OAuth consent UI reports HTTP failures without redirecting',async()=>{
  const src=readFileSync(new URL('../app/las/index.mjs',import.meta.url),'utf8');
  const script=JSON.parse(src.match(/^const CONSENT_JS=("(?:\\.|[^"\\])*");/m)[1]);
  const elements=new Map();
  const byId=id=>{
    if(!elements.has(id))elements.set(id,{textContent:'',onclick:null});
    return elements.get(id);
  };
  let navigations=0;
  runInNewContext('const OAUTH_QUERY="client_id=lunarcus&sig=test";\n'+script,{
    URLSearchParams,
    document:{getElementById:byId},
    location:{assign:()=>{navigations++}},
    fetch:async()=>({ok:false,status:503,json:async()=>({})})
  });
  await byId('approve').onclick();
  assert.equal(navigations,0);
  assert.equal(byId('status').textContent,'Consent failed (HTTP 503)');
});
