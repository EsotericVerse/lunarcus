// One LunArcus Chrome Extension: one LOC Auth, one queue, multiple capture modes.
const DB_NAME='loc-channel1-queue';
const STORE='pending',ACK_STORE='acknowledged';
const MAX_BATCH=50;
const CONFIG_URL=chrome.runtime.getURL('oauth-config.json');

const AUTH_KEYS=['locOAuth','locConfig'];
const MENU_PAGE='loc-page',MENU_SELECTION='loc-selection',MENU_AREA='loc-area',MENU_RECORD='loc-record',MENU_PAUSE='loc-pause',MENU_RESUME='loc-resume',MENU_STOP='loc-stop',MENU_ROOT='lunarcus';
const SCOPE=/^[a-z][a-z0-9]{0,14}$/;
const encoder=new TextEncoder();
const sizeOf=x=>encoder.encode(JSON.stringify(x)).length;
const DIAGNOSTIC_KEY='locDiagnostics',MAX_DIAGNOSTICS=120;
let inFlight=null,flushRequested=false;
function safeDiagnostic(value){
 let text;
 try{text=typeof value==='string'?value:JSON.stringify(value)}catch{text=String(value)}
 return String(text||'')
  .replace(/("(?:access_token|refresh_token|code|code_verifier|state|authorization)"\s*:\s*)"[^"]*"/gi,'$1"[redacted]"')
  .replace(/(?:Bearer\s+|(?:access_token|refresh_token|code_verifier|authorization)=)\S+/gi,'[redacted]')
  .replace(/\s+/g,' ').slice(0,800);
}
async function logDiagnostic(event,detail=''){
 try{
  const current=await chrome.storage.local.get(DIAGNOSTIC_KEY);
  const logs=Array.isArray(current[DIAGNOSTIC_KEY])?current[DIAGNOSTIC_KEY]:[];
  logs.push({at:new Date().toISOString(),event:String(event),detail:safeDiagnostic(detail)});
  await chrome.storage.local.set({[DIAGNOSTIC_KEY]:logs.slice(-MAX_DIAGNOSTICS)});
 }catch{}
}
function openDb(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,2);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
   if(!db.objectStoreNames.contains(ACK_STORE))db.createObjectStore(ACK_STORE,{keyPath:'id'});
  };
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
async function allEvents(){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly');
  const req=tx.objectStore(STORE).getAll();
  req.onsuccess=()=>resolve(req.result||[]);
  req.onerror=()=>reject(req.error);
  tx.oncomplete=()=>db.close();
  tx.onerror=()=>reject(tx.error);
 });
}
async function putEvents(events){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction([STORE,ACK_STORE],'readwrite');
  const queue=tx.objectStore(STORE),ack=tx.objectStore(ACK_STORE);
  let count=0;
  const groups=new Set();
  // Preserve immutable original captured_at when a pending record is
  // captured again. A changed captured_at with the same event UUID would
  // otherwise cause the server append fingerprint to reject safe retries.
  for(const row of events){
   const old=queue.get(row.id);
   old.onsuccess=()=>{
    if(old.result)return;
    const prior=ack.get(row.id);
    prior.onsuccess=()=>{
     if(!prior.result){
      queue.add(row);
      count++;
      groups.add(row.group_id||row.id);
     }
    };
   };
  }
  tx.oncomplete=()=>{db.close();resolve({chunks:count,captures:groups.size});};
  tx.onerror=()=>{db.close();reject(tx.error);};
  tx.onabort=()=>{db.close();reject(tx.error);};
 });
}
// Cursor iteration keeps one captured text body in memory at a time.
// Status, badge and the organizer never clone the whole IndexedDB queue.
async function scanQueue({metadata=false,bytes=false}={}){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).openCursor();
  const groups=new Set(),rows=metadata?[]:null;
  let pending=0,blockedReview=0,legacyUnordered=0,totalBytes=0;
  req.onsuccess=()=>{
   const cursor=req.result;
   if(!cursor)return;
   const row=cursor.value;
   pending++;
   groups.add(row.group_id||row.id);
   if(isUnorderedConversationCapture(row))legacyUnordered++;
   if(row.kind==='ordered_conversation'&&
      (row.reviewed!==true||!trustedSourceOrder(row)))blockedReview++;
   if(bytes)totalBytes+=sizeOf(row);
   if(rows)rows.push({
    id:row.id,group_id:row.group_id,scopeid:row.scopeid,
    kind:row.kind,source_key:row.source_key,
    captured_at:row.captured_at,source_order:row.source_order,
    title:row.title,message_id:row.message_id,parent_id:row.parent_id,
    role:row.role,reviewed:row.reviewed,order_evidence:row.order_evidence,
    // Only the organizer needs a bounded preview, never the full body.
    text:row.kind==='ordered_conversation'
      ?(typeof row.text==='string'?row.text.slice(0,300):null):undefined
   });
   cursor.continue();
  };
  tx.oncomplete=()=>{db.close();resolve({
    pending,pendingCaptures:groups.size,blockedReview,legacyUnordered,
    ...(bytes?{bytes:totalBytes}:{}),...(rows?{rows}:{})
  });};
  tx.onabort=()=>{db.close();reject(tx.error)};
  tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
