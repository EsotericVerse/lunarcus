// LOC 網站／舊對話頁面的可見 DOM 擷取；不呼叫 OAuth 或 MCP。
(() => {
  if (globalThis.__locCaptureV2) return;
  const state = {mode:'idle', root:null, observer:null, timer:null, hover:null, includeAssistant:false, seen:new Set(), sending:new Set(), pendingWrites:new Set(), emptyReported:false, scanning:false, rescan:false};
  const visible = el => {
    if (!(el instanceof Element)) return false;
    const style=getComputedStyle(el);
    return style.display!=='none' && style.visibility!=='hidden' && el.getClientRects().length>0;
  };
  const normalizeUrl = value => {
    try {
      const url=new URL(value,location.href);
      if(!/^https?:$/.test(url.protocol))return null;
      url.hash='';
      for(const key of [...url.searchParams.keys()])if(/^utm_|^fbclid$|^igshid$/i.test(key))url.searchParams.delete(key);
      return url.href;
    } catch { return null; }
  };
  const cleanText = el => String(el?.innerText||el?.textContent||'')
    .replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').trim().slice(0,1400000);
  const inViewport = el => {
    const rect=el.getBoundingClientRect();
    return rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight;
  };
  const sourceModel=globalThis.LasCaptureSourceModel;
  const socialHost=()=>Boolean(sourceModel?.isSocialHost(location.hostname));
  const socialPostUrl=url=>Boolean(sourceModel?.permalink(url,location.href));
  const links = el => [...el.querySelectorAll('a[href]')]
    .filter(visible).slice(0,120).map(a=>({text:cleanText(a).slice(0,120),url:normalizeUrl(a.getAttribute('href'))}))
    .filter(x=>x.url);
  const stableSource = el => {
    if(socialHost())return sourceModel.sourceForCard(el,location.href)?.url||null;
    return normalizeUrl(location.href);
  };
  // ChatGPT and Claude change markup independently. Identify a message turn by
  // its role metadata or the semantic labels on the rendered conversation
  // article, not only by one generation of data-message-author-role.
  const TURN_SELECTOR='[data-testid^="conversation-turn-"],[data-message-id],'+
    '[data-message-author-role],[data-testid="user-message"],'+
    '[data-testid="assistant-message"],article[aria-label]';
  const CHAT_HOST=/(?:^|\.)chatgpt\.com$|(?:^|\.)chat\.openai\.com$/;
  // The complete ChatGPT Shadow extractor handles both the legacy author-role
  // markup and 2026 search-unit turns, including markdown and message IDs.
  // Only this bridge adapts its records to LOC's existing Queue contract.
  function shadowConversationTurns(scope,includeAssistant=false,mode='capture'){
    const upstream=globalThis.ChatGPTShadowExtract;
    if(!upstream)throw Error('ChatGPT Shadow 擷取模組未載入');
    const threadId=upstream.conversationIdFromUrl(location.href);
    const pendingId=upstream.localConversationIdFromUrl(location.href);
    // The URL is the durable Galaxy source identity. Never archive a local
    // placeholder or attach old DOM turns to the next conversation on SPA nav.
    if(!threadId||pendingId)return [];
    // Canonical source identity must remain stable across project routes,
    // query strings and SPA navigation around one conversation.
    const source='https://chatgpt.com/c/'+threadId;
    // Never stop an entire chat because one turn is still generating.
    // A visible Stop button is the only active-generation signal; save all
    // completed turns in both whole-page capture and ongoing recording.
    const streaming=upstream.isStreaming(document);
    const title=upstream.extractTitle(document);
    const rows=upstream.messagesForUrl(upstream.extractMessages(scope),location.href);
    const pendingIndex=streaming?rows.findLastIndex(row=>row.role==='assistant'):-1;
    const captured=rows.filter((row,index)=>
      row.role==='user'||(includeAssistant&&row.role==='assistant'&&index!==pendingIndex))
      .filter(row=>typeof row.content==='string'&&row.content.trim());
    // A virtualized viewport can contain only user turns; this must not
    // erase valid captured messages when assistant replies are mounted elsewhere.
    return captured.map(row=>({
        key:upstream.stableMessageId(threadId,row),source_key:source,url:source,
        title,role:row.role,
        message_id:row.id&&!row.id.startsWith('search-unit:')?row.id:
          (row.source_order!=null?'source-ordinal:'+row.source_order:null),
        source_order:row.source_order??null,parent_id:row.parent_id??null,
        sent_at:row.sent_at??null,order_evidence:row.order_evidence||'unavailable',
        text:row.content.slice(0,140000)
      }));
  }
  // Respect the user's reading position. ChatGPT virtualizes older turns,
  // so a DOM snapshot is deliberately partial; never drive scrollTop here.
  // Passive recording observes newly mounted turns as the user scrolls.
  async function captureChatHistory(includeAssistant){
    if(state.historyCapture)throw Error('對話擷取正在入列');
    if(state.mode==='record'||state.mode==='paused')
      throw Error('正在錄製中：請依平常方式閱讀，已載入訊息會增量入列；不會自動捲動');
    const href=normalizeUrl(location.href);
    const main=document.querySelector('main')||document.body;
    state.historyCapture=true;
    try{
      const rows=shadowConversationTurns(main,includeAssistant,'capture');
      if(normalizeUrl(location.href)!==href)
        throw Error('擷取期間已切換對話，未寫入 Queue');
      if(!rows.length)
        return {directQueued:true,detected:0,user:0,assistant:0,queuedCaptures:0,
          partial:true,message:'目前沒有已載入的可辨識訊息；頁面未捲動，Queue 未變動。'};
      const user=rows.filter(row=>row.role==='user'||row.content?.startsWith('[user]\n')).length;
      const assistant=rows.filter(row=>row.role==='assistant'||row.content?.startsWith('[assistant]\n')).length;
      const missingAssistant=Boolean(includeAssistant&&user>0&&assistant===0);
      const result=await queuePublish(rows);
      if(result.error)throw Error('目前已載入的對話入列失敗：'+result.error);
      const queuedCaptures=Number(result.insertedCaptures||0);
      return {directQueued:true,detected:rows.length,user,assistant,queuedCaptures,
        partial:true,message:'已擷取目前載入 '+rows.length+' 則（使用者 '+user+
          '／AI '+assistant+'），本次新增 Queue '+queuedCaptures+
          ' 則。未自動捲動；這不是完整歷史。'+
          (missingAssistant?'注意：目前載入範圍未辨識到 AI 回覆，已保留使用者訊息；請在「訊息重整」檢查並正常閱讀補抓回覆。':'')+
          '需要更多訊息請啟動錄製並正常閱讀、捲動，擷取會跟隨已載入內容。'};
    }finally{
      state.historyCapture=false;
    }
  }
  function roleOf(turn){
    const own=(turn.getAttribute?.('data-message-author-role')||
      turn.getAttribute?.('data-role')||'').toLowerCase();
    if(own==='user'||own==='assistant')return own;
    const testid=(turn.getAttribute?.('data-testid')||'').toLowerCase();
    if(testid==='user-message')return 'user';
    if(testid==='assistant-message')return 'assistant';
    // Modern ChatGPT places the role on a child of the turn, not its article.
    const direct=turn.querySelector?.('[data-message-author-role="user"],'+
      '[data-message-author-role="assistant"],[data-testid="user-message"],'+
      '[data-testid="assistant-message"]');
    if(direct){
      const attr=direct.getAttribute('data-message-author-role');
      if(attr==='user'||attr==='assistant')return attr;
      return direct.getAttribute('data-testid')==='user-message'?'user':'assistant';
    }
    const headings=[...(turn.querySelectorAll?.('h5,h6,[class*="sr-only"]')||[])];
    const labels=[turn.getAttribute?.('aria-label')||'',
      ...headings.slice(0,12).map(n=>String(n.textContent||'').trim())]
      .join(' ').toLowerCase();
    if(/you said|你說|你说|您說|您说|user message|human:/.test(labels))
      return 'user';
    if(/chatgpt said|claude said|assistant message|assistant:/.test(labels))
      return 'assistant';
    return '';
  }
  function conversationTurns(scope,includeAssistant=false){
    const nodes=[...(scope.matches?.(TURN_SELECTOR)?[scope]:[]),
      ...(scope.querySelectorAll?.(TURN_SELECTOR)||[])];
    const hits=[],visited=new Set(),url=normalizeUrl(location.href);
    for(const node of nodes){
      // Resolve one canonical turn from nested message/test-id nodes.
      const turn=node.closest?.('[data-testid^="conversation-turn-"]')||
        node.closest?.('[data-message-id]')||
        node.closest?.('article[aria-label],article[data-message-author-role]')||
        node.closest?.('[data-message-author-role]')||node;
      if(visited.has(turn)||!visible(turn))continue;
      const role=roleOf(turn);
      if(!['user','assistant'].includes(role))continue;
      visited.add(turn);
      if(role==='assistant'&&!includeAssistant)continue;
      const message=turn.querySelector?.(role==='user'?
        '[data-testid="user-message"],[data-message-author-role="user"]':
        '[data-testid="assistant-message"],[data-message-author-role="assistant"]');
      const body=message||turn.querySelector?.(role==='user'?
        '.whitespace-pre-wrap,[data-testid="message-text-content"]':
        '.markdown.prose,[data-testid="message-text-content"]');
      const text=cleanText(body||turn);
      if(!text)continue;
      const key=turn.getAttribute?.('data-message-id')||
        turn.getAttribute?.('data-testid')||role+':'+text.slice(0,150);
      hits.push({key,source_key:url,url,title:document.title,
        content:'['+role+']\n'+text+'\n'+links(body||turn)
          .map(x=>x.text+' <'+x.url+'>').join('\n')});
    }
    if(hits.length)return hits;
    // ChatGPT's user bubbles are sometimes rendered without author-role IDs.
    // Only inspect the conversation in main, never sidebar/navigation or input.
    if(CHAT_HOST.test(location.hostname.toLowerCase())){
      const region=scope===document.body?
        document.querySelector?.('main')||scope:scope;
      if(!region||!(region===document.body||region.closest?.('main')||
        region.matches?.('main')||region.querySelector?.('main')))return [];
      const bubbles=[...(region.matches?.('[data-testid="user-message"],.whitespace-pre-wrap')?[region]:[]),
        ...(region.querySelectorAll?.('[data-testid="user-message"],.whitespace-pre-wrap')||[])];
      for(const bubble of bubbles){
        if(!visible(bubble)||bubble.closest?.('nav,aside,form,[role="navigation"],[contenteditable="true"]'))continue;
        const turn=bubble.closest?.('[data-testid^="conversation-turn-"],article')||bubble;
        const knownRole=roleOf(turn);
        if(visited.has(turn)||knownRole==='assistant')continue;
        // An unlabelled whitespace bubble must not be treated as a user
        // message when it is inside an assistant-rendered markdown response.
        if(knownRole!=='user'&&bubble.getAttribute?.('data-testid')!=='user-message'&&
          bubble.closest?.('.markdown,[data-testid="assistant-message"]'))continue;
        const text=cleanText(bubble);
        if(!text)continue;
        visited.add(turn);
        hits.push({key:turn.getAttribute?.('data-message-id')||
          turn.getAttribute?.('data-testid')||'user-bubble:'+text.slice(0,150),
          source_key:url,url,title:document.title,content:'[user]\n'+text});
      }
    }
    return hits;
  }
  // LOC #1765 pattern: declared source paths, one bounded projection runner.
  // Never infer an entire web app/sidebar as a single conversation turn.
  function modelConversationTurns(scope,provider,includeAssistant=false,mode='capture'){
    const identity=sourceModel?.conversationUrl(location.href);
    const registry=globalThis.LasConversationSourceModel;
    const profile=registry?.profileFor(provider,location.hostname.toLowerCase());
    if(identity?.provider!==provider||!profile)return [];
    const rows=registry.project(profile,scope,{
      includeAssistant,record:mode==='record',visible,readText:cleanText,fingerprint
    });
    return rows.map(row=>({
      key:row.key,source_key:identity.url,url:identity.url,
      title:document.title,role:row.role,
      message_id:row.sourceId|| (row.source_order!=null?'source-ordinal:'+row.source_order:null),
      source_order:row.source_order??null,parent_id:row.parent_id??null,
      sent_at:row.sent_at??null,order_evidence:row.order_evidence||'unavailable',
      text:row.content.slice(0,140000)
    }));
  }
  function extract(scope, mode='capture',includeAssistant=state.includeAssistant){
    const doc=scope||document.body;
    const hostname=location.hostname.toLowerCase();
    if(CHAT_HOST.test(hostname)){
      // Use the vendored 2026 ChatGPT extractor for every manual/recording
      // mode; do not run the old ChatGPT fallback in parallel.
      const region=mode==='record'||doc===document.body?
        (doc.closest?.('main')||doc.querySelector?.('main')||doc):doc;
      return shadowConversationTurns(region,includeAssistant,mode);
    }
    if(hostname==='claude.ai'||hostname==='gemini.google.com'){
      const region=mode==='record'||doc===document.body?
        (doc.closest?.('main')||doc.querySelector?.('main')||doc):doc;
      return modelConversationTurns(region,hostname==='claude.ai'?'claude':'gemini',
        includeAssistant,mode);
    }
    // Never clone the entire live DOM. A heavy SPA can require hundreds
    // of MB just to duplicate its React-rendered document.
    // The bounded article/visible DOM projection below is sufficient.
    const articles=[...doc.querySelectorAll('article,[role="article"],[data-testid="post-container"]')]
      .filter(el=>visible(el)&&(mode!=='record'||inViewport(el))&&cleanText(el).length>=25);
    // Threads may render cards as generic DIVs rather than <article>.
    // Follow only already-rendered permanent links; never invent a source
    // or treat the whole infinite feed as a single post.
    if(socialHost()){
      for(const a of [...doc.querySelectorAll('a[href]')].slice(0,500)){
        if(!socialPostUrl(normalizeUrl(a.href)))continue;
        const parent=a.closest('article,[role="article"],[data-testid="post-container"]')||
          a.closest('[data-pressable-container]')||a.parentElement?.parentElement?.parentElement;
        if(parent&&visible(parent)&&(mode!=='record'||inViewport(parent))&&
          cleanText(parent).length>=25)articles.push(parent);
      }
    }
    const unique=[...new Set(articles)];
    // Never archive an entire social post page as one record: that includes
    // comments, recommendations and unrelated feed cards under one identity.
    const cards=(unique.length?unique:(mode==='record'||socialHost()?[]:[doc])).slice(0,50);
    const emittedSources=new Set();
    return cards.map(el=>{
      const source=stableSource(el);
      const text=cleanText(el);
      if(!source||!text||emittedSources.has(source))return null;
      emittedSources.add(source);
      const hrefs=links(el).map(x=>x.text+' <'+x.url+'>').join('\n');
      const media=[...el.querySelectorAll('img[src],video[src],video[poster],source[src]')]
        .filter(visible).slice(0,24).map(node=>
          normalizeUrl(node.currentSrc||node.src||node.getAttribute('poster')||''))
        .filter(Boolean);
      const mediaText=[...new Set(media)].map(u=>'<'+u+'>').join('\n');
      const date=el.querySelector('time[datetime]')?.getAttribute('datetime');
      return {key:source,source_key:source,url:source,
        title:el.querySelector('h1,h2,h3')?.textContent?.trim()||document.title,
        content:(date?'[時間] '+date+'\n':'')+text+(hrefs?'\n[連結]\n'+hrefs:'')+
          (mediaText?'\n[媒體來源]\n'+mediaText:'')};
    }).filter(Boolean);
  }
  function fingerprint(value){
    const text=String(value||'');
    let a=2166136261,b=16777619;
    for(let i=0;i<text.length;i++){
      const code=text.charCodeAt(i);
      a=Math.imul(a^code,16777619);
      b=Math.imul(b+code,2246822519);
    }
    return text.length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16);
  }
  async function reportCapture(message,ok=false){
    feedback(message,ok);
    try{await chrome.runtime.sendMessage({type:'capture.report',
      message:String(message).slice(0,350),ok});}catch{}
  }
  async function publish(items){
    const pending=[];
    for(const item of items){
      const key=item.source_key+':'+(item.key||'')+':'+fingerprint(typeof item.text==='string'?item.text:item.content);
      if(state.seen.has(key)||state.sending.has(key))continue;
      state.sending.add(key);pending.push({item,key});
    }
    if(!pending.length)return {accepted:0,queued:false};
    let accepted=0,insertedCaptures=0,queued=0;
    try{
      // A long conversation must be recorded in 100-turn chunks;
      // partial Queue acknowledgements survive a later failed chunk.
      for(let offset=0;offset<pending.length;offset+=12){
        const part=pending.slice(offset,offset+12);
        const result=await chrome.runtime.sendMessage({
          type:'items.captured',items:part.map(({item})=>item)
        });
        if(result?.error)throw Error(result.error);
        if(!result||!Number.isInteger(result.queued)||result.queued<0)
          throw Error('LOC Queue 沒有回傳入列確認');
        if(state.seen.size>=5000)state.seen.clear();
        for(const {key} of part)state.seen.add(key);
        accepted+=part.length;
        insertedCaptures+=Number(result.insertedCaptures||0);
        queued=result.queued;
      }
      state.emptyReported=false;
      return {accepted,insertedCaptures,queued};
    }catch(error){
      const reason=String(error?.message||error);
      void reportCapture('錄製擷取未全部入列（已確認 '+accepted+'/'+pending.length+' 則）：'+reason,false);
      return {accepted,insertedCaptures,error:reason,queued};
    }finally{
      for(const {key} of pending)state.sending.delete(key);
    }
  }
  function queuePublish(items){
    const current=publish(items);
    state.pendingWrites.add(current);
    void current.finally(()=>state.pendingWrites.delete(current));
    return current;
  }
  function scan(){
    if(!state.root||state.mode!=='record')return;
    if(state.scanning){state.rescan=true;return;}
    if(state.timer)clearTimeout(state.timer);
    state.timer=setTimeout(async()=>{
      state.timer=null;
      if(state.mode!=='record'||state.scanning)return;
      state.scanning=true;
      try{
        const items=extract(state.root,'record',state.includeAssistant);
        if(!items.length){
          if(!state.emptyReported){
            state.emptyReported=true;
            void reportCapture('錄製中暫無可辨識訊息；不保留大型頁面快照。',false);
          }
        }else{
          // Wait for Queue acknowledgement before admitting another scan.
          await queuePublish(items);
        }
      }catch(error){
        if(!state.emptyReported){
          state.emptyReported=true;
          void reportCapture(String(error?.message||error),false);
        }
      }finally{
        state.scanning=false;
        if(state.rescan&&state.mode==='record'){
          state.rescan=false;
          scan();
        }else state.rescan=false;
      }
    },1500);
  }
  function stopWatching(){
    state.observer?.disconnect();
    state.observer=null;
    window.removeEventListener('scroll',scan);
    if(state.timer)clearTimeout(state.timer);
    state.timer=null;
  }
  function watch(){
    if(!state.root)return false;
    stopWatching();
    state.mode='record';
    state.observer=new MutationObserver(scan);
    state.observer.observe(state.root,{childList:true,subtree:true,characterData:true,attributes:false});
    window.addEventListener('scroll',scan,{passive:true});
    scan();
    return true;
  }
  function stop(){
    stopWatching();state.mode='idle';state.emptyReported=false;
    state.root=null;state.seen.clear();state.rescan=false;
    state.hover?.remove();state.hover=null;
    document.removeEventListener('mousemove',move,true);
    document.removeEventListener('click',choose,true);
  }
  function move(event){
    if(state.mode!=='select'&&state.mode!=='pick-record')return;
    const el=event.target.closest('article,[role="article"],main,section')||event.target;
    if(el instanceof Element&&visible(el)){
      const rect=el.getBoundingClientRect();
      if(!state.hover){state.hover=document.createElement('div');state.hover.style.cssText=
        'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:#3b82f61a;box-sizing:border-box';
        document.documentElement.append(state.hover);}
      Object.assign(state.hover.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
    }
  }
  function choose(event){
    if(state.mode!=='select'&&state.mode!=='pick-record')return;
    event.preventDefault();event.stopImmediatePropagation();
    const target=event.target;
    const recording=state.mode==='pick-record';
    const chat=/^(?:chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com)$/.test(location.hostname);
    const main=recording&&chat&&(target.closest?.('main')||document.querySelector?.('main'));
    const root=main||(state.mode==='pick-record'?
      (target.closest('[role="feed"],main,section')||target.closest('article,[role="article"]')?.parentElement||target):
      (target.closest('article,[role="article"],main,section')||target));
    if(!(root instanceof Element))return;
    stop();state.root=root;state.seen.clear();state.emptyReported=false;
    if(recording){
      // Record the current loaded turns immediately, then observe changes.
      // Do not announce captured data until background acknowledges Queue.
      watch();
    }else{
      try{
        const items=extract(root,'capture',state.includeAssistant);
        if(!items.length)void reportCapture('選取區域內沒有可擷取內容，Queue 未變動',false);
        else void queuePublish(items);
      }catch(error){void reportCapture(String(error?.message||error),false);}
    }
  }
  function feedback(message,ok=false){
    const id='lunarcus-status';
    let notice=document.getElementById(id);
    if(!notice){
      notice=document.createElement('div');notice.id=id;
      notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
      notice.style.cssText='position:fixed;bottom:18px;right:18px;max-width:min(390px,85vw);'+
        'padding:10px 14px;border-radius:9px;background:#222;color:#fff;'+
        'font:14px/1.5 system-ui;box-shadow:0 3px 16px #0004;z-index:2147483647;'+
        'white-space:pre-wrap;overflow-wrap:anywhere;pointer-events:none';
      document.documentElement.appendChild(notice);
    }
    notice.textContent=String(message||'LOC 擷取狀態').slice(0,450);
    notice.style.borderLeft=ok?'4px solid #52bd8b':'4px solid #ea766e';
    clearTimeout(feedback.timer);
    feedback.timer=setTimeout(()=>notice?.remove(),6500);
  }
  chrome.runtime.onMessage.addListener((msg,_sender,reply)=>{
    if(msg.type==='page.feedback'){feedback(msg.message,msg.ok===true);reply({ok:true});return;}
    if(msg.type==='page.capture'){
      if(CHAT_HOST.test(location.hostname.toLowerCase())&&!msg.selection?.trim()){
        void captureChatHistory(Boolean(msg.includeAssistant))
          .then(reply).catch(error=>reply({error:String(error?.message||error)}));
        return true;
      }
      try{
        const text=msg.selection?.trim();
        const items=text?[{key:'selection',source_key:normalizeUrl(location.href),url:normalizeUrl(location.href),
          title:document.title,content:text}]:extract(document.body,'capture',Boolean(msg.includeAssistant));
        reply({items});
      }catch(error){reply({error:String(error?.message||error)})}
      return;
    }
    if(msg.type==='page.record'&&
      (CHAT_HOST.test(location.hostname.toLowerCase())||
       location.hostname==='claude.ai'||location.hostname==='gemini.google.com')){
      // Chat capture targets its main conversation immediately; users should
      // never have to pick a second area after selecting Start Recording.
      stop();
      state.root=document.querySelector('main')||document.body;
      state.includeAssistant=msg.includeAssistant===true;
      state.seen.clear();state.emptyReported=false;
      const ok=watch();
      reply({ok,mode:state.mode});
      return;
    }
    if(msg.type==='page.select'||msg.type==='page.record'){
      stop();state.mode=msg.type==='page.select'?'select':'pick-record';
      state.includeAssistant=msg.includeAssistant===true;
      document.addEventListener('mousemove',move,true);
      document.addEventListener('click',choose,true);
      reply({ok:true});return;
    }
    if(msg.type==='page.discard'){
      stop();
      const outstanding=[...state.pendingWrites];
      void Promise.allSettled(outstanding).then(()=>{
        state.pendingWrites.clear();
        state.sending.clear();
        reply({ok:true});
      });
      return true;
    }
    if(msg.type==='page.pause'){
      if(state.mode!=='record'){reply({ok:false,mode:state.mode});return;}
      stopWatching();state.mode='paused';reply({ok:true,mode:'paused'});return;
    }
    if(msg.type==='page.resume'){
      const ok=state.mode==='paused'&&watch();
      reply({ok:Boolean(ok),mode:state.mode});return;
    }
    if(msg.type==='page.status'){reply({ok:true,mode:state.mode,count:state.seen.size});return;}
    if(msg.type==='page.stop'){
      const isRecording=state.mode==='record'||state.mode==='paused';
      let items=[];
      let captureError='';
      try{
        items=isRecording&&state.root?extract(state.root,'record',state.includeAssistant):[];
      }catch(error){captureError=String(error?.message||error)}
      const partial=isRecording&&state.includeAssistant&&CHAT_HOST.test(location.hostname)&&
        Boolean(globalThis.ChatGPTShadowExtract?.isStreaming(document));
      const count=state.seen.size;
      const outstanding=[...state.pendingWrites];
      stop();
      void (async()=>{
        // Wait for any capture already being written before checking the final
        // snapshot; a "stop" acknowledgement must not outrun IndexedDB.
        await Promise.all(outstanding);
        if(captureError){
          reply({ok:false,count,error:captureError});
          return;
        }
        const result=items.length?await queuePublish(items):{accepted:0,queued:0};
        reply({ok:!result.error,count,queued:result.queued||0,
          partial,...(result.error?{error:result.error}:{})});
      })().catch(error=>reply({ok:false,count,error:String(error?.message||error)}));
      return true;
    }
  });
  globalThis.__locCaptureV2=true;
})();
