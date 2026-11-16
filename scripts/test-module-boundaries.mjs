import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('global module identities and owner-defined module taxonomy',()=>{
  const doc=read('docs/MODULE-ARCHITECTURE.md');
  for(const key of ['lo3r@loc','lo3r@lrs','lo3r@las',
    'loc:galaxy','loc:time','loc:locus','loc:site','loc:dialect',
    'lrs:rune','lrs:boardgame','lrs:card','lrs:daily',
    'las:auth','las:plugins','las:mcp','las:tunnel','las:ipa','las:apk'])
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
  const worker=JSON.parse(read('services/workers/las-mcp/wrangler.jsonc'));
  assert.deepEqual(worker.routes,[],'Must not silently rebind live MCP hostname');
});
test('IPA workflow pins the same LOC commit across validation and native build',()=>{
  const source=read('.github/workflows/ios-device-build.yml');
  assert.ok(source.includes('loc_sha: ${{ steps.meta.outputs.loc_sha }}'));
  assert.ok(source.includes('lrs_commit: ${{ steps.meta.outputs.lrs_commit }}'));
  assert.ok(source.includes('ref: ${{ needs.guard.outputs.lrs_commit }}'));
  assert.ok(source.includes('consume-lrs-ios-artifacts.mjs'));
  assert.ok(source.includes("if: ${{ needs.guard.outputs.lrs_commit != '' }}"));
  assert.ok(source.includes('ref: ${{ needs.guard.outputs.loc_sha }}'));
  assert.ok(source.includes("$(git rev-parse HEAD)"));
  assert.ok(source.includes('workflow_dispatch:'));
  assert.ok(!/on:\s*\n\s+push:/.test(source),'IPA must be manual');
});
test('ISR is not a hidden required Auth dependency',()=>{
  const doc=read('docs/ISR-HANDOFF.md');
  assert.ok(doc.includes('loc-isr'));
  assert.ok(doc.includes('off by default'));
  assert.ok(!existsSync(new URL('../services/workers/las-isr/wrangler.jsonc',import.meta.url)),
    'Do not claim source migration is finished when ISR source is unavailable');
});
