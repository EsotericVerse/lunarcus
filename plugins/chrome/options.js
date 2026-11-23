const $=id=>document.getElementById(id);
const status=$('status'), queue=$('queue'), notice=$('notice');
// Options uses the existing Extension service worker only. No new backend.
async function call(action,payload={}){
 const result=await chrome.runtime.sendMessage({action,...payload});
 if(result?.error)throw Error(String(result.error));
 return result||{};
}
function formatLocalActionTime(value){
 const time=new Date(value);
 return Number.isFinite(time.getTime())?time.toLocaleString('zh-TW'):'時間未知';
}
function setAuthIndicator(connected){
 const badge=$('authStateBadge');
 if(!badge)return;
 badge.classList.toggle('state-waiting',!connected);
 badge.classList.toggle('state-connected',connected);
 badge.replaceChildren();
 const light=document.createElement('span');
 light.className='state-light';
 light.setAttribute('aria-hidden','true');
 badge.append(light,document.createTextNode(connected?'已連接':'尚未連接'));
}

// Use the status already fetched for the six-key console: no extra polling.
let overviewStatus=null;
function renderOverviewGuidance(result){
 overviewStatus=result;
 const title=$('overview-next-title');
 const description=$('overviewNextDescription');
 const link=$('overviewNextLink');
 const recent=$('overviewRecent');
 const pending=Number(result.pending)||0;
 let action=null;
 if(result.error){
  title.textContent='連線狀態需要檢查';
  description.textContent='目前無法確認連線與 Queue 狀態，請查看操作紀錄中的診斷資訊。';
  action={href:'#activity',label:'查看 Queue 與紀錄'};
 }else if(!result.connected){
  title.textContent='先建立 LOC 身分連線';
  description.textContent=pending
   ?'本機仍有 '+pending+' 筆資料待送。先使用上方「連接 LunArcus Auth」，Queue 會保留原有資料。'
   :'使用上方「連接 LunArcus Auth」完成授權。擷取時才會加入本機 Queue。';
 }else if(result.paused){
  title.textContent='Queue 暫時保留中';
  description.textContent='自動送出已暫停。請在 Queue 頁查看原因，需要時手動處理；原有資料不會因切頁而清除。';
  action={href:'#activity',label:'查看 Queue 狀態'};
 }else if(pending>0){
  title.textContent='有 '+pending+' 筆資料等待送出';
  description.textContent='內容已暫存在本機。可以前往 Queue 檢視送出情況與最近一次操作。';
  action={href:'#activity',label:'檢視待送資料'};
 }else{
  title.textContent='LunArcus 已可使用';
  description.textContent='在要保存的網頁上按右鍵，選擇 LunArcus 的擷取功能。';
  action={href:'#capture',label:'查看擷取方法'};
 }
 link.hidden=!action;
 if(action){link.href=action.href;link.textContent=action.label+' →';}
 const last=result.lastAction;
 recent.textContent=last
  ?(last.ok?'成功':'失敗')+' · '+last.name+' · '+formatLocalActionTime(last.at)
  :'尚無操作紀錄';
}
async function show(){
 const [result,saved]=await Promise.all([
  call('loc-status'),
  chrome.storage.local.get(['locTargetScope','locIncludeAssistant'])
 ]);
 status.textContent=result.error||(result.connected?'已連接 LunArcus Auth':'尚未連接 LunArcus Auth');
 setAuthIndicator(Boolean(result.connected));
 $('captureCount').textContent='按需';
 $('itemCount').textContent=result.error?'—':String(result.pending??0);
 const destination=result.retryEndpoint==='MCP'?'LAS MCP':
  result.retryEndpoint==='LOC'?'LOC API':'傳送端';
 const code=Number(result.retryStatus||0);
 const failure=code?'HTTP '+code:'網路連線中斷';
 const cooldown=result.nextRetryAt>Date.now()?
  ('；'+(result.retryReason==='rate'?'流量管制':
    result.retryReason==='network'?'網路連線失敗':'暫時服務異常')+
   '（'+destination+'／'+failure+'），自動重試延後至 '+
   new Date(result.nextRetryAt).toLocaleString('zh-TW')):'';
 const reviewBlocked=Number(result.blockedReview||0);
 const legacyBlocked=Number(result.legacyUnordered||0);
 queue.textContent='待送 Queue：'+(result.pending??0)+' 筆資料（群組與時序於訊息重整頁按需查閱）'+
   (Number(result.pending||0)>256?'；寫入依大小動態分批，不會因 Queue 筆數過多而停止傳送':'')+
  (reviewBlocked?'；'+reviewBlocked+' 則待確認時序（第六鍵）':'')+
  (legacyBlocked?'；'+legacyBlocked+' 筆舊式無序對話不可匯入，可清空本機暫存':'')+
  (result.paused?'；自動送出已暫停，原始 Queue 保留':'')+cooldown;
 renderOverviewGuidance(result);
 const last=result.lastAction;
 $('lastAction').textContent=last?
  (last.ok?'成功':'失敗')+' · '+last.name+' · '+formatLocalActionTime(last.at)+'\n'+last.message:
  '目前沒有操作紀錄。';
 $('scope').value=saved.locTargetScope||'lo3rwang';
 $('includeAI').checked=saved.locIncludeAssistant===true;

}
$('connect').addEventListener('click',async()=>{
 status.textContent='正在進行 LOC 授權…';
 try{
  const result=await call('loc-connect');
  status.textContent=result.error||(result.connected?'已連接 LunArcus Auth':'LunArcus 授權未完成');
  if(!result.error){
   setAuthIndicator(Boolean(result.connected));
   renderOverviewGuidance({...overviewStatus,connected:Boolean(result.connected),error:null});
  }

 }catch(error){status.textContent=String(error?.message||error);}
});
$('disconnect').addEventListener('click',async()=>{
 try{
  const result=await call('loc-disconnect');
  status.textContent=result.error||result.warning||
   (result.serverRevoked?'已撤銷伺服器授權；Queue 保留':'已解除連線；Queue 保留');
  if(!result.error){
   setAuthIndicator(false);
   renderOverviewGuidance({...overviewStatus,connected:false,error:null});
  }
 }catch(error){status.textContent=String(error?.message||error);}
});
$('refresh').addEventListener('click',()=>{
 void show().catch(error=>status.textContent=String(error?.message||error));
});
$('scope').addEventListener('change',async()=>{
 const input=$('scope');
 if(!input.checkValidity()){notice.textContent='Scope ID 格式錯誤；未修改目的地';return;}
 try{
  const result=await chrome.runtime.sendMessage({type:'queue.scope',scopeid:input.value});
  notice.textContent=result.error||result.message||'目的 Scope 已儲存';
 }catch(error){notice.textContent=String(error?.message||error);}
});
$('includeAI').addEventListener('change',async()=>{
 const checkbox=$('includeAI');
 const next=checkbox.checked;
 checkbox.disabled=true;
 try{
  await chrome.storage.local.set({locIncludeAssistant:next});
  notice.textContent=next
   ?'對話擷取已包含 AI 回覆（使用者訊息仍會保存）'
   :'對話擷取只保存使用者訊息，不包含 AI 回覆';
 }catch(error){
  checkbox.checked=!next;
  notice.textContent='AI 回覆偏好儲存失敗：'+String(error?.message||error);
 }finally{checkbox.disabled=false;}
});
$('diagnostics').addEventListener('click',async()=>{
 try{
  const result=await call('loc-diagnostics');
  const text=JSON.stringify({captured_at:new Date().toISOString(),...result},null,2);
  await navigator.clipboard.writeText(text);
  notice.textContent='診斷紀錄已複製；可直接貼上提供紀錄。';
 }catch(error){notice.textContent='診斷紀錄複製失敗：'+String(error?.message||error);}
});
$('clearDiagnostics').addEventListener('click',async()=>{
 const button=$('clearDiagnostics');
 button.disabled=true;
 try{
  const result=await call('loc-clear-diagnostics');
  if(result?.cleared!==true)throw Error(result?.error||'無法確認紀錄已清理');
  $('lastAction').textContent='目前沒有操作紀錄。';
  if(overviewStatus)renderOverviewGuidance({...overviewStatus,lastAction:null});
  notice.textContent='已清理本機診斷紀錄；待送 Queue、授權與重試設定均保留。';
 }catch(error){notice.textContent='清理紀錄失敗：'+String(error?.message||error)}
 finally{button.disabled=false}
});
$('clearLocalCaptures').addEventListener('click',async()=>{
 const confirmed=window.confirm('確定清空全部本機擷取 Queue 與去重回執？未送出的對話無法復原，LOC 已寫入資料與 OAuth 不受影響。');
 if(!confirmed)return;
 const button=$('clearLocalCaptures');
 button.disabled=true;
 try{
  const result=await call('loc-clear-local-captures');
  if(result?.cleared!==true)throw Error(result?.error||'本機清理沒有完成');
  $('organizeGroups')?.replaceChildren();
  $('organizeSummary').textContent='本機待重整對話已清空';
  await show();
  notice.textContent=result.message;
 }catch(error){notice.textContent='清理失敗：'+String(error?.message||error);}
 finally{button.disabled=false;}
});
$('flush').addEventListener('click',async()=>{
 notice.textContent='正在送出 Queue…';
 try{
  const result=await call('loc-flush');
  await show();
  notice.textContent=result.error||result.message||'已處理';
 }catch(error){notice.textContent=String(error?.message||error);}
});
chrome.storage.onChanged?.addListener((changes,area)=>{
 if(area==='local'&&changes.locLastAction?.newValue){
  void show().catch(error=>status.textContent=String(error?.message||error));
 }
});
show().catch(error=>status.textContent=String(error?.message||error));


