// Extract evidence of the original turn ordering, not DOM viewport offsets.
// This module never scrolls the page or infers chronology from capture times.
(function(root){
 'use strict';
 const number=value=>{
  if(value==null||!/^(0|[1-9][0-9]{0,8})$/.test(String(value)))return null;
  const parsed=Number(value);
  return Number.isSafeInteger(parsed)?parsed:null;
 };
 const timestamp=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value))return null;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)?new Date(parsed).toISOString():null;
 };
 function fromElement(node){
  const attr=(el,name)=>el?.getAttribute?.(name)||null;
  // The ChatGPT search unit is a turn identity, not a viewport-local array
  // index. Strictly parse only the source's explicit fallback-turn key.
  // Reject arbitrary data-testid strings and any other synthetic index.
  const key=attr(node,'data-chatgpt-search-unit-key');
  const keyMatch=/^fallback-turn-(0|[1-9][0-9]{0,8}):[0-9]+:(user|assistant)$/.exec(key||'');
  const explicit=number(attr(node,'data-message-index'))??
    number(attr(node,'data-turn-index'))??
    number(attr(node,'data-conversation-index'));
  const unit=keyMatch?number(keyMatch[1]):null;
  // Contradictory independent ordinal evidence is not safe to queue.
  const conflict=explicit!=null&&unit!=null&&explicit!==unit;
  const ordinal=conflict?null:explicit??unit;
  const time=node?.querySelector?.('time[datetime]')?.getAttribute?.('datetime')||
    attr(node,'data-message-created-at')||attr(node,'data-created-at');
  const sentAt=timestamp(time);
  const parentId=attr(node,'data-parent-message-id')||attr(node,'data-parent-id');
  return Object.freeze({
    source_order:ordinal, sent_at:sentAt,
    parent_id:parentId&&parentId.length<=256?parentId:null,
    order_evidence:conflict?'conflicting-ordinals':explicit!==null?'source-ordinal':
      unit!==null?'source-unit-ordinal':
      parentId?'source-parent-link':sentAt?'source-timestamp':'unavailable'
  });
 }
 function sortWithEvidence(turns){
  if(!Array.isArray(turns))throw new TypeError('turns must be an array');
  if(turns.length<=1)return [...turns];
  const ordered=turns.every(t=>Number.isSafeInteger(t?.source_order)&&t.source_order>=0);
  const unique=ordered&&new Set(turns.map(t=>t.source_order)).size===turns.length;
  if(!unique)return null; // A viewport index is not a global ordinal.
  return [...turns].sort((a,b)=>a.source_order-b.source_order);
 }
 root.LasSourceTemporalOrder=Object.freeze({fromElement,sortWithEvidence});
})(globalThis);
