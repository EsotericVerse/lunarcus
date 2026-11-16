import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('global module identities and owner-defined module taxonomy',()=>{
  const doc=read('docs/MODULE-ARCHITECTURE.md');
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
  assert.ok(read('services/workers/lunarcus/index.mjs').includes("if(url.hostname==='mcp.lo3rwang.cc')"));
  assert.ok(read('services/workers/lunarcus/index.mjs').includes("import mcpWorker from './mcp.mjs'"));
  assert.ok(existsSync(new URL('../services/workers/lunarcus/mcp.mjs',import.meta.url)));
  assert.ok(!existsSync(new URL('../services/workers/las-mcp/index.mjs',import.meta.url)),
    'Do not keep a second MCP Worker entrypoint');
  assert.ok(!existsSync(new URL('../services/workers/las-mcp/wrangler.jsonc',import.meta.url)),
    'Do not recreate a second MCP deployment target');
});
test('native IPA packaging belongs to LOC and is absent from LAS',()=>{
  const doc=read('docs/MODULE-ARCHITECTURE.md');
  assert.ok(doc.includes('EsotericVerse/lunacodex/.github/workflows/ios-device-build.yml'));
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
  const doc=read('docs/ISR-HANDOFF.md');
  assert.ok(doc.includes('loc-isr'));
  assert.ok(doc.includes('off by default'));
  assert.ok(!existsSync(new URL('../services/workers/las-isr/wrangler.jsonc',import.meta.url)),
    'Do not claim source migration is finished when ISR source is unavailable');
});
