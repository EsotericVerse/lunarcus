import assert from 'node:assert/strict';
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const skillsRoot=join(root,'.agents','skills');
const shared=['auth','deployment','impeccable','mcp-builder','media',
  'security-audit','skill-creator','sql','superpowers','ui-ux-pro-max',
  'visualization','web','writing-guidelines'];
const las=['better-auth','oauth-oidc','cloudflare-workers','chrome-extensions',
  'mcp-transport','mcp-gateway','tunnel-data-mapping','native-packaging',
  'protocol-security','protocol-testing','plugin-architecture','observability'];
const expected=[...shared,...las];
const actual=readdirSync(skillsRoot,{withFileTypes:true})
  .filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
assert.deepEqual(actual,[...expected].sort(),
  'LAS requires all 13 locally installed shared skills and all 12 LAS specialists');

for(const name of expected){
  const path=join(skillsRoot,name,'SKILL.md');
  assert.ok(existsSync(path),'Missing LAS-local skill: '+name);
  const content=readFileSync(path,'utf8');
  const match=content.match(/^---\r?\nname: ([a-z0-9-]+)\r?\ndescription: "?([^\r\n]+)"?\r?\n---\r?\n/);
  assert.ok(match,'Invalid skill frontmatter: '+name);
  assert.equal(match[1],name,'Skill metadata must match directory: '+name);
  assert.ok(match[2].length>=8,'Skill description too short: '+name);
  assert.ok(content.length>300,'Placeholder skill is not an installed working guide: '+name);
}
const rules=readFileSync(join(root,'AGENTS.md'),'utf8');
for(const moduleName of ['las:auth','las:plugins','las:mcp','las:tunnel','las:ipa','las:apk'])
  assert.ok(rules.includes(moduleName),'LAS AGENTS.md missing module: '+moduleName);
for(const boundary of ['LOC','LRS','Cloudflare','RLS','OAuth','MCP'])
  assert.ok(rules.includes(boundary),'LAS agent boundary missing: '+boundary);
assert.ok(existsSync(join(root,'.agents','SKILL-LINKS.md')),
  'LAS must include an on-demand reference index');
assert.ok(existsSync(join(root,'.github','skills','kysely-postgres-las','SKILL.md')),
  'LAS PostgreSQL/Kysely boundary skill missing');
console.log('LAS agent skills: PASS ('+shared.length+' core + '+las.length+
  ' specialist = '+expected.length+' locally installed, AGENTS.md six modules)');
