import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync,readdirSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const common=['auth','deployment','impeccable','mcp-builder','media',
 'security-audit','skill-creator','sql','superpowers','ui-ux-pro-max',
 'visualization','web','writing-guidelines'];
const las=['mcp-gateway','tunnel-mapping','chrome-extension','native-packaging','cloudflare-access'];

test('LAS contains the same 13 core skill entrypoints plus five channel-specific guides',()=>{
 const names=readdirSync(new URL('../.agents/skills/',import.meta.url)).sort();
 assert.deepEqual(names,[...common,...las].sort());
 for(const name of names){
   const path='.agents/skills/'+name+'/SKILL.md';
   assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
   const content=read(path);
   assert.ok(content.startsWith('---\nname: '+name+'\ndescription: "'),path+' frontmatter');
   assert.ok(content.length>250,path+' insufficient skill description');
 }
});
test('LAS AGENTS defines six modules and self-executing verification without cross repo changes',()=>{
 const content=read('AGENTS.md');
 for(const id of ['las:auth','las:plugins','las:mcp','las:tunnel','las:ipa','las:apk'])
   assert.ok(content.includes(id),'missing '+id);
 for(const term of ['EsotericVerse/lunarcus','main','CI','SSO','測試','授權'])
   assert.ok(content.includes(term),'missing '+term);
 assert.ok(read('.agents/SKILL-LINKS.md').includes('LOC 基礎能力'));
 assert.equal(JSON.parse(read('skills-lock.json')).version,1);
});
test('LAS channel skills refer to existing implementation paths',()=>{
 const checks=[
 ['mcp-builder','app/las/mcp/router.mjs'],
 ['mcp-gateway','app/las/mcp/tool-contracts.mjs'],
 ['tunnel-mapping','app/las/tunnel/loc-mapping.mjs'],
 ['chrome-extension','plugins/chrome/'],
 ['native-packaging','.github/workflows/ios-device-build.yml'],
 ['cloudflare-access','services/workers/lunarcus/auth.mjs']
 ];
 for(const [skill,path] of checks){
   assert.ok(read('.agents/skills/'+skill+'/SKILL.md').includes(path),skill+' path');
   assert.ok(existsSync(new URL('../'+path,import.meta.url)),path+' missing');
 }
});