let organizeFlight=false;
function organizerElement(tag,cls,value){
 const element=document.createElement(tag);
 if(cls)element.className=cls;
 if(value!=null)element.textContent=String(value);
 return element;
}
async function renderOrganizer(){
 const root=$('organizeGroups'),summary=$('organizeSummary'),feedback=$('organizeNotice');
 root.replaceChildren();
 feedback.textContent='';
 const result=await call('conversation.review');
 if(Number(result.oversized_queue)>0){
  summary.textContent='本機 Queue 過大（'+result.oversized_queue+' 筆），為避免記憶體暴增已停止讀取';
  root.append(organizerElement('p','field-hint',
   '此處不會載入整份舊對話。請在 Queue 頁按「清空本機擷取暫存」，釋放舊資料；不影響 LOC 已寫入內容。'));
  return;
 }
 const groups=Array.isArray(result.conversations)?result.conversations:[];
 summary.textContent=groups.length+' 組對話／'+Number(result.ordered_count||0)+
  ' 則待送訊息；不支援的無序對話 '+Number(result.legacy_count||0)+' 則（不會送出）';
 if(!groups.length){
  root.append(organizerElement('p','field-hint','目前沒有待重整的有序對話。'));
  return;
 }
 for(const group of groups){
  const section=organizerElement('section','organize-group');
  section.append(organizerElement('h3',null,group.title||'對話'));
  section.append(organizerElement('p','field-hint',
   (group.valid?'原始時序有效':'原始序號或訊息識別衝突，禁止送出')+
   ' · '+group.message_count+' 則 · '+group.scopeid));
  const details=organizerElement('details','organize-details');
  details.append(organizerElement('summary',null,'檢視排序後的訊息（'+group.message_count+'）'));
  const list=organizerElement('ol','organize-timeline');
  for(const turn of group.messages){
   const item=organizerElement('li');
   item.append(organizerElement('div','organize-turn-heading',
      '#'+turn.source_order+' · '+(turn.role==='user'?'使用者':'AI 回覆')),
     organizerElement('p','organize-turn-text',turn.preview));
   const expand=organizerElement('button','button button-ghost organize-turn-expand','閱讀完整訊息');
   expand.type='button';
   expand.addEventListener('click',async()=>{
    expand.disabled=true;
    try{
     const message=await call('conversation.turn',{id:turn.id});
     const full=organizerElement('pre','organize-turn-full',message.text);
     item.querySelector('.organize-turn-full')?.remove();
     item.append(full);
     expand.textContent='重新讀取完整訊息';
    }catch(error){$('organizeNotice').textContent=String(error?.message||error);}
    finally{expand.disabled=false;}
   });
   item.append(expand);
   list.append(item);
  }
  details.append(list);section.append(details);
  const button=organizerElement('button','button button-primary',
   group.ready?'已整理，送出 Queue':'確認時序並送出');
  button.type='button';
  button.disabled=!group.valid||organizeFlight;
  button.addEventListener('click',async()=>{
   if(organizeFlight)return;
   organizeFlight=true;button.disabled=true;
   feedback.textContent='正在確認時序並送出 Queue…';
   try{
    const approval=await call('conversation.approve',{
      key:group.key,ids:group.messages.map(m=>m.id)});
    if(approval.ready!==true)throw Error('時序確認失敗');
    const sent=await call('loc-flush');
    feedback.textContent=sent.message||'Queue 已處理；未收到回執的資料仍保留';
    await show();
    await renderOrganizer();
   }catch(error){feedback.textContent='未確認送達：'+String(error?.message||error);}
   finally{organizeFlight=false;button.disabled=false;}
  });
  section.append(button);root.append(section);
 }
}
$('organizeRefresh').addEventListener('click',async()=>{
 $('organizeNotice').textContent='正在整理本機訊息…';
 try{await renderOrganizer();}
 catch(error){$('organizeNotice').textContent=String(error?.message||error);}
});
window.addEventListener('hashchange',()=>{
 if(window.location.hash==='#organize')
  void renderOrganizer().catch(error=>$('organizeNotice').textContent=String(error?.message||error));
});
if(window.location.hash==='#organize')
 void renderOrganizer().catch(error=>$('organizeNotice').textContent=String(error?.message||error));
