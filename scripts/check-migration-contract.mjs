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
  'app/las/index.mjs',
  'app/las/auth/auth.mjs',
  'app/las/auth/extension-client.mjs',
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
const runtimeFiles=[
  'app/las/index.mjs',
  'app/las/auth/auth.mjs',
  'app/las/auth/auth-qos.mjs',
  'app/las/auth/pg-driver.mjs',
  'app/las/auth/extension-client.mjs',
  'app/las/auth/first-party-client.mjs',
  'app/las/mcp/server.mjs'
];
for(const name of runtimeFiles){
 const file=resolve(root,name);
 const contents=readFileSync(file,'utf8');
 for(const match of contents.matchAll(/from\s+['"]([.][^'"]+)['"]/g)){
  const candidate=resolve(dirname(file),match[1]);
  assert.ok(existsSync(candidate),name+' has missing relative import '+match[1]);
 }
}
const source=readFileSync(resolve(root,'wrangler.jsonc'),'utf8');
const rootConfig=JSON.parse(source);
assert.equal(rootConfig.main,'./app/las/index.mjs',
  'Root Wrangler must deploy the LAS root entrypoint');
assert.ok(!existsSync(resolve(root,'services/workers/lunarcus/wrangler.jsonc')),
  'Do not retain a duplicate Wrangler deployment config');
assert.deepEqual(rootConfig.previews,{},'The default root config must support Workers Previews');
const wrangler=JSON.parse(source);
assert.equal(wrangler.name,'lunarcus','Target the existing LunArcus Worker script, never create auth');
assert.equal(wrangler.routes?.[0]?.pattern,'auth.lo3rwang.cc');
assert.equal(wrangler.routes?.[0]?.custom_domain,true,'Keep the current Auth custom domain');
assert.deepEqual(wrangler.routes?.map(route=>route.pattern),['auth.lo3rwang.cc','mcp.lo3rwang.cc']);
assert.ok(wrangler.routes.every(route=>route.custom_domain===true));
assert.equal(wrangler.workers_dev,false,'Do not open a new workers.dev Auth issuer');
const manifest=JSON.parse(readFileSync(resolve(root,'plugins/chrome/manifest.json'),'utf8'));
const client=JSON.parse(readFileSync(resolve(root,'public/plugins/chrome/oauth/client.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.equal(client.client_id,'lunarcus','LAS public OAuth client ID must match LunArcus');
assert.ok(manifest.key,'Preserve installed Chrome Extension identity');
console.log('LunArcus migration contracts: PASS ('+files.length+' checked paths, PostgreSQL-only dependencies)');