async function loadQueueRows(ids){
 if(!Array.isArray(ids)||!ids.length||ids.length>12)
  throw Error('Queue batch exceeds bounded memory read');
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly'),store=tx.objectStore(STORE);
  const rows=new Array(ids.length);
  ids.forEach((id,i)=>{
   const request=store.get(id);
   request.onsuccess=()=>{
    if(!request.result){tx.abort();return;}
    rows[i]=request.result;
   };
  });
  tx.oncomplete=()=>{db.close();resolve(rows)};
  tx.onabort=()=>{db.close();reject(Error('Queue content changed during transfer'))};
  tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
// Local-only ordered-message review. Nothing is sent, deleted or re-ordered
// in IndexedDB until an explicit review confirmation succeeds.
function reviewGroups(rows){
 const grouped=new Map(),legacy=[];
 for(const row of rows){
  if(isUnorderedConversationCapture(row)){legacy.push(row);continue;}
  if(row.kind!=='ordered_conversation')continue;
  const key=(row.scopeid||'lo3rwang')+'|'+row.source_key;
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(row);
 }
 const conversations=[...grouped].map(([key,items])=>{
  const sorted=[...items].sort((a,b)=>a.source_order-b.source_order);
  const ids=new Set(sorted.map(r=>r.message_id));
  const positions=new Set(sorted.map(r=>r.source_order));
  const valid=sorted.every(r=>Number.isSafeInteger(r.source_order)&&r.source_order>=0&&
   typeof r.message_id==='string'&&r.message_id.length>0&&
   ['user','assistant'].includes(r.role)&&typeof r.text==='string')&&
   ids.size===sorted.length&&positions.size===sorted.length&&
   sorted.every(trustedSourceOrder);
  return {key,scopeid:sorted[0].scopeid||'lo3rwang',
   source:sorted[0].source_key,title:sorted[0].title||'對話',
   valid,ready:valid&&sorted.every(r=>r.reviewed===true),
   message_count:sorted.length,unreviewed:sorted.filter(r=>r.reviewed!==true).length,
   messages:sorted.map(r=>({id:r.id,message_id:r.message_id,role:r.role,
    source_order:r.source_order,parent_id:r.parent_id||null,
    preview:String(r.text||'').slice(0,300),reviewed:r.reviewed===true}))
  };
 });
 return {conversations,legacy_count:legacy.length,ordered_count:conversations.reduce((n,g)=>n+g.message_count,0)};
}
async function approveReviewedConversation(key,expectedIds){
 if(typeof key!=='string'||!Array.isArray(expectedIds)||!expectedIds.length||expectedIds.length>10000||
    expectedIds.some(id=>typeof id!=='string'))throw Error('不合法的訊息重整確認');
 const rows=(await scanQueue({metadata:true})).rows;
 const group=reviewGroups(rows).conversations.find(g=>g.key===key);
 if(!group||!group.valid||group.message_count!==expectedIds.length||
   new Set(expectedIds).size!==expectedIds.length||
   group.messages.some(m=>!expectedIds.includes(m.id)))
  throw Error('待送內容已改變，請重新預覽時序；沒有確認任何資料');
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
  let changed=0;
  for(const entry of group.messages){
   const req=store.get(entry.id);
   req.onsuccess=()=>{
    const item=req.result;
    if(!item||item.kind!=='ordered_conversation'||
       (item.scopeid||'lo3rwang')+'|'+item.source_key!==key||
       item.source_order!==entry.source_order||item.message_id!==entry.message_id){
      tx.abort();return;
    }
    if(item.reviewed!==true){item.reviewed=true;store.put(item);changed++;}
   };
  }
  tx.oncomplete=()=>{db.close();resolve({approved:changed,ready:true});};
  tx.onabort=()=>{db.close();reject(Error('Queue 已異動，請重新預覽；沒有送出'))};
  tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
async function removeEvents(records){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction([STORE,ACK_STORE],'readwrite');
  const queue=tx.objectStore(STORE),ack=tx.objectStore(ACK_STORE);
  for(const row of records){
   // Durable receipts prevent repeated captures appending the same text
   // again after the Queue entry has been successfully acknowledged.
   ack.put({id:row.id,received_at:Date.now()});
   queue.delete(row.id);
  }
  tx.oncomplete=()=>{db.close();resolve();};
  tx.onerror=()=>{db.close();reject(tx.error);};
  tx.onabort=()=>{db.close();reject(tx.error);};
 });
}
function normalizedUrl(value){
 const u=new URL(value);
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('只支援 HTTP(S) 來源');
 u.hash='';
 for(const key of [...u.searchParams.keys()])if(/^utm_|^fbclid$|^igshid$/i.test(key))u.searchParams.delete(key);
 return u.href;
}
// A Threads permalink may use threads.net while the active page uses
// threads.com (and Instagram has www/mobile aliases). Only exact platform
// hostnames may cross origins; arbitrary redirects remain forbidden.
function captureSourceMatches(pageUrl,sourceUrl){
 const page=new URL(pageUrl),source=new URL(sourceUrl);
 if(!['http:','https:'].includes(page.protocol)||!['http:','https:'].includes(source.protocol))return false;
 if(page.origin===source.origin)return true;
 if(page.protocol!=='https:'||source.protocol!=='https:')return false;
 const THREADS=new Set(['threads.net','www.threads.net','threads.com','www.threads.com']);
 const INSTAGRAM=new Set(['instagram.com','www.instagram.com','m.instagram.com']);
 const CHATGPT=new Set(['chatgpt.com','chat.openai.com']);
 return (THREADS.has(page.hostname)&&THREADS.has(source.hostname))||
   (INSTAGRAM.has(page.hostname)&&INSTAGRAM.has(source.hostname))||
   (CHATGPT.has(page.hostname)&&CHATGPT.has(source.hostname));
}
async function stableUuid(input){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(input)));
 const hex=[...bytes.slice(0,16)].map(x=>x.toString(16).padStart(2,'0')).join('');
 // Version 5/variant RFC 4122 fingerprint UUID; retries keep the same event ID.
 return hex.slice(0,8)+'-'+hex.slice(8,12)+'-5'+hex.slice(13,16)+'-'+
  ((parseInt(hex[16],16)&3)|8).toString(16)+hex.slice(17,20)+'-'+hex.slice(20,32);
}
// Conversation fragments must never be appended to a Galaxy article out of order.
// The former model has no persisted turn-order/reply graph: fail closed.
// Existing pending Queue is retained and may contain legacy fragments; flush
// also blocks them until a verified structured migration is available.
function isConversationSource(value){
 try{
  const host=new URL(String(value||'')).hostname.toLowerCase();
  return ['chatgpt.com','chat.openai.com','claude.ai','gemini.google.com'].includes(host);
 }catch{return false;}
}
function isUnorderedConversationCapture(row){
 return isConversationSource(row?.source_key||row?.url)&&
  (String(row?.kind||'capture')==='capture');
}
async function toEvents(items,scopeid='lo3rwang'){
 if(!SCOPE.test(scopeid))throw Error('不支援的銀河 Scope');
 if(!Array.isArray(items)||!items.length||items.length>100)throw Error('擷取項目數量超出限制');
 const rows=[];
 for(const item of items){
  if(!item||typeof item.content!=='string'||!item.content.trim())continue;
  if(isConversationSource(item.source_key||item.url)){
   const url=normalizedUrl(item.url||item.source_key);
   const source_key=normalizedUrl(item.source_key||item.url);
   if(url!==source_key||!isConversationSource(url)||new URL(url).protocol!=='https:')
    throw Error('對話來源識別不一致；Queue 未變動');
   if(!Number.isSafeInteger(item.source_order)||item.source_order<0||
      !['user','assistant'].includes(item.role)||typeof item.text!=='string'||
      !item.text.trim()||item.text.length>140000||
      !['source-ordinal','source-conversation-turn'].includes(item.order_evidence))
    throw Error('來源沒有可靠的原始訊息序號；不使用頁面位置或 Queue 時間排序');
   const message_id=String(item.message_id||
     'source-ordinal:'+item.source_order);
   if(!message_id||message_id.length>256||
      [...message_id].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))
    throw Error('無效的來源訊息識別');
   const parent_id=item.parent_id==null?null:String(item.parent_id);
   if(parent_id&& (parent_id.length>256||[...parent_id].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)))
    throw Error('無效的原始對話父訊息識別');
   const id=await stableUuid(scopeid+'\\u0000'+source_key+'\\u0000'+message_id);
   const group_id=await stableUuid(scopeid+'\\u0000'+source_key);
   rows.push({id,group_id,scopeid,kind:'ordered_conversation',
      source_key,url,title:String(item.title||'對話').slice(0,350),
      message_id,source_order:item.source_order,parent_id,role:item.role,
      order_evidence:item.order_evidence,
      text:item.text,captured_at:new Date().toISOString()});
   continue;
  }
  const url=normalizedUrl(item.url||item.source_key);
  const source_key=normalizedUrl(item.source_key||item.url);
  if(url!==source_key)continue;
  const title=String(item.title||'未命名網頁').slice(0,350);
  const content=item.content.trim();
  // Use per-item capture groups, not one group for unrelated posts.
  const group_id=await stableUuid(scopeid+'\u0000'+source_key+'\u0000'+(item.key||'')+'\u0000'+content);
  const partSize=85000,part_count=Math.ceil(content.length/partSize);
  if(part_count>10000)throw Error('文章過長');
  for(let index=0;index<part_count;index++){
   const part=content.slice(index*partSize,(index+1)*partSize);
   const id=await stableUuid(scopeid+'\u0000'+source_key+'\u0000'+(item.key||'')+'\u0000'+part+'\u0000'+index);
   rows.push({id,group_id,scopeid,source_key,url,title,kind:'capture',write_mode:'append',
    part_index:index,part_count,captured_at:new Date().toISOString(),content:part});
  }
 }
 return rows;
}
function captureTotals(rows){return {pending:rows.length,pendingCaptures:new Set(rows.map(r=>r.group_id||r.id)).size};}
async function updateQueueBadge(rows=null){
 const totals=rows?captureTotals(rows):await scanQueue();
 const count=totals.pendingCaptures;
 await chrome.action.setBadgeText({text:count?(count>99?'99+':String(count)):''});
 await chrome.action.setTitle?.({title:count?'LunArcus：待送 '+count+' 次擷取':'LunArcus：Queue 0 次待送'});
 return totals;
}
async function clearLegacyTabBadges(){
 // Older versions wrote '!' / 'OK' to individual tab badges. Those per-tab
 // overrides survive until explicitly cleared and hide the real Queue count.
 const tabs=await chrome.tabs.query({});
 await Promise.all(tabs.filter(t=>Number.isInteger(t.id)).map(t=>
  chrome.action.setBadgeText({text:'',tabId:t.id}).catch(()=>{})));
}
async function noteAction(name,ok,message,tabId=null){
 const item={name:String(name||'擷取'),ok:ok===true,
  message:String(message||'未提供原因').slice(0,600),at:new Date().toISOString()};
 await chrome.storage.local.set({locLastAction:item}).catch(()=>{});
 if(tabId)await chrome.tabs.sendMessage(tabId,{type:'page.feedback',ok:item.ok,
  message:item.name+'：'+item.message}).catch(()=>{});
 return item;
}
async function queueCount(){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly');
  const req=tx.objectStore(STORE).count();
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
  tx.oncomplete=()=>db.close();
 });
}
async function acceptItems(items){
 if(!Array.isArray(items)||items.length>2000)
  throw Error('擷取數量超出上限（2000 則），請分段錄製；原有 Queue 保留');
 const {locTargetScope='lo3rwang',locImportPaused=false}=
  await chrome.storage.local.get(['locTargetScope','locImportPaused']);
 const detected=items.length;
 const user=items.filter(x=>String(x?.content||'').startsWith('[user]\n')).length;
 const assistant=items.filter(x=>String(x?.content||'').startsWith('[assistant]\n')).length;
 const isConversation=(user+assistant)>0;
 const summary=isConversation
  ?'本次頁面辨識 '+detected+' 則對話訊息（使用者 '+user+'／AI '+assistant+'）'
  :'本次頁面辨識 '+detected+' 項擷取內容';
 const events=[];
 for(let i=0;i<items.length;i+=100)
  events.push(...await toEvents(items.slice(i,i+100),locTargetScope));
 if(!events.length)
  return {message:summary+'；沒有符合條件的內容入列',queued:await queueCount(),
   detected,user,assistant,insertedCaptures:0,insertedChunks:0,empty:true};
 const inserted=await putEvents(events);
 await updateQueueBadge().catch(error=>console.warn('[LOC Queue badge]',String(error)));
 const message=summary+'；新入列 '+inserted.captures+' 項擷取內容／'+
  inserted.chunks+' 筆 Queue 分段（不是對話來源數，也不是 Galaxy 已保存總數）';
 if(locImportPaused)
  return {message:message+'；Queue 已暫停傳送',queued:await queueCount(),
   detected,user,assistant,insertedCaptures:inserted.captures,
   insertedChunks:inserted.chunks,empty:inserted.chunks===0};
 const pendingCount=await queueCount();
 if(pendingCount)void flush(false).catch(async error=>{
  console.warn('[LunArcus automatic import]',String(error));
  await noteAction('自動傳送',false,error?.message||String(error));
 });
 return {message,queued:pendingCount,detected,user,assistant,
  insertedCaptures:inserted.captures,insertedChunks:inserted.chunks,
  empty:inserted.chunks===0};
}

