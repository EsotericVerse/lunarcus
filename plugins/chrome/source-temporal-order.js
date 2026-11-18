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
  // New App Shell fallback-turn-N keys can be WINDOW-relative (the same
  // message gets a different N after scrolling). Never treat them as global
  // original-source ordinals. A server graph is the primary source of truth.
  const explicitValues=['data-message-index','data-turn-index','data-conversation-index']
    .map(name=>number(attr(node,name))).filter(value=>value!==null);
  const turnWrapper=node?.closest?.('[data-testid^="conversation-turn-"]')||node;
  const turnLabel=attr(turnWrapper,'data-testid');
  const turnMatch=/^conversation-turn-(0|[1-9][0-9]{0,8})$/.exec(turnLabel||'');
  const wrapperOrdinal=turnMatch?number(turnMatch[1]):null;
  const candidates=[...explicitValues,...(wrapperOrdinal===null?[]:[wrapperOrdinal])];
  const conflict=new Set(candidates).size>1;
  const ordinal=conflict||!candidates.length?null:candidates[0];
  const time=node?.querySelector?.('time[datetime]')?.getAttribute?.('datetime')||
    attr(node,'data-message-created-at')||attr(node,'data-created-at');
  const sentAt=timestamp(time);
  const parentId=attr(node,'data-parent-message-id')||attr(node,'data-parent-id');
  return Object.freeze({
    source_order:ordinal, sent_at:sentAt,
    parent_id:parentId&&parentId.length<=256?parentId:null,
    order_evidence:conflict?'conflicting-ordinals':
      explicitValues.length&&ordinal!==null?'source-ordinal':
      wrapperOrdinal!==null&&ordinal!==null?'source-conversation-turn':
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
