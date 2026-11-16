import assert from 'node:assert/strict';
import {test} from 'node:test';
import worker from '../services/workers/lunarcus/index.mjs';
import {checkLocAuthEnvironment} from '../services/workers/lunarcus/auth.mjs';
import {RAINBOW_TABLES} from '../services/workers/lunarcus/rainbow-tables.mjs';
import {extensionClientDiscovery} from '../services/workers/lunarcus/extension-client.mjs';
import {rainbowSchema} from '../services/workers/lunarcus/rainbow-zmodel.mjs';

const BASE='https://auth.lo3rwang.cc';
const EXTENSION='chrome-extension://hiaeafonocnjaclcfgjmdopbcgnafnna';
const WEB='https://loc.lo3rwang.cc';

const request=(path,init={})=>worker.fetch(new Request(BASE+path,init),{});

test('LunArcus Auth health metadata needs no database, secrets or session',async()=>{
  const response=await request('/health');
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{
    service:'LOC Auth',module:'better-auth',
    issuer:BASE
  });
});

test('LunArcus preserves both Google OAuth and Cloudflare SSO login choices',async()=>{
  const response=await request('/login');
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type')||'',/text\/html/);
  const html=await response.text();
  assert.match(html,/id="oauth"/);
  assert.match(html,/id="sso"/);
  assert.match(html,/\/api\/auth\/sign-in\/social/);
  assert.match(html,/\/api\/auth\/sign-in\/sso/);
  assert.match(html,/cloudflare-access/);
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
    LOC_CLOUDFLARE_SSO_ISSUER:
      'https://access.example.test/cdn-cgi/access/sso/oidc/test-client',
    LOC_CLOUDFLARE_SSO_CLIENT_ID:'test-client',
    LOC_CLOUDFLARE_SSO_CLIENT_SECRET:'test-secret'
  };
  assert.equal(checkLocAuthEnvironment(env),true);
  assert.throws(()=>checkLocAuthEnvironment({
    ...env,LAS_DATABASE_URL:undefined
  }),/LAS requires PostgreSQL/);
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
