// LOC 網站／舊對話頁面的可見 DOM 擷取；不呼叫 OAuth 或 MCP。
(() => {
  if (globalThis.__locCaptureV2) return;
  const state = {mode:'idle', root:null, observer:null, intersection:null, timer:null, hover:null, includeAssistant:false, seen:new Set(), sending:new Set(), pendingWrites:new Set(), emptyReported:false};
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
  const socialPostUrl = url =>
    /instagram\.com\/(?:p|reel|tv)\/|threads\.(?:net|com)\/@[^/]+\/post\//i.test(String(url||''));
  const links = el => [...el.querySelectorAll('a[href]')]
    .filter(visible).slice(0,120).map(a=>({text:cleanText(a).slice(0,120),url:normalizeUrl(a.getAttribute('href'))}))
    .filter(x=>x.url);
  const stableSource = el => {
    const match=[...el.querySelectorAll('a[href]')].find(a=>{
      const u=normalizeUrl(a.href);
      return u&&socialPostUrl(u);
    });
    if(match)return normalizeUrl(match.href);
    if(socialPostUrl(location.href))return normalizeUrl(location.href);
    // Never merge unrelated social-feed posts into the profile/feed URL
    // when a stable individual post permalink is not present.
    if(/(?:instagram\.com|threads\.(?:net|com))$/.test(location.hostname.toLowerCase()))
      return null;
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
    const source=normalizeUrl(location.href);
    if(!source)return [];
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
    if(includeAssistant&&mode!=='record'&&rows.some(row=>row.role==='user')&&
      !captured.some(row=>row.role==='assistant'))
      throw Error('已勾選保存 AI 回覆，但目前無法辨識任何 AI 回覆；本次不寫入 Queue');
    return captured.map(row=>({
        key:upstream.stableMessageId(threadId,row),source_key:source,url:source,
        title,content:'['+row.role+']\n'+row.content.slice(0,1400000)
      }));
  }
  // A full-history capture must scroll the conversation's own viewport.
  // ChatGPT only keeps a small set of turns mounted in the DOM at a time.
  // One querySelectorAll snapshot is NOT a complete conversation archive.
  function chatHistoryScroller(main){
    const first=main.querySelector('[data-chatgpt-search-unit-key],[data-message-author-role]');
    for(let el=first;el&&el!==document.body;el=el.parentElement){
      if(!Number.isFinite(el.scrollHeight)||!Number.isFinite(el.clientHeight)||
        el.scrollHeight<=el.clientHeight+40||el.clientHeight<100)continue;
      const overflow=getComputedStyle(el).overflowY;
      if(/auto|scroll/.test(overflow))return el;
    }
    // Some layouts put the scrolling viewport on an inner div that is not an
    // ancestor of the currently mounted turn.
    const candidates=[main,...main.querySelectorAll('[class*="overflow"],[data-testid]')];
    for(const el of candidates){
      if(!Number.isFinite(el.scrollHeight)||!Number.isFinite(el.clientHeight)||
        el.scrollHeight<=el.clientHeight+40||el.clientHeight<100)continue;
      if(!/auto|scroll/.test(getComputedStyle(el).overflowY))continue;
      if(first&&!el.contains(first))continue;
      return el;
    }
    const page=document.scrollingElement;
    return page&&page.scrollHeight>page.clientHeight+40?page:null;
  }
  function setChatScroll(element,top){
    if(typeof element.scrollTo==='function'){
      try{element.scrollTo({top,behavior:'instant'});return;}catch{}
    }
    element.scrollTop=top;
  }
  const pauseChatScroll=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function captureChatHistory(includeAssistant){
    if(state.historyCapture)throw Error('這篇對話已在進行全頁擷取');
    if(state.mode==='record'||state.mode==='paused')
      throw Error('請先停止目前錄製，再執行整篇歷史擷取');
    const href=normalizeUrl(location.href);
    const main=document.querySelector('main')||document.body;
    const scroller=chatHistoryScroller(main);
    if(!scroller)throw Error('找不到對話的捲動容器；不能把目前載入的幾則訊息當成完整對話');
    const startTop=scroller.scrollTop;
    const step=Math.max(180,Math.floor(scroller.clientHeight*0.65));
    const seen=new Set(),buffer=[];
    let detected=0,user=0,assistant=0,queuedCaptures=0,upSteps=0,downSteps=0;
    state.historyCapture=true;
    const ensureChat=()=>{
      if(normalizeUrl(location.href)!==href)
        throw Error('擷取期間已切換對話，已停止，避免不同來源混入同一篇');
    };
    const collect=()=>{
      ensureChat();
      const rows=shadowConversationTurns(main,includeAssistant,'record');
      for(const item of rows){
        const identity=item.source_key+':'+item.key+':'+fingerprint(item.content);
        if(seen.has(identity))continue;
        seen.add(identity);
        buffer.push(item);
        detected++;
        if(item.content.startsWith('[user]\n'))user++;
        if(item.content.startsWith('[assistant]\n'))assistant++;
      }
      return rows.map(row=>row.key).join('|');
    };
    const writeBuffered=async()=>{
      if(!buffer.length)return;
      const items=buffer.splice(0,buffer.length);
      const result=await queuePublish(items);
      if(result.error)throw Error('擷取資料入列失敗，已入列 '+queuedCaptures+' 則：'+result.error);
      queuedCaptures+=result.insertedCaptures||0;
    };
    try{
      // Seek the real beginning in overlapping increments, allowing older
      // turns to be loaded. Repeated top-edge probes handle lazy backfill.
      let still=0,lastSig='';
      for(let n=0;n<3500;n++){
        ensureChat();
        const before=scroller.scrollTop,height=scroller.scrollHeight;
        setChatScroll(scroller,Math.max(0,before-step));
        await pauseChatScroll(before<=1?280:95);
        const sig=shadowConversationTurns(main,includeAssistant,'record')
          .map(x=>x.key).slice(0,3).join('|');
        upSteps++;
        if(scroller.scrollTop<=1&&before<=1&&scroller.scrollHeight===height&&sig===lastSig)
          still++;
        else still=0;
        lastSig=sig;
        if(still>=4)break;
        if(n===3499)throw Error('歷史對話超過捲動掃描上限；未宣稱完整，請分段擷取');
      }
      // Walk from beginning to end. Overlap each viewport so virtualized
      // turns are collected before ChatGPT unmounts them.
      let stillAtEnd=0,lastAtEnd='';
      for(let n=0;n<5000;n++){
        const sig=collect();
        if(buffer.length>=50&&(!includeAssistant||assistant>0))await writeBuffered();
        const before=scroller.scrollTop,height=scroller.scrollHeight;
        const bottom=Math.max(0,height-scroller.clientHeight);
        const atEnd=before>=bottom-2;
        if(atEnd){
          if(sig===lastAtEnd&&scroller.scrollHeight===height)stillAtEnd++;
          else stillAtEnd=0;
          lastAtEnd=sig;
          if(stillAtEnd>=4)break;
          await pauseChatScroll(280);
        }else{
          stillAtEnd=0;
          setChatScroll(scroller,Math.min(bottom,before+step));
          await pauseChatScroll(95);
        }
        downSteps++;
        if(n===4999)throw Error('對話長度超過單次掃描上限；已保留入列資料，不能宣稱全文完成');
      }
      if(includeAssistant&&assistant===0)
        throw Error('已掃描對話，但沒有辨識到任何 AI 回覆；本次不寫入 Queue');
      await writeBuffered();
      const partial=includeAssistant&&globalThis.ChatGPTShadowExtract.isStreaming(document);
      return {directQueued:true,detected,user,assistant,queuedCaptures,partial,
        message:'已從對話頂端掃描至底端：辨識 '+detected+
          ' 則（使用者 '+user+'／AI '+assistant+'）；'+
          '本次新增 Queue '+queuedCaptures+' 則。'+
          (partial?'最後一則仍在生成，暫未保存。':'')+
          '僅涵蓋頁面可載入的對話。',
        upSteps,downSteps};
    }finally{
      setChatScroll(scroller,Math.min(startTop,
        Math.max(0,scroller.scrollHeight-scroller.clientHeight)));
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
    if(hostname==='claude.ai'){
      // Claude retains its own role-based extraction path.
      const region=mode==='record'||doc===document.body?
        (doc.closest?.('main')||doc.querySelector?.('main')||doc):doc;
      return conversationTurns(region,includeAssistant);
    }
    // Readability is invoked only for a full-page single capture; avoid destroying
    // the live DOM or re-parsing every MutationObserver notification during recording.
    if(mode==='capture'&&doc===document.body&&typeof Readability==='function'&&
      !/(?:instagram\.com|threads\.(?:net|com)|chatgpt\.com|claude\.ai|chat\.openai\.com)$/.test(hostname)){
      try{
        const parsed=new Readability(document.cloneNode(true)).parse();
        if(parsed?.textContent?.trim()?.length>100){
          const documentFragment=new DOMParser().parseFromString(parsed.content||'','text/html');
          const hrefs=[...documentFragment.querySelectorAll('a[href]')].slice(0,120)
            .map(a=>({text:a.textContent?.trim()||'',url:normalizeUrl(a.href)}))
            .filter(x=>x.url).map(x=>x.text+' <'+x.url+'>').join('\n');
          const url=normalizeUrl(location.href);
          return [{key:url,source_key:url,url,title:parsed.title||document.title,
            content:parsed.textContent.trim()+(hrefs?'\n[連結]\n'+hrefs:'')}];
        }
      }catch{ /* Unsupported or dynamic page: use bounded DOM fallback below. */ }
    }
    const articles=[...doc.querySelectorAll('article,[role="article"],[data-testid="post-container"]')]
      .filter(el=>visible(el)&&(mode!=='record'||inViewport(el))&&cleanText(el).length>=25);
    // Threads may render cards as generic DIVs rather than <article>.
    // Follow only already-rendered permanent links; never invent a source
    // or treat the whole infinite feed as a single post.
    if(/(?:instagram\.com|threads\.(?:net|com))$/.test(hostname)){
      for(const a of [...doc.querySelectorAll('a[href]')].slice(0,500)){
        if(!socialPostUrl(normalizeUrl(a.href)))continue;
        const parent=a.closest('article,[role="article"],[data-testid="post-container"]')||
          a.closest('[data-pressable-container]')||a.parentElement?.parentElement?.parentElement;
        if(parent&&visible(parent)&&(mode!=='record'||inViewport(parent))&&
          cleanText(parent).length>=25)articles.push(parent);
      }
    }
    const unique=[...new Set(articles)];
    const cards=(unique.length?unique:(mode==='record'?[]:[doc])).slice(0,50);
    return cards.map((el,index)=>{
      const source=stableSource(el);
      const text=cleanText(el);
      if(!source||!text)return null;
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
      const key=item.source_key+':'+(item.key||'')+':'+fingerprint(item.content);
      if(state.seen.has(key)||state.sending.has(key))continue;
      state.sending.add(key);pending.push({item,key});
    }
    if(!pending.length)return {accepted:0,queued:false};
    let accepted=0,insertedCaptures=0,queued=0;
    try{
      // A long conversation must be recorded in 100-turn chunks;
      // partial Queue acknowledgements survive a later failed chunk.
      for(let offset=0;offset<pending.length;offset+=100){
        const part=pending.slice(offset,offset+100);
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
    if(state.timer)clearTimeout(state.timer);
    state.timer=setTimeout(()=>{
      if(state.mode!=='record')return;
      let items;
      try{items=extract(state.root,'record',state.includeAssistant);}
      catch(error){
        if(!state.emptyReported){
          state.emptyReported=true;
          void reportCapture(String(error?.message||error),false);
        }
        return;
      }
      if(!items.length){
        if(!state.emptyReported){
          state.emptyReported=true;
          void reportCapture('錄製已啟動，但目前找不到可辨識的對話訊息；Queue 仍是 0。請確認對話已載入。',false);
        }
        return;
      }
      void queuePublish(items);
    },1250);
  }
  function stopWatching(){
    state.observer?.disconnect();state.intersection?.disconnect();
    state.observer=null;state.intersection=null;
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
    state.intersection=new IntersectionObserver(scan,{threshold:0});
    for(const node of state.root.querySelectorAll('article,[role="article"]'))
      state.intersection.observe(node);
    window.addEventListener('scroll',scan,{passive:true});
    scan();
    return true;
  }
  function stop(){
    stopWatching();state.mode='idle';state.emptyReported=false;
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
    const chat=/^(?:chatgpt\.com|chat\.openai\.com|claude\.ai)$/.test(location.hostname);
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
      (CHAT_HOST.test(location.hostname.toLowerCase())||location.hostname==='claude.ai')){
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
          reply({ok:false,count:state.seen.size,error:captureError});
          return;
        }
        const result=items.length?await queuePublish(items):{accepted:0,queued:0};
        reply({ok:!result.error,count:state.seen.size,queued:result.queued||0,
          partial,...(result.error?{error:result.error}:{})});
      })().catch(error=>reply({ok:false,count,error:String(error?.message||error)}));
      return true;
    }
  });
  globalThis.__locCaptureV2=true;
})();
