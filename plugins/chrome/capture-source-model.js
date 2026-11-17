// Single extension-side capture source model. No backend, provider grants or DB access.
// Fail closed when a feed card contains multiple distinct post identities.
(function(root){
  'use strict';
  const HOSTS=Object.freeze({
    instagram:new Set(['instagram.com','www.instagram.com','m.instagram.com']),
    threads:new Set(['threads.com','www.threads.com','threads.net','www.threads.net']),
    facebook:new Set(['facebook.com','www.facebook.com','m.facebook.com','web.facebook.com']),
    chatgpt:new Set(['chatgpt.com','chat.openai.com']),
    claude:new Set(['claude.ai']),
    gemini:new Set(['gemini.google.com'])
  });
  const SOCIAL=new Set(['facebook','instagram','threads']);
  function providerOf(host){
    for(const [provider,hosts] of Object.entries(HOSTS))if(hosts.has(String(host||'').toLowerCase()))return provider;
    return null;
  }
  function isSocialHost(host){return SOCIAL.has(providerOf(host));}
  function conversationUrl(raw){
    let u;
    try{u=new URL(raw);}catch{return null;}
    if(u.protocol!=='https:'||u.username||u.password)return null;
    const provider=providerOf(u.hostname);
    let identity=null;
    if(provider==='claude'){
      const match=/^\/chat\/([a-f0-9-]{32,40})\/?$/i.exec(u.pathname);
      if(match)identity='https://claude.ai/chat/'+match[1].toLowerCase();
    }else if(provider==='gemini'){
      const match=/^\/app\/([A-Za-z0-9_-]{6,128})\/?$/.exec(u.pathname);
      if(match)identity='https://gemini.google.com/app/'+match[1];
    }
    return identity?Object.freeze({provider,url:identity}):null;
  }
  function permalink(raw,base){
    let u;
    try{u=new URL(raw,base);}catch{return null;}
    if(u.protocol!=='https:'||u.username||u.password)return null;
    const provider=providerOf(u.hostname.toLowerCase());
    if(!provider)return null;
    const parts=u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    let path=null,query='';
    if(provider==='instagram'){
      if(parts.length===2&&['p','reel','tv'].includes(parts[0])&&/^[A-Za-z0-9_-]{4,80}$/.test(parts[1]))
        path='/'+parts[0]+'/'+parts[1]+'/';
    }else if(provider==='threads'){
      if(parts.length===3&&/^@[A-Za-z0-9._]{1,40}$/.test(parts[0])&&
          parts[1]==='post'&&/^[A-Za-z0-9_-]{4,100}$/.test(parts[2]))
        path='/'+parts.join('/')+'/';
    }else{
      if(parts.length===3&&parts[0]==='groups'&&parts[2]==='posts')return null;
      if(parts.length===4&&parts[0]==='groups'&&parts[2]==='posts'&&
          /^[A-Za-z0-9._-]{1,100}$/.test(parts[1])&&/^[0-9]{5,30}$/.test(parts[3]))
        path='/groups/'+parts[1]+'/posts/'+parts[3]+'/';
      else if(parts.length===3&&parts[1]==='posts'&&
          /^[A-Za-z0-9._-]{1,100}$/.test(parts[0])&&/^[0-9]{5,30}$/.test(parts[2]))
        path='/'+parts[0]+'/posts/'+parts[2]+'/';
      else if(parts.length===2&&parts[0]==='reel'&&/^[0-9]{5,30}$/.test(parts[1]))
        path='/reel/'+parts[1]+'/';
      else if((u.pathname==='/permalink.php'||u.pathname==='/story.php')&&
          /^[0-9]{5,30}$/.test(u.searchParams.get('story_fbid')||'')&&
          /^[0-9]{2,30}$/.test(u.searchParams.get('id')||'')){
        path=u.pathname;
        query='?story_fbid='+u.searchParams.get('story_fbid')+'&id='+u.searchParams.get('id');
      }else if((u.pathname==='/watch/'||u.pathname==='/watch')&&
          /^[0-9]{5,30}$/.test(u.searchParams.get('v')||'')){
        path='/watch/';query='?v='+u.searchParams.get('v');
      }
    }
    if(!path)return null;
    const host=provider==='instagram'?'www.instagram.com':
      provider==='threads'?'www.threads.com':'www.facebook.com';
    return Object.freeze({provider,url:'https://'+host+path+query});
  }
  function sourceForCard(card,pageUrl){
    let page;
    try{page=new URL(pageUrl);}catch{return null;}
    const provider=providerOf(page.hostname.toLowerCase());
    if(!provider)return null;
    const found=new Map();
    for(const anchor of card?.querySelectorAll?.('a[href]')||[]){
      const source=permalink(anchor.getAttribute('href'),pageUrl);
      if(source?.provider===provider)found.set(source.url,source);
      if(found.size>1)return null;
    }
    if(found.size===1)return found.values().next().value;
    // A page permalink is not proof that a nested feed card/comment belongs
    // to that post. Only the page body itself may use this fallback.
    if(card===root.document?.body)return permalink(pageUrl);
    return null;
  }
  root.LasCaptureSourceModel=Object.freeze({providerOf,isSocialHost,conversationUrl,permalink,sourceForCard});
})(globalThis);