function packet(rows){
 const out=[];let current=[];
 for(const row of rows){
  const next=[...current,row];
  // Add enough headroom for JSON batch envelope.
  if(current.length&&(next.length>MAX_BATCH||sizeOf({id:'00000000-0000-4000-8000-000000000000',write_mode:'append',records:next})>590000)){
   out.push(current);current=[row];
  }else current=next;
 }
 if(current.length)out.push(current);
 return out;
}

function encode64(bytes){
 let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
function oauthError(message){return Error('LunArcus Auth：'+message);}
// Better Auth's OAuth provider exposes RFC 8414 and OIDC discovery at the
// issuer-path and at the backwards-compatible root aliases. Reuse the same
// ordered candidates as the existing LOC upstream OAuth client instead of
// assuming one deployment URL.
function oauthDiscoveryUrls(issuer){
 const url=new URL(issuer),path=url.pathname.replace(/\/+$/,'');
 return [
  url.origin+'/.well-known/oauth-authorization-server'+path,
  url.origin+'/.well-known/openid-configuration'+path,
  url.origin+path+'/.well-known/openid-configuration',
  url.origin+'/.well-known/oauth-authorization-server',
  url.origin+'/.well-known/openid-configuration'
 ];
}
async function discoverLocOAuth(issuer){
 const expected=issuer.href.replace(/\/+$/,'');
 let lastStatus=0;
 for(const endpoint of [...new Set(oauthDiscoveryUrls(issuer))]){
  try{
   const response=await fetch(endpoint,{cache:'no-store',redirect:'error'});
   lastStatus=response.status;
   await logDiagnostic('oauth.discovery.response',{endpoint,status:response.status});
   if(!response.ok)continue;
   const metadata=await response.json();
   if(metadata?.issuer!==expected||!metadata.authorization_endpoint||!metadata.token_endpoint)
    continue;
   return metadata;
  }catch(error){await logDiagnostic('oauth.discovery.error',{endpoint,message:error?.message||String(error)});}
 }
 throw oauthError(lastStatus
  ?'找不到 LOC OAuth 伺服器（HTTP '+lastStatus+'）'
  :'找不到 LOC OAuth 伺服器');
}
async function getConfig(){
 try{
  const res=await fetch(CONFIG_URL,{cache:'no-store',redirect:'error'});
  await logDiagnostic('oauth.config.response',{endpoint:CONFIG_URL,status:res.status});
  if(!res.ok)throw oauthError('尚未提供 Extension 認證設定');
  const cfg=await res.json();
  if(!cfg.issuer||!cfg.import_url||!cfg.client_id)
   throw oauthError('LOC 自有認證與短匯入 API 尚未啟用');
  const issuer=new URL(cfg.issuer);
  const api=new URL(cfg.import_url);
  if(issuer.protocol!=='https:'||api.protocol!=='https:'||
     api.origin!=='https://loc.lo3rwang.cc'||api.pathname!=='/api/loc-native'||
     cfg.resource!=='https://mcp.lo3rwang.cc'||!cfg.client_id||typeof cfg.client_id!=='string'||
     issuer.origin!=='https://auth.lo3rwang.cc'||issuer.pathname!=='/api/auth')
    throw oauthError('LOC 自有認證尚未啟用，不會使用其他平台登入');
  const meta=await discoverLocOAuth(issuer);
  for(const endpoint of [meta.authorization_endpoint,meta.token_endpoint]){
   const url=new URL(endpoint);
   if(url.protocol!=='https:'||url.origin!==issuer.origin)
    throw oauthError('OAuth 端點必須使用 LOC Auth HTTPS');
  }
  const config={supports_scope_routing:true,issuer:meta.issuer,client_id:cfg.client_id,import_url:api.href,
    resource:cfg.resource||api.href,
   authorization_endpoint:meta.authorization_endpoint,token_endpoint:meta.token_endpoint,
   revocation_endpoint:meta.revocation_endpoint||'',
   scope:cfg.scope||'loc:import'};
  await chrome.storage.local.set({locConfig:config});
  await logDiagnostic('oauth.config.ready',{issuer:config.issuer,client_id:config.client_id,
   authorization_endpoint:config.authorization_endpoint,token_endpoint:config.token_endpoint});
  return config;
 }catch(error){
  await logDiagnostic('oauth.config.error',{endpoint:CONFIG_URL,message:error?.message||String(error)});
  throw error;
 }
}
async function exchange(config,body){
 const res=await fetch(config.token_endpoint,{method:'POST',
  headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({...body,client_id:config.client_id,resource:config.resource}).toString(),
  redirect:'error',cache:'no-store'});
 await logDiagnostic('oauth.token.response',{grant_type:body.grant_type,status:res.status});
 if(!res.ok)throw oauthError('Token 交換失敗（HTTP '+res.status+'）');
 const json=await res.json();
 if(!json.access_token||json.token_type?.toLowerCase()!=='bearer')
  throw oauthError('伺服器未回傳 Bearer Token');
 return json;
}
// Public PKCE client: use the fixed first-party LOC Auth client registration.
function registeredClient(config,redirect){
 const clientId='lunarcus';
 const callback='https://hiaeafonocnjaclcfgjmdopbcgnafnna.chromiumapp.org/loc';
 if(config.client_id!==clientId||redirect!==callback)
  throw oauthError('LunArcus 固定 OAuth Client 與 Chrome 回呼不一致');
 return clientId;
}
async function disconnectLoc(){
 // Keep all pending Queue data even if server-side revocation is unavailable.
 if(refreshFlight)await refreshFlight.catch(()=>{});
 const state=await chrome.storage.local.get(AUTH_KEYS);
 const token=state.locOAuth?.refresh_token,cfg=state.locConfig;
 let revoked=false;
 if(token&&cfg?.client_id&&cfg?.revocation_endpoint){
  try{
   const endpoint=new URL(cfg.revocation_endpoint);
   if(endpoint.origin===new URL(cfg.issuer).origin&&endpoint.pathname==='/api/auth/oauth2/revoke'){
    const reply=await fetch(endpoint.href,{method:'POST',redirect:'error',cache:'no-store',
     headers:{'content-type':'application/x-www-form-urlencoded'},
     body:new URLSearchParams({client_id:cfg.client_id,token,
      token_type_hint:'refresh_token'}).toString()});
    revoked=reply.ok;
   }
  }catch{}
 }
 await chrome.storage.local.remove(AUTH_KEYS);
 await logDiagnostic('oauth.disconnected',{serverRevoked:revoked});
 return {disconnected:true,serverRevoked:revoked,
  ...(token&&!revoked?{warning:'已清除本機授權；伺服器無法確認撤銷，請在連線恢復後重新登入。'}:{})};
}
async function connectLoc(){
 const cfg=await getConfig();
 const redirect=chrome.identity.getRedirectURL('loc');
 cfg.client_id=registeredClient(cfg,redirect);
 await chrome.storage.local.set({locConfig:cfg});
 const verifier=encode64(crypto.getRandomValues(new Uint8Array(32)));
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
 const state=crypto.randomUUID();
 const authorization=new URL(cfg.authorization_endpoint);
 for(const [key,val] of Object.entries({response_type:'code',client_id:cfg.client_id,
  redirect_uri:redirect,scope:cfg.scope,resource:cfg.resource,state,code_challenge:encode64(digest),
  code_challenge_method:'S256'}))authorization.searchParams.set(key,val);
 await logDiagnostic('oauth.authorize.start',{client_id:cfg.client_id,redirect_uri:redirect,
  authorization_endpoint:cfg.authorization_endpoint,scope:cfg.scope});
 let returned;
 try{returned=await chrome.identity.launchWebAuthFlow({url:authorization.href,interactive:true});}
 catch(error){
  await logDiagnostic('oauth.authorize.error',{message:error?.message||String(error)});
  throw error;
 }
 await logDiagnostic('oauth.authorize.callback',{returned:Boolean(returned),redirect_uri:redirect});
 if(!returned||!returned.startsWith(redirect+'?'))throw oauthError('授權回呼無效');
 const result=new URL(returned),code=result.searchParams.get('code');
 if(result.searchParams.get('state')!==state||!code||result.searchParams.get('error'))
  throw oauthError('授權失敗或驗證碼不符');
 const tokens=await exchange(cfg,{grant_type:'authorization_code',code,redirect_uri:redirect,
  code_verifier:verifier});
 await chrome.storage.local.set({locOAuth:{
  access_token:tokens.access_token,refresh_token:tokens.refresh_token||null,
  expires_at:Date.now()+Math.max(0,Number(tokens.expires_in||300)-60)*1000}});
 await chrome.storage.local.remove(['locImportPaused','locQueuePaused']);
 await logDiagnostic('oauth.connected',{client_id:cfg.client_id});
 return {connected:true};
}
let refreshFlight=null;
async function activeToken(forceRefresh=false){
 const {locOAuth:tokens,locConfig:cfg}=await chrome.storage.local.get(AUTH_KEYS);
 if(!tokens||!cfg)throw oauthError('請先在設定頁連接 LOC');
 if(!forceRefresh&&tokens.access_token&&tokens.expires_at>Date.now())return tokens.access_token;
 if(!tokens.refresh_token)throw oauthError('授權已過期，請重新連接 LOC');
 if(refreshFlight)return refreshFlight;
 refreshFlight=(async()=>{
  const refreshed=await exchange(cfg,{grant_type:'refresh_token',refresh_token:tokens.refresh_token});
  const next={access_token:refreshed.access_token,
   refresh_token:refreshed.refresh_token||tokens.refresh_token,
   expires_at:Date.now()+Math.max(0,Number(refreshed.expires_in||300)-60)*1000};
  await chrome.storage.local.set({locOAuth:next});
  return next.access_token;
 })().finally(()=>{refreshFlight=null;});
 return refreshFlight;
}

function contractError(message){return Object.assign(new Error(message),{code:'LOC_IMPORT_CONTRACT'})}
function validateArticleReceipts(receipts,records){
 if(!Array.isArray(receipts))throw contractError('LOC 未回傳 UID 回執，Queue 保留');
 const expected=new Map();
 for(const row of records){
  if(typeof row?.source_key!=='string'||!row.source_key)
   throw contractError('LOC Queue 來源不完整');
  expected.set(row.source_key,(expected.get(row.source_key)||0)+1);
 }
 // The backend returns exactly one receipt for each unique source, even when
 // every event was previously imported. Never acknowledge a partial or
 // contradictory response and silently delete the remaining IndexedDB rows.
 if(receipts.length!==expected.size)
  throw contractError('LOC UID 回執數量不符，Queue 保留');
 const received=new Set();
 for(const entry of receipts){
  const key=entry?.source_key,appended=entry?.appended;
  if(typeof key!=='string'||!expected.has(key)||received.has(key)||
     !/^[A-Za-z0-9]{8}$/.test(String(entry?.uid||''))||
     !Number.isSafeInteger(appended)||appended<0||appended>expected.get(key)||
     entry.duplicate!==(appended===0))
   throw contractError('LOC UID 回執內容不一致，Queue 保留');
  received.add(key);
 }
}
async function sendViaAuth(scopeid,batch,token,config){
 if(!SCOPE.test(scopeid))throw Error('Invalid Scope');
 if(scopeid!=='lo3rwang'&&config.supports_scope_routing!==true)throw contractError('多 Scope 認證尚未啟用；Queue 保留，禁止錯誤寫入');
 const endpoint=new URL(config.import_url||'');
 if(endpoint.origin!=='https://loc.lo3rwang.cc'||endpoint.pathname!=='/api/loc-native')throw contractError('LOC 網站短匯入位址錯誤');
 // The Scope is validated by LOC data authorization, not the Auth server.
 let reply;
 try{reply=await fetch(endpoint.href,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({kind:'short-import',scopeid,batch}),redirect:'error',cache:'no-store'});}
 catch(error){error.queueEndpoint='LOC';throw error;}
 await logDiagnostic('import.response',{scopeid,status:reply.status,batch_id:batch.id});
 if(!reply.ok){
   let detail='';
   const mime=String(reply.headers?.get?.('content-type')||'').toLowerCase();
   if(mime.includes('json')||mime.includes('text/plain')){
    try{
     const raw=(await reply.text()).slice(0,2000);
     const body=mime.includes('json')?JSON.parse(raw):null;
     const value=body?(body?.error?.message||body?.error||body?.message||body?.code):raw;
     const safe=typeof value==='string'?value:'';
     // Never expose tokens, database URLs, credential strings or HTML.
     detail=safe.replace(/(?:https?|postgres(?:ql)?|mysql|mssql|sqlserver):\/\/\S+/gi,'[URL]')
      .replace(/(?:Bearer\s+)[A-Za-z0-9._~+/-]+/gi,'Bearer [redacted]')
      .replace(/\b(?:password|secret|token|authorization)\s*[:=]\s*\S+/gi,'[redacted]')
      .replace(/<[^>]*>/g,' ').replace(/[\r\n\t]+/g,' ')
      .replace(/\s{2,}/g,' ').trim().slice(0,180);
    }catch{}
   }
   const e=Error('LOC 匯入失敗：HTTP '+reply.status+
    (detail?' — '+detail:'（後端未提供可讀取的錯誤說明）'));
   e.httpStatus=reply.status;
   e.queueEndpoint='LOC';
   e.retryAfter=reply.headers?.get?.('retry-after')||'';
   throw e;
  }
 const receipt=await reply.json().catch(()=>{throw contractError('LOC 回執不可解析')});
 if(receipt?.accepted!==true||receipt.id!==batch.id)throw contractError('LOC 未確認批次 ID');
 validateArticleReceipts(receipt.articles,batch.records);
 return receipt;
}
function trustedSourceOrder(row){
 return row?.order_evidence==='source-ordinal'||
   row?.order_evidence==='source-conversation-turn';
}
function partitionQueueForFlush(pending){
 const legacyConversationCount=pending.filter(isUnorderedConversationCapture).length;
 // Older extension builds omitted chronology evidence from Queue rows.
 // These rows remain untouched until their source order is reverified.
 const unreviewed=pending.filter(row=>row.kind==='ordered_conversation'&&
   (row.reviewed!==true||!trustedSourceOrder(row)));
 const blocked=new Set(unreviewed.map(row=>(row.scopeid||'lo3rwang')+'\\u0000'+row.source_key));
 const ordered=pending.filter(row=>row.kind==='ordered_conversation'&&
   row.reviewed===true&&!blocked.has((row.scopeid||'lo3rwang')+'\\u0000'+row.source_key));
 const rows=pending.filter(row=>!isUnorderedConversationCapture(row)&&
   row.kind!=='ordered_conversation');
 return {legacyConversationCount,unreviewed,ordered,rows};
}
// LOC already owns record_ordered import, JWT/Scope permissions and durable
// receipts. Send reviewed batches directly to that existing Pages endpoint.
// MCP remains available for standalone tools, not as a bulk-upload relay.
async function orderedLocFailureEvidence(response,bodyBytes,recordCount){
 const contentType=String(response.headers.get('content-type')||'').split(';',1)[0].toLowerCase();
 const data=contentType==='application/json'||contentType.endsWith('+json')
  ?await response.clone().json().catch(()=>null):null;
 const message=String(data?.error?.message||'');
 const category=response.status===401?'loc_oauth_identity':
  response.status===403?'loc_import_permission':
  response.status===429?'loc_rate_limit':
  response.status===413?'loc_payload_limit':
  response.status===503?'loc_service_unavailable':
  response.status>=500?'loc_server_error':'loc_import_rejected';
 await logDiagnostic('loc.ordered.response',{
  status:response.status,category,content_type:contentType,
  body_bytes:bodyBytes,records:recordCount
 });
 return category;
}
async function sendOrderedConversation(scopeid,records,token,config){
 if(!SCOPE.test(scopeid)||!records.length||records.length>100)
  throw contractError('有序對話批次不合法');
 const source=records[0].source_key;
 if(records.some(r=>r.kind!=='ordered_conversation'||r.source_key!==source||
   (r.scopeid||'lo3rwang')!==scopeid))
  throw contractError('有序對話批次來源不一致');
 // Fixed LOC route: never follow a redirect to Auth or workers.dev.
 const endpoint='https://loc.lo3rwang.cc/api/las-native';
 const payload={kind:'mcp-conversation',action:'record_ordered',scopeid,
   conversation_id:source,title:records[0].title,
   updated_at:new Date().toISOString(),
   records:records.map(r=>({
     message_id:r.message_id,source_order:r.source_order,
     parent_id:r.parent_id||null,role:r.role,text:r.text
   }))
 };
 const payloadJson=JSON.stringify(payload);
 let response;
 try{response=await fetch(endpoint,{method:'POST',redirect:'error',
   cache:'no-store',headers:{authorization:'Bearer '+token,
     'content-type':'application/json',accept:'application/json'},
   body:payloadJson});}
 catch(error){error.queueEndpoint='LOC';throw error;}
 if(!response.ok){
   const category=await orderedLocFailureEvidence(response,
     encoder.encode(payloadJson).length,records.length);
   const error=Error('LOC 有序對話匯入失敗 HTTP '+response.status+
     '（'+category+'）');
   error.httpStatus=response.status;error.queueEndpoint='LOC';
   error.retryAfter=response.headers.get('retry-after')||'';
   throw error;
 }
 const body=await response.json().catch(()=>null);
 const receipt=body?.data;
 if(receipt?.accepted!==true||receipt.scopeid!==scopeid||
    !/^[A-Za-z0-9]{8}$/.test(String(receipt?.uid||''))||
    !Number.isSafeInteger(receipt?.count)||receipt.count<0||
    receipt.count>records.length||
    receipt.duplicate!==(receipt.count===0)||
    !Number.isSafeInteger(receipt?.messages)||
    receipt.messages<records.length)
  throw contractError('LOC 有序對話未確認完整寫入，Queue 原始資料保留');
 await logDiagnostic('loc.ordered.receipt',{
   accepted:true,records:records.length,appended:receipt.count,
   total_messages:receipt.messages,duplicate:receipt.duplicate
 });
 return receipt;
}
async function flush(force=false){
 // A manual send must not inherit an already-running automatic attempt.
 // Await its settlement and then run a fresh forced pass against durable Queue.
 if(inFlight){
  if(force){
   try{await inFlight}catch{}
   return flush(true);
  }
  flushRequested=true;
  return inFlight;
 }
 inFlight=(async()=>{
  const pending=(await scanQueue({metadata:true})).rows.sort((a,b)=>String(a.captured_at||'').localeCompare(String(b.captured_at||'')));
  const {legacyConversationCount,unreviewed,ordered,rows}=partitionQueueForFlush(pending);
  // Legacy fragments remain quarantined. Ordered turns use a separate writer.
  if(!rows.length&&!ordered.length){
   const unreviewedCount=unreviewed.length;
   return {message:unreviewedCount
    ?'有 '+unreviewedCount+' 則對話尚未完成訊息重整，請先在第六鍵「訊息重整」確認'
    :legacyConversationCount
      ?'已保留 '+legacyConversationCount+' 筆舊版無序對話 Queue；待結構化重建後再送出'
      :'Queue 已清空',sent:0};
  }
  const settings=await chrome.storage.local.get(['locImportPaused','locQueueRetryAfter','locQueueRetryType','locQueueFailures','locConfig']);
  if(!force&&settings.locImportPaused)return {message:'已暫停自動傳送',sent:0};
  if(Number(settings.locQueueRetryAfter||0)>Date.now()&&
     (!force||settings.locQueueRetryType==='rate'))
    return {message:settings.locQueueRetryType==='rate'?'流量管制等待中':
     '後端故障暫緩自動重試（手動送出仍可執行）',sent:0};
  let token;
  try{token=await activeToken()}catch(e){await chrome.storage.local.set({locImportPaused:true});throw e}
  if(!settings.locConfig?.import_url){await chrome.storage.local.set({locImportPaused:true});throw Error('LOC 匯入設定不存在')}
  let count=0;
  try{
   const groups=new Map();
   for(const row of ordered){
    const key=(row.scopeid||'lo3rwang')+'\\u0000'+row.source_key;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(row);
   }
   for(const group of groups.values()){
    // Always send in original source order, not in arrival order.
    group.sort((a,b)=>a.source_order-b.source_order);
    for(const part of packet(group)){
     const scopeid=part[0].scopeid||'lo3rwang';
     try{await sendOrderedConversation(scopeid,part,token,settings.locConfig)}
     catch(error){
      if(error.httpStatus!==401)throw error;
      token=await activeToken(true);
      await sendOrderedConversation(scopeid,part,token,settings.locConfig);
     }
     await removeEvents(part);
     await updateQueueBadge().catch(()=>{});
     count+=part.length;
    }
   }
   for(const scopeid of [...new Set(rows.map(r=>r.scopeid||'lo3rwang'))]){
    for(const group of packet(rows.filter(r=>(r.scopeid||'lo3rwang')===scopeid))){
     const batch={id:await stableUuid(group.map(r=>r.id).sort().join('|')),write_mode:'append',records:group.map(({scopeid:localScope,...record})=>({...record,source_key:record.source_key||normalizedUrl(record.url),write_mode:'append',kind:record.kind||'capture'}))};
     try{await sendViaAuth(scopeid,batch,token,settings.locConfig)}
     catch(error){
       if(error.httpStatus!==401)throw error;
       // A token can be revoked before its local expiry. Refresh once, then
       // require the same server-side UID receipt before acknowledging Queue.
       try{token=await activeToken(true)}
       catch{
         const expired=oauthError('授權已失效，請重新連接 LOC');
         expired.httpStatus=401;
         throw expired;
       }
       await sendViaAuth(scopeid,batch,token,settings.locConfig);
     }
     await removeEvents(group); // Clear only after complete server-side UID receipts.
     await updateQueueBadge().catch(error=>console.warn('[LOC Queue badge]',String(error)));
     count+=group.length;
    }
   }
   await chrome.storage.local.remove(['locImportPaused','locQueueRetryAfter','locQueueRetryType','locQueueFailures','locQueueRetryEndpoint','locQueueRetryStatus']);
   return {message:'LOC 已確認寫入 '+count+' 筆',sent:count};
  }catch(e){
   const s=Number(e.httpStatus||0);
   const endpoint=['LOC','MCP'].includes(e.queueEndpoint)?e.queueEndpoint:'';
   await chrome.storage.local.set({locQueueRetryEndpoint:endpoint,
     locQueueRetryStatus:s>=100&&s<=599?s:0});
   if(s===429){
     const v=String(e.retryAfter||'');
     const ms=/^\d+$/.test(v)?Number(v)*1000:(Date.parse(v)||0)-Date.now();
     await chrome.storage.local.set({locQueueRetryType:'rate',
       locQueueRetryAfter:Date.now()+(Number.isFinite(ms)&&ms>0?Math.min(ms,3600000):900000)});
    }else if(s>=500||(s===0&&e.code!=='LOC_IMPORT_CONTRACT')){
     const failures=Math.min(8,Math.max(0,Number(settings.locQueueFailures||0))+1);
     const delay=Math.min(3600000,60000*2**Math.min(failures,6));
     await chrome.storage.local.set({locQueueFailures:failures,
       locQueueRetryType:s===0?'network':'server',locQueueRetryAfter:Date.now()+delay});
    }else if(e.code==='LOC_IMPORT_CONTRACT'||[400,401,403,404,409,410,413,415,422].includes(s))
     await chrome.storage.local.set({locImportPaused:true});
   throw e;
  }
 })().finally(()=>{
  const again=flushRequested;
  flushRequested=false;
  inFlight=null;
  // A capture may arrive while a previous snapshot is being sent.
  // Drain that new work immediately instead of waiting for the retry alarm.
  if(again)void flush(false).catch(async error=>{
   console.warn('[LunArcus automatic import]',String(error));
   await noteAction('自動傳送',false,error?.message||String(error));
  });
 });return inFlight;
}

