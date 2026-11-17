import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const js=readFileSync(new URL('../plugins/chrome/source-temporal-order.js',import.meta.url),'utf8');
const ctx={};runInNewContext(js,ctx);
const temporal=ctx.LasSourceTemporalOrder;
function element(attrs={},stamp=null){
 return {getAttribute:k=>attrs[k]??null,
  querySelector:selector=>selector==='time[datetime]'&&stamp
    ?{getAttribute:()=>stamp}:null};
}
test('prefers original source ordinal, not viewport position or capture time',()=>{
 const row=temporal.fromElement(element({'data-turn-index':'42',
  'data-parent-message-id':'previous'}));
 assert.equal(row.source_order,42);
 assert.equal(row.parent_id,'previous');
 assert.equal(row.order_evidence,'source-ordinal');
 assert.equal(temporal.fromElement(element()).source_order,null);
 assert.equal(temporal.fromElement(element({'data-message-index':'abc'})).source_order,null);
});
test('original timestamp is secondary evidence, never created from capture time',()=>{
 const row=temporal.fromElement(element({},'2026-11-18T01:02:03Z'));
 assert.equal(row.source_order,null);
 assert.equal(row.sent_at,'2026-11-18T01:02:03.000Z');
 assert.equal(row.order_evidence,'source-timestamp');
 assert.equal(temporal.fromElement(element({},'yesterday')).sent_at,null);
});
test('sort only complete distinct original source ordinals',()=>{
 const valid=[{source_order:7},{source_order:2},{source_order:3}];
 assert.deepEqual(Array.from(temporal.sortWithEvidence(valid),x=>x.source_order),[2,3,7]);
 assert.equal(temporal.sortWithEvidence([{source_order:null},{source_order:2}]),null);
 assert.equal(temporal.sortWithEvidence([{source_order:3},{source_order:3}]),null);
});
test('the extractor preserves source chronology but still blocks unordered append',()=>{
 const content=readFileSync(new URL('../plugins/chrome/content.js',import.meta.url),'utf8');
 const background=readFileSync(new URL('../plugins/chrome/background.js',import.meta.url),'utf8');
 const vendor=readFileSync(new URL('../plugins/chrome/vendor/ChatGPTShadowExtract.js',import.meta.url),'utf8');
 assert.ok(background.includes("'source-temporal-order.js','content.js'"));
 assert.ok(content.includes("source_order:row.source_order??null"));
 assert.ok(vendor.includes("LasSourceTemporalOrder?.fromElement"));
 assert.ok(background.includes("if(isConversationSource(item.source_key||item.url))"));
});

test('ChatGPT stable search-unit turn key exposes global source ordinal without moving page',()=>{
 const first=temporal.fromElement(element({
  'data-chatgpt-search-unit-key':'fallback-turn-27:2:assistant'
 }));
 assert.equal(first.source_order,27);
 assert.equal(first.order_evidence,'source-unit-ordinal');
 const later=temporal.fromElement(element({
  'data-chatgpt-search-unit-key':'fallback-turn-3:2:user'
 }));
 assert.equal(later.source_order,3);
 assert.equal(temporal.sortWithEvidence([first,later])[0].source_order,3);
});
test('source-key index conflicts and untrusted viewport identifiers are rejected',()=>{
 const conflicting=temporal.fromElement(element({
  'data-chatgpt-search-unit-key':'fallback-turn-31:2:user',
  'data-message-index':'12'
 }));
 assert.equal(conflicting.source_order,null);
 assert.equal(conflicting.order_evidence,'conflicting-ordinals');
 for(const key of ['fallback-turn-3:2:tool','fallback-turn-03:2:user',
   'fallback-turn-NaN:2:assistant','random-turn-99:2:user']){
  assert.equal(temporal.fromElement(element({
   'data-chatgpt-search-unit-key':key
  })).source_order,null);
 }
});
test('mixed original-order and source-key evidence do not use capture or DB timestamps',()=>{
 const values=[
  temporal.fromElement(element({'data-chatgpt-search-unit-key':'fallback-turn-9:2:user'})),
  temporal.fromElement(element({'data-turn-index':'2'}))
 ];
 assert.deepEqual(Array.from(temporal.sortWithEvidence(values),x=>x.source_order),[2,9]);
 assert.equal(temporal.fromElement(element({'data-testid':'conversation-turn-0'})).source_order,null);
});
