import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
const lock=JSON.parse(readFileSync(resolve(root,'package-lock.json'),'utf8'));
assert.deepEqual(lock.packages[''].dependencies,pkg.dependencies,'Auth package-lock dependencies must match');
assert.equal(lock.name,pkg.name);
for(const name of ['mysql2','tedious','next','sharp','three'])assert.ok(!pkg.dependencies[name],'LunArcus root unexpectedly includes '+name);
const files=[
  'services/workers/lunarcus/index.mjs',
  'services/workers/lunarcus/auth.mjs',
  'services/workers/lunarcus/extension-client.mjs',
  'plugins/chrome/manifest.json',
  'plugins/chrome/background.js',
  'plugins/chrome/content.js',
  'plugins/chrome/icons/loc-favicon.png',
  'plugins/chrome/assets/lunarcus-rainbow-hero.avif',
  'public/plugins/chrome/oauth/client.json',
  'public/plugins/chrome/oauth/config.json',
  '.github/workflows/deploy-lunarcus-auth.yml',
  '.github/workflows/deploy-las-mcp.yml'
];
for(const file of files)assert.ok(existsSync(resolve(root,file)),'Missing migration asset: '+file);
assert.ok(!existsSync(resolve(root,'.github/workflows/ios-device-build.yml')),'IPA workflow belongs to LOC, not LAS');
const authFiles=['index.mjs','auth.mjs','auth-qos.mjs','pg-driver.mjs','extension-client.mjs'];
for(const name of authFiles){
 const file=resolve(root,'services/workers/lunarcus',name);
 const contents=readFileSync(file,'utf8');
 for(const match of contents.matchAll(/from\s+['"]([.][^'"]+)['"]/g)){
  const candidate=resolve(dirname(file),match[1]);
  assert.ok(existsSync(candidate),name+' has missing relative import '+match[1]);
 }
}
const source=readFileSync(resolve(root,'wrangler.jsonc'),'utf8');
const legacy=JSON.parse(readFileSync(resolve(root,'services/workers/lunarcus/wrangler.jsonc'),'utf8'));
const {main:legacyMain,...legacyOptions}=legacy;
const rootConfig=JSON.parse(source);
const {main:rootMain,...rootOptions}=rootConfig;
assert.equal(rootMain,'./services/workers/lunarcus/index.mjs','Root deploy must target LAS Auth, not MCP');
assert.deepEqual(rootOptions,legacyOptions,'Root and nested Auth Worker settings must match');
assert.deepEqual(rootConfig.previews,{},'The default root config must support Workers Previews');
const wrangler=JSON.parse(source);
assert.equal(wrangler.name,'lunarcus','Target the existing LunArcus Worker script, never create auth');
assert.equal(wrangler.routes?.[0]?.pattern,'auth.lo3rwang.cc');
assert.equal(wrangler.routes?.[0]?.custom_domain,true,'Keep the current Auth custom domain');
assert.equal(wrangler.workers_dev,false,'Do not open a new workers.dev Auth issuer');
const manifest=JSON.parse(readFileSync(resolve(root,'plugins/chrome/manifest.json'),'utf8'));
const client=JSON.parse(readFileSync(resolve(root,'public/plugins/chrome/oauth/client.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.equal(client.client_id,'lunarcus','LAS public OAuth client ID must match LunArcus');
assert.ok(manifest.key,'Preserve installed Chrome Extension identity');
console.log('LunArcus migration contracts: PASS ('+files.length+' checked paths, PostgreSQL-only dependencies)');
