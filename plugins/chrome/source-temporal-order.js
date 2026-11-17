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
  const attr=name=>node?.getAttribute?.(name)||null;
  // These are durable original-source identifiers only when explicitly present.
  const ordinal=number(attr('data-message-index'))??
    number(attr('data-turn-index'))??number(attr('data-conversation-index'));
  const time=node?.querySelector?.('time[datetime]')?.getAttribute?.('datetime')||
    attr('data-message-created-at')||attr('data-created-at');
  const sentAt=timestamp(time);
  const parentId=attr('data-parent-message-id')||attr('data-parent-id');
  return Object.freeze({
    source_order:ordinal, sent_at:sentAt,
    parent_id:parentId&&parentId.length<=256?parentId:null,
    order_evidence:ordinal!==null?'source-ordinal':
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
