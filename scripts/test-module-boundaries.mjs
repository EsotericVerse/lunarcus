import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('global module identities and owner-defined module taxonomy',()=>{
  const doc=read('app/las/README.md');
  for(const key of ['lo3r@loc','lo3r@lrs','lo3r@las',
    'loc:galaxy','loc:time','loc:locus','loc:site','loc:dialect',
    'lrs:rune','lrs:boardgame','lrs:card','lrs:daily',
    'las:auth','las:plugins','las:mcp','las:tunnel'])
    assert.ok(doc.includes(key),'Missing module identifier '+key);
  for(const domain of ['loc.lo3rwang.cc','lrunes.lo3rwang.cc',
    'auth.lo3rwang.cc','mcp.lo3rwang.cc','isr.lo3rwang.cc'])
    assert.ok(doc.includes(domain),'Existing service address must remain: '+domain);
});
test('LAS gateway is separate from LOC models and uses fixed service contracts',()=>{
  assert.ok(existsSync(new URL('../app/las/mcp/loc-mapping.mjs',import.meta.url)));
  assert.ok(!existsSync(new URL('../app/loc/mcp/',import.meta.url)),
    'Do not ship the duplicate LOC MCP source snapshot in LAS');
  const mapping=read('app/las/tunnel/loc-mapping.mjs');
  const compatibility=read('app/las/mcp/loc-mapping.mjs');
  assert.ok(compatibility.includes("export * from '../tunnel/loc-mapping.mjs'"));
  assert.ok(mapping.includes('https://loc.lo3rwang.cc/api/las-native'));
  assert.ok(!mapping.includes('createKyselyDialect'));
  const worker=JSON.parse(read('wrangler.jsonc'));
  assert.equal(worker.name,'lunarcus','MCP shares the existing LAS Worker');
  assert.equal(worker.workers_dev,false);
  assert.deepEqual(worker.routes,[
    {pattern:'auth.lo3rwang.cc',custom_domain:true,zone_name:'lo3rwang.cc'},
    {pattern:'mcp.lo3rwang.cc',custom_domain:true,zone_name:'lo3rwang.cc'}
  ]);
  assert.ok(read('app/las/index.mjs').includes("if(url.hostname==='mcp.lo3rwang.cc')"));
  assert.ok(read('app/las/index.mjs').includes("import mcpWorker from './mcp/server.mjs'"));
  assert.ok(existsSync(new URL('../app/las/mcp/server.mjs',import.meta.url)));
  assert.ok(!existsSync(new URL('../services/workers/las-mcp/index.mjs',import.meta.url)),
    'Do not keep a second MCP Worker entrypoint');
  assert.ok(!existsSync(new URL('../services/workers/lunarcus/wrangler.jsonc',import.meta.url)),
    'Only root Wrangler config is authoritative');
  assert.ok(!existsSync(new URL('../services/workers/las-mcp/wrangler.jsonc',import.meta.url)),
    'Do not recreate a second MCP deployment target');
});
test('native IPA packaging belongs to LOC and is absent from LAS',()=>{
  for(const path of [
    '.github/workflows/ios-device-build.yml',
    'scripts/restore-lrs-native-ui.mjs',
    'scripts/consume-lrs-ios-artifacts.mjs',
    'scripts/test-ipa-workflow-metadata.mjs',
    'scripts/test-las-ipa-runes.mjs'
  ]) assert.ok(!existsSync(new URL('../'+path,import.meta.url)),
    'LOC-owned native source must not be duplicated in LAS: '+path);
});
test('ISR is not a hidden required Auth dependency',()=>{
  const doc=read('.agents/skills/deployment/SKILL.md');
  assert.ok(doc.includes('loc-isr'));
  assert.ok(doc.includes('off by default'));
  assert.ok(!existsSync(new URL('../services/workers/las-isr/wrangler.jsonc',import.meta.url)),
    'Do not claim source migration is finished when ISR source is unavailable');
});

test('LAS module boundaries do not require historical Markdown snapshots',()=>{
  // Deployment safety belongs to executable checks; archived handoff notes
  // are maintained in Slack rather than required by a code build.
  assert.ok(!existsSync(new URL('../docs/',import.meta.url)),
    'Do not recreate a centralized docs directory');
  for(const path of ['app/las/auth/auth.mjs','app/las/mcp/server.mjs',
    'app/las/tunnel/loc-mapping.mjs','plugins/chrome/manifest.json'])
    assert.ok(existsSync(new URL('../'+path,import.meta.url)),
      'LAS module entrypoint missing: '+path);
});

test('LAS-to-LOC GitHub dispatch is preserved in the moved single Worker',()=>{
  const entry=read('app/las/index.mjs');
  assert.ok(entry.includes("from './auth/loc-notification.mjs'"));
  assert.ok(entry.includes('handleLocDeploymentSignal(request,env)'));
  assert.ok(existsSync(new URL('../app/las/auth/loc-notification.mjs',import.meta.url)));
  assert.ok(!existsSync(new URL('../services/workers/lunarcus/loc-notification.mjs',import.meta.url)));
});