async function inject(tabId){
 await chrome.scripting.executeScript({target:{tabId},files:[
  'vendor/Readability.js','vendor/ChatGPTShadowExtract.js',
   'capture-source-model.js','conversation-source-model.js','source-temporal-order.js','content.js'
 ]});
}
async function currentTab(){
 const tabs=await chrome.tabs.query({active:true,currentWindow:true});
 const tab=tabs[0];
 if(!tab?.id||!/^https?:\/\//.test(tab.url||''))throw Error('請在一般網頁上使用');
 return tab;
}
// Runs ONLY after a user chooses to capture the open ChatGPT conversation.
// Chrome executes the function in that page's own origin; it requests that
// SAME conversation's existing read-only source record. It does not retrieve
// access tokens, touch another origin, scroll the page or grant new access.
// The source API is undocumented: failure must preserve the old Queue.
async function readChatgptSourceInPage(threadId,includeAssistant){
 const idFormat=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(!idFormat.test(threadId))return {status:'invalid-thread'};
 const here=location;
 if(!['chatgpt.com','chat.openai.com'].includes(here.hostname))return {status:'wrong-origin'};
 const pathId=/(?:^|\/)c\/([0-9a-f-]{36})(?:\/|$)/i.exec(here.pathname)?.[1];
 if(!pathId||pathId.toLowerCase()!==threadId.toLowerCase())
  return {status:'changed-conversation'};
 let json;
 try{
  // ChatGPT's own SPA sometimes requires its short-lived same-origin bearer
  // on /backend-api even when the browser has a valid session cookie. Obtain
  // it once, only inside this MAIN-world function. NEVER return, save, log or
  // send it to the extension, LAS, Queue or LOC.
  let bearer='';
  try{
   const session=await fetch('/api/auth/session',{method:'GET',
    credentials:'same-origin',redirect:'error',cache:'no-store',
    headers:{accept:'application/json'}});
   if(session.ok&&String(session.headers.get('content-type')||'').includes('json')){
    if(Number(session.headers.get('content-length')||0)<=64000){
     const rawSession=await session.text();
     if(rawSession.length<=64000){
      const token=JSON.parse(rawSession)?.accessToken;
      if(typeof token==='string'&&token.length>0&&token.length<=8192)
       bearer=token;
     }
    }
   }
  }catch{}
  const headers={accept:'application/json'};
  if(bearer)headers.authorization='Bearer '+bearer;
  // The historical and the App Shell paths can differ. A second GET is made
  // ONLY after a 404; 401, 403 and 429 are never retried automatically.
  let response=await fetch('/backend-api/conversation/'+encodeURIComponent(threadId),{
   method:'GET',credentials:'same-origin',redirect:'error',
   cache:'no-store',headers
  });
  if(response.status===404)
   response=await fetch('/backend-api/conversations/'+encodeURIComponent(threadId),{
    method:'GET',credentials:'same-origin',redirect:'error',
    cache:'no-store',headers
   });
  if(!response.ok)return {status:'source-http-'+response.status};
  if(!String(response.headers.get('content-type')||'').includes('json'))
   return {status:'source-not-json'};
  if(Number(response.headers.get('content-length')||0)>10000000)
   return {status:'source-too-large'};
  const raw=await response.text();
  if(raw.length>10000000)return {status:'source-too-large'};
  json=JSON.parse(raw);
 }catch{return {status:'source-unavailable'};}
 if(json?.conversation_id&&String(json.conversation_id).toLowerCase()!==threadId.toLowerCase())
  return {status:'source-id-mismatch'};
 if(json?.has_more||json?.has_next_page||json?.next_cursor||
    json?.pagination?.has_more||json?.pagination?.next_cursor)
  return {status:'source-paginated'};
 // An App Shell pagination placeholder is not the origin of the full tree.
 if(json?.mapping&&Object.keys(json.mapping).some(key=>
    /^(?:paginated[-_:]root|pagination[-_:]root)/i.test(key)))
  return {status:'source-paginated'};
 let chain;
 if(json?.mapping&&typeof json.mapping==='object'&&typeof json.current_node==='string'){
  const ancestors=[],seen=new Set();
  let cursor=json.current_node;
  while(cursor){
   if(seen.has(cursor)||ancestors.length>10000)
    return {status:'invalid-source-chain'};
   seen.add(cursor);
   const node=json.mapping[cursor];
   if(!node)return {status:'broken-source-chain'};
   ancestors.push({message:node.message,parent:node.parent||null,
    nodeId:cursor});
   cursor=node.parent||null;
  }
  chain=ancestors.reverse();
 }else if(Array.isArray(json?.messages)){
  chain=json.messages.map((message,i)=>({
   message:message.message||message,
   parent:message.parent||message.parent_id||null,
   nodeId:message.id||'original-'+i
  }));
 }else return {status:'source-without-order'};
 if(chain.length>10000)return {status:'source-too-many-messages'};
 const rows=[],ids=new Set();
 let skipped=0,totalChars=0;
 for(let i=0;i<chain.length;i++){
  const {message:m,parent,nodeId}=chain[i];
  if(!m||typeof m!=='object')continue;
  const role=m.author?.role||m.role||m.sender?.role;
  if(role!=='user'&&role!=='assistant')continue;
  const channel=m.channel||m.metadata?.channel||m.metadata?.message_channel||null;
  if(channel&& !['final','commentary'].includes(channel))continue;
  if(m.metadata?.is_visually_hidden_from_conversation===true)continue;
  if(m.recipient&&m.recipient!=='all')continue;
  if(role==='assistant'&&!includeAssistant)continue;
  if(m.status==='in_progress'||m.status==='streaming')continue;
  const c=m.content;
  let text='';
  if(typeof c==='string')text=c;
  else if(typeof c?.text==='string')text=c.text;
  else if(Array.isArray(c?.parts)){
   const parts=c.parts.map(p=>typeof p==='string'?p:
    p?.content_type==='text'&&typeof p.text==='string'?p.text:null);
   text=parts.filter(p=>p!==null).join('\n');
  }
  if(!text.trim()){skipped++;continue;}
  if(text.length>140000)return {status:'source-message-too-long'};
  const id=String(m.id||m.message_id||nodeId||'');
  if(!id||id.length>256||ids.has(id))return {status:'source-id-conflict'};
  ids.add(id);
  totalChars+=text.length;
  if(totalChars>8000000||rows.length>=2000)return {status:'source-too-large'};
  rows.push({message_id:id,role,source_order:i,
   parent_id:typeof parent==='string'&&parent.length<=256?parent:null,
   text});
 }
 if(!rows.length)return {status:'source-no-text'};
 // The current URL must still name the same chat after the async request.
 const finalId=/(?:^|\/)c\/([0-9a-f-]{36})(?:\/|$)/i.exec(location.pathname)?.[1];
 if(finalId?.toLowerCase()!==threadId.toLowerCase())
  return {status:'changed-conversation'};
 return {status:'ok',conversation_id:threadId,
  title:String(json?.title||document.title||'對話').slice(0,350),
  messages:rows,skipped,original_count:chain.length};
}

async function captureChatgptOriginalSequence(tab,includeAssistant){
 const url=new URL(tab.url||'');
 if(!['chatgpt.com','chat.openai.com'].includes(url.hostname))return null;
 const id=/(?:^|\/)c\/([0-9a-f-]{36})(?:\/|$)/i.exec(url.pathname)?.[1];
 if(!id||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(id))
  return null;
 let result;
 try{
  const frame=await chrome.scripting.executeScript({
   target:{tabId:tab.id},world:'MAIN',func:readChatgptSourceInPage,
   args:[id,includeAssistant===true]
  });
  result=frame?.[0]?.result;
 }catch(error){
  console.warn('[LunArcus ChatGPT source read unavailable]',String(error?.message||error));
  return {source_unavailable:'browser-source-unavailable'};
 }
 if(result?.status!=='ok'){
  // No body, session or token data in diagnostic output.
  const status=String(result?.status||'source-unavailable').slice(0,80);
  console.warn('[LunArcus ChatGPT source order]',status);
  return {source_unavailable:status};
 }
 if(String(result.conversation_id).toLowerCase()!==id.toLowerCase()||
    !Array.isArray(result.messages)||!result.messages.length)
  return {source_unavailable:'source-invalid-receipt'};
 const canonical='https://chatgpt.com/c/'+id;
 const items=result.messages.map(row=>({
  key:row.message_id,source_key:canonical,url:canonical,
  title:result.title,role:row.role,
  message_id:row.message_id,source_order:row.source_order,
  parent_id:row.parent_id,order_evidence:'source-ordinal',
  text:row.text,content:'['+row.role+']\n'+row.text
 }));
 const receipt=await acceptItems(items);
 return {...receipt,read_source:'original-message-chain',
  original_count:result.original_count,
  skipped_nontext:result.skipped};
}

function sourceOrderFailureLabel(status){
 if(!status)return '';
 const key=String(status);
 if(key==='source-paginated')return 'ChatGPT 只回傳部分歷史，不能假裝完整';
 if(key==='source-without-order')return '原始資料沒有可驗證的訊息鏈或序號';
 if(key==='source-http-401'||key==='source-http-403')
  return 'ChatGPT 原始對話讀取遭拒（'+key.slice(-3)+'）';
 if(key==='source-http-429')return 'ChatGPT 原始對話讀取遭流量限制（429）';
 if(key==='browser-source-unavailable'||key==='source-unavailable')
  return '瀏覽器無法讀取 ChatGPT 原始訊息鏈';
 if(key==='source-too-large'||key==='source-message-too-long')
  return '原始對話超過安全擷取上限';
 return key;
}
async function capture(tab,selection='',includeAssistant=false){
 // An authorized, read-only ChatGPT source snapshot supplies original message
 // order even when the visible page is virtualized. No DOM scrolling required.
 let sourceFailure='';
 if(!selection?.trim()){
  const source=await captureChatgptOriginalSequence(tab,includeAssistant);
  if(source&&!source.source_unavailable){
   return {...source,message:source.message+
    '；時序依據為原始對話訊息鏈'+
    (source.skipped_nontext?'；未入列無文字訊息 '+source.skipped_nontext+' 則':'')};
  }
  sourceFailure=sourceOrderFailureLabel(source?.source_unavailable);
 }
 await inject(tab.id);
 const reply=await chrome.tabs.sendMessage(tab.id,{type:'page.capture',selection,
  includeAssistant:includeAssistant===true});
 if(reply?.error)throw Error(String(reply.error)+
  (sourceFailure?'；原始對話讀取：'+sourceFailure:''));
 if(reply?.directQueued===true){
  // Full ChatGPT history is admitted in bounded viewport batches.
  return {message:String(reply.message||'已完成目前畫面擷取')+
   (sourceFailure?'；原始對話來源：'+sourceFailure:''),
   queued:await queueCount(),detected:reply.detected,
   user:reply.user,assistant:reply.assistant,
   insertedCaptures:reply.queuedCaptures||0,
   empty:!reply.queuedCaptures};
 }
 if(!Array.isArray(reply?.items))throw Error('頁面沒有回傳內容');
 if(!reply.items.length)throw Error('未找到可擷取的內容：目前頁面可能尚未載入對話，或網站 DOM 格式已變更');
 return acceptItems(reply.items);
}
async function recordedTab(){
 const {locRecorderTabId}=await chrome.storage.local.get('locRecorderTabId');
 if(Number.isInteger(locRecorderTabId)&&locRecorderTabId>0)
  return {id:locRecorderTabId};
 return currentTab();
}
async function selectOrRecord(type,includeAssistant=false,providedTab=null){
 const tab=providedTab||await currentTab();
 // Conversation recording is passive; scrolling is entirely controlled by the
 // reader. Missing original source ordinals fail before entering the Queue.
 if(isConversationSource(tab.url)&&type!=='page.record')
  throw Error('對話使用被動錄製或目前頁面擷取，不能以選取範圍取代完整時序');
 // One active recorder. Stop the prior tab before moving the recorder.
 const prior=(await chrome.storage.local.get('locRecorderTabId')).locRecorderTabId;
 if(type==='page.record'&&Number.isInteger(prior)&&prior!==tab.id)
  await chrome.tabs.sendMessage(prior,{type:'page.stop'}).catch(()=>{});
 await inject(tab.id);
 const response=await chrome.tabs.sendMessage(tab.id,{type,includeAssistant});
 if(response?.ok!==true)throw Error('頁面沒有啟動選取／錄製工具');
 if(type==='page.record')await chrome.storage.local.set({locRecorderTabId:tab.id});
 return {message:type==='page.record'
  ?(response.mode==='record'?'已開始錄製目前對話，新訊息將即時加入 Queue':'請點選錄製區域，開始追蹤動態貼文')
  :'請點選要擷取的區域',mode:response.mode};
}
async function controlRecording(type){
 const tab=await recordedTab();
 const reply=await chrome.tabs.sendMessage(tab.id,{type}).catch(()=>null);
 if(!reply?.ok)throw Error('目前頁面沒有可操作的錄製');
 return {message:type==='page.pause'?'已暫停錄製':type==='page.resume'?'已繼續錄製':'已停止錄製'};
}
async function stopRecording(){
 const tab=await recordedTab();
 const reply=await chrome.tabs.sendMessage(tab.id,{type:'page.stop'}).catch(()=>null);
 await chrome.storage.local.remove('locRecorderTabId');
 if(reply?.error)throw Error('最後一次錄製入列失敗：'+reply.error);
 return {message:reply?.ok
  ?(reply.partial?'已停止錄製；已完成訊息已入列，仍在生成的最後一則尚未擷取':
    '已停止錄製，最後已完成訊息已確認入列')
  :'目前頁面沒有正在進行的錄製'};
}

// Context-menu options must reflect the actual active recording state.
const RECORD_MENU_IDS=[MENU_PAGE,MENU_SELECTION,MENU_AREA,MENU_RECORD,MENU_PAUSE,MENU_RESUME,MENU_STOP];
function menuVisibility(mode='idle'){
 const active=['record','paused','pick-record'].includes(mode);
 return {
  [MENU_PAGE]:!active,[MENU_SELECTION]:!active,[MENU_AREA]:!active,
  [MENU_RECORD]:!active,[MENU_PAUSE]:mode==='record',
  [MENU_RESUME]:mode==='paused',[MENU_STOP]:active
 };
}
async function syncMenus(mode='idle'){
 const visibility=menuVisibility(mode);
 await Promise.all(RECORD_MENU_IDS.map(id=>
  chrome.contextMenus.update(id,{visible:visibility[id]})));
 chrome.contextMenus.refresh?.();
}
async function shownMode(tab){
 if(!tab?.id)return 'idle';
 const {locRecorderTabId}=await chrome.storage.local.get('locRecorderTabId');
 if(locRecorderTabId!==tab.id)return 'idle';
 const reply=await chrome.tabs.sendMessage(tab.id,{type:'page.status'}).catch(()=>null);
 const mode=String(reply?.mode||'idle');
 if(!['record','paused','pick-record'].includes(mode)){
  await chrome.storage.local.remove('locRecorderTabId');
  return 'idle';
 }
 return mode;
}
function installMenu(){
 chrome.contextMenus.removeAll().then(async()=>{
  chrome.contextMenus.create({id:MENU_ROOT,title:'LunArcus',contexts:['page','selection']});
  for(const [id,title,contexts] of [
   [MENU_PAGE,'擷取整頁／可見對話',['page','selection']],
   [MENU_SELECTION,'擷取選取文字',['selection']],
   [MENU_AREA,'選取頁面區域',['page','selection']],
   [MENU_RECORD,'開始動態錄製',['page','selection']],
   [MENU_PAUSE,'暫停錄製',['page','selection']],
   [MENU_RESUME,'繼續錄製',['page','selection']],
   [MENU_STOP,'停止錄製',['page','selection']]
  ])chrome.contextMenus.create({id,parentId:MENU_ROOT,title,contexts,
    visible:menuVisibility()[id]});
 }).catch(e=>console.warn('[LunArcus menu]',String(e)));
}
chrome.runtime.onInstalled.addListener(async()=>{
 installMenu();
 await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
 await chrome.alarms.create('lunarcus-retry',{periodInMinutes:5});
 await clearLegacyTabBadges().catch(()=>{});
 await updateQueueBadge().catch(e=>console.warn('[LOC Queue badge]',String(e)));
});
chrome.runtime.onStartup?.addListener(()=>{
 installMenu();
 void updateQueueBadge().catch(e=>console.warn('[LOC Queue badge]',String(e)));
});
chrome.contextMenus.onShown?.addListener((_info,tab)=>{
 void shownMode(tab).then(syncMenus).catch(e=>console.warn('[LOC menu status]',String(e)));
});
// The toolbar icon opens the native extension settings, never a capture Popup.
chrome.action.onClicked.addListener(()=>chrome.runtime.openOptionsPage());
chrome.contextMenus.onClicked.addListener((info,tab)=>{
 if(!tab?.id)return;
 const action=info.menuItemId;
 const label=({
  [MENU_PAGE]:'擷取整頁', [MENU_SELECTION]:'擷取選取文字',
  [MENU_AREA]:'選取區域', [MENU_RECORD]:'開始錄製',
  [MENU_PAUSE]:'暫停錄製',[MENU_RESUME]:'繼續錄製',[MENU_STOP]:'停止錄製'
 })[action]||'擷取';
 void (async()=>{
  const {locIncludeAssistant}=await chrome.storage.local.get('locIncludeAssistant');
  const ai=locIncludeAssistant===true;
  let result;
  switch(action){
   case MENU_PAGE:result=await capture(tab,'',ai);break;
   case MENU_SELECTION:result=await capture(tab,info.selectionText||'',ai);break;
   case MENU_AREA:result=await selectOrRecord('page.select',ai,tab);break;
   case MENU_RECORD:result=await selectOrRecord('page.record',ai,tab);break;
   case MENU_PAUSE:result=await controlRecording('page.pause');break;
   case MENU_RESUME:result=await controlRecording('page.resume');break;
   case MENU_STOP:result=await stopRecording();break;
   default:return;
  }
  if(action===MENU_RECORD)await syncMenus(result?.mode||'pick-record');
  if(action===MENU_PAUSE)await syncMenus('paused');
  if(action===MENU_RESUME)await syncMenus('record');
  if(action===MENU_STOP)await syncMenus('idle');
  await noteAction(label,!result?.empty,result?.message||'操作已完成',tab.id);
  await updateQueueBadge().catch(()=>{});
 })().catch(async e=>{
  console.warn('[LunArcus '+label+']',e);
  await noteAction(label,false,e?.message||String(e),tab.id);
  await updateQueueBadge().catch(()=>{});
 });
});
chrome.alarms.onAlarm.addListener(e=>{
 if(e.name==='lunarcus-retry')void flush(false).catch(async err=>{
   console.warn('[LunArcus Queue]',String(err));
   await noteAction('自動重試',false,err?.message||String(err));
  });
});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 (async()=>{
  switch(message?.action){
   case 'loc-connect':{
    const result=await connectLoc();
    // When an offline Queue reconnects, send every pending capture now.
    if(result?.connected)void flush(false).catch(async error=>{
      await noteAction('自動傳送',false,error?.message||String(error));
    });
    return result;
   }
   case 'loc-disconnect':return disconnectLoc();
   case 'loc-flush':{
    try{const result=await flush(true);await updateQueueBadge();await noteAction('手動傳送',true,result.message);return result;}
    catch(e){await noteAction('手動傳送',false,e?.message||String(e));throw e;}
   }
   case 'loc-status':{
    const [session,stats]=await Promise.all([
     chrome.storage.local.get([...AUTH_KEYS,'locImportPaused','locLastAction','locQueueRetryAfter','locQueueRetryType','locQueueFailures','locQueueRetryEndpoint','locQueueRetryStatus']),scanQueue()]);
    return {connected:Boolean(session.locOAuth?.refresh_token||session.locOAuth?.expires_at>Date.now()),
     configured:Boolean(session.locConfig),paused:session.locImportPaused===true,
     pending:stats.pending,pendingCaptures:stats.pendingCaptures,
     blockedReview:stats.blockedReview,legacyUnordered:stats.legacyUnordered,
     lastAction:session.locLastAction||null,
     nextRetryAt:Number(session.locQueueRetryAfter||0),
     retryReason:session.locQueueRetryType||'',
      retryEndpoint:session.locQueueRetryEndpoint||'',
      retryStatus:Number(session.locQueueRetryStatus||0),
     consecutiveFailures:Number(session.locQueueFailures||0)};
   }
   case 'loc-clear-diagnostics':{
    // Local-only action from the trusted Extension settings document.
    // Never touch the IndexedDB Queue, receipts, OAuth tokens, retry budget
    // or application data.
    const source=(sender?.url||sender?.documentUrl||'').split('#',1)[0];
    if(sender?.id!==chrome.runtime.id||source!==chrome.runtime.getURL('options.html'))
     throw Error('Only Extension settings may clear diagnostics');
    await chrome.storage.local.remove([DIAGNOSTIC_KEY,'locLastAction']);
    return {cleared:true};
   }
   case 'conversation.review':{
    // Trusted options page only; never expose private Queue text to websites.
    const source=(sender?.url||sender?.documentUrl||'').split('#',1)[0];
    if(sender?.id!==chrome.runtime.id||source!==chrome.runtime.getURL('options.html'))
     throw Error('訊息預覽僅允許在 LunArcus 設定頁開啟');
    return reviewGroups((await scanQueue({metadata:true})).rows);
   }
   case 'conversation.turn':{
    const source=(sender?.url||sender?.documentUrl||'').split('#',1)[0];
    if(sender?.id!==chrome.runtime.id||source!==chrome.runtime.getURL('options.html'))
     throw Error('完整訊息僅能在 LunArcus 訊息重整頁讀取');
    const id=String(message.id||'');
    if(!id||id.length>256)throw Error('無效的待送訊息 ID');
    const [row]=await loadQueueRows([id]).catch(()=>[null]);
    if(!row||row.kind!=='ordered_conversation')
     throw Error('訊息已不在待送 Queue，請重新整理預覽');
    return {id:row.id,source_order:row.source_order,role:row.role,
      text:String(row.text||'').slice(0,140000)};
   }
   case 'conversation.approve':{
    const source=(sender?.url||sender?.documentUrl||'').split('#',1)[0];
    if(sender?.id!==chrome.runtime.id||source!==chrome.runtime.getURL('options.html'))
     throw Error('只有 LunArcus 設定頁能確認訊息時序');
    return approveReviewedConversation(String(message.key||''),message.ids);
   }
   case 'loc-diagnostics':{
    const [stored,last]=await Promise.all([
     chrome.storage.local.get(DIAGNOSTIC_KEY),
     chrome.storage.local.get('locLastAction')
    ]);
    const lastAction=last.locLastAction&&typeof last.locLastAction==='object'?
     {...last.locLastAction,message:safeDiagnostic(last.locLastAction.message)}:null;
    return {logs:Array.isArray(stored[DIAGNOSTIC_KEY])?stored[DIAGNOSTIC_KEY]:[],lastAction};
   }
  }
  switch(message?.type){
   case 'capture.report':
    if(sender.id!==chrome.runtime.id||!sender.tab?.url)throw Error('Invalid recorder sender');
    if(typeof message.message!=='string'||message.message.length>350)
     throw Error('Invalid recorder status');
    await noteAction('動態錄製',message.ok===true,message.message,sender.tab.id);
    return {recorded:true};
   case 'items.captured':
    if(sender.id!==chrome.runtime.id||!sender.tab?.url)throw Error('Invalid capture sender');
    try{
     if(!Array.isArray(message.items)||!message.items.length||message.items.length>100)
      throw Error('Invalid capture items');
     if(message.items.some(item=>{
      try{return !captureSourceMatches(sender.tab.url,item?.url)||
       !captureSourceMatches(sender.tab.url,item?.source_key)}catch{return true}
     }))throw Error('Source origin mismatch');
     const result=await acceptItems(message.items);
     await noteAction('動態擷取',!result.empty,result.message,sender.tab.id);
     return result;
    }catch(error){
     await noteAction('動態擷取',false,error?.message||String(error),sender.tab.id);
     throw error;
    }
   case 'capture':return capture(await currentTab(),'',message.includeAssistant===true);
   case 'select':return selectOrRecord('page.select',message.includeAssistant===true);
   case 'record.start':return selectOrRecord('page.record',message.includeAssistant===true);
   case 'record.pause':return controlRecording('page.pause');
   case 'record.resume':return controlRecording('page.resume');
   case 'record.stop':return stopRecording();
   case 'queue.status':{const stats=await scanQueue({bytes:true});const s=await chrome.storage.local.get('locImportPaused');return {count:stats.pending,bytes:stats.bytes,paused:s.locImportPaused===true};}
   case 'queue.scope':{const scopeid=String(message.scopeid||'');if(!SCOPE.test(scopeid))throw Error('Invalid Scope');await chrome.storage.local.set({locTargetScope:scopeid});return {message:'目的銀河：'+scopeid};}
   case 'queue.flush':return flush(true);
   case 'loc.open':await chrome.runtime.openOptionsPage();return {message:'請選擇連接 LOC 完成授權'};
   default:throw Error('Unknown LunArcus action');
  }
 })().then(respond).catch(e=>respond({error:String(e?.message||e)}));return true;
});
