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
  'extensions/lunarcus-galaxy-link/manifest.json',
  'extensions/lunarcus-galaxy-link/background.js',
  'extensions/lunarcus-galaxy-link/content.js',
  'extensions/lunarcus-galaxy-link/icons/loc-favicon.png',
  'extensions/lunarcus-galaxy-link/assets/lunarcus-rainbow-hero.avif',
  'public/extension/oauth/client.json',
  'public/extension/oauth/config.json',
  '.github/workflows/deploy-lunarcus-auth.yml',
  '.github/workflows/ios-device-build.yml'
];
for(const file of files)assert.ok(existsSync(resolve(root,file)),'Missing migration asset: '+file);
const authFiles=['index.mjs','auth.mjs','auth-qos.mjs','pg-driver.mjs','extension-client.mjs'];
for(const name of authFiles){
 const file=resolve(root,'services/workers/lunarcus',name);
 const contents=readFileSync(file,'utf8');
 for(const match of contents.matchAll(/from\s+['"]([.][^'"]+)['"]/g)){
  const candidate=resolve(dirname(file),match[1]);
  assert.ok(existsSync(candidate),name+' has missing relative import '+match[1]);
 }
}
const source=readFileSync(resolve(root,'services/workers/lunarcus/wrangler.jsonc'),'utf8');
const wrangler=JSON.parse(source);
assert.equal(wrangler.name,'auth','Keep existing Cloudflare Worker identity');
assert.equal(wrangler.routes?.[0]?.pattern,'auth.lo3rwang.cc');
const manifest=JSON.parse(readFileSync(resolve(root,'extensions/lunarcus-galaxy-link/manifest.json'),'utf8'));
const client=JSON.parse(readFileSync(resolve(root,'public/extension/oauth/client.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.equal(client.client_id,'loc-galaxy-link','Preserve existing Extension OAuth identity');
assert.ok(manifest.key,'Preserve installed Chrome Extension identity');
console.log('LunArcus migration contracts: PASS ('+files.length+' checked paths, PostgreSQL-only dependencies)');
