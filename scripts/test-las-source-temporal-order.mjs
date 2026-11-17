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
