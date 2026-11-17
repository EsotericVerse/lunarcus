// Nonpersistent source projections for conversational DOM, following LOC #1765.
// Field paths are selectors over *already rendered* turns, not a second DB
// schema, network crawler or content converter. No invented role or message ID.
(function(root){
  'use strict';
  const sources=Object.freeze({
    // Keep the existing ChatGPT Shadow extractor: it handles virtualized turns.
    // Its output projects to the same record fields; no second DOM parser.
    chatgpt:Object.freeze({
      model:'ChatGPTConversationTurn',
      source:'chatgpt.com',
      delegatedTo:'ChatGPTShadowExtract',
      identity:['data-message-id','data-chatgpt-selection-message-id']
    }),
    claude:Object.freeze({
      model:'ClaudeConversationTurn',
      source:'claude.ai',
      selector:'[data-testid="user-message"],.font-claude-response',
      role:Object.freeze({
        user:'[data-testid="user-message"]',
        assistant:'.font-claude-response'
      }),
      content:Object.freeze({
        user:['[data-testid="user-message"]'],
        assistant:['.font-claude-response']
      }),
      identity:['data-message-id','data-testid']
    }),
    gemini:Object.freeze({
      model:'GeminiConversationTurn',
      source:'gemini.google.com',
      selector:'user-query,model-response',
      role:Object.freeze({user:'user-query',assistant:'model-response'}),
      content:Object.freeze({
        user:['.query-text','[data-testid="user-query"]','.query-content'],
        assistant:['.markdown','.response-content','.model-response-text']
      }),
      identity:['data-message-id','data-testid']
    })
  });
  function profileFor(provider,hostname){
    const profile=sources[provider];
    return profile?.source===hostname?profile:null;
  }
  function project(profile,region,{includeAssistant=false,record=false,visible,readText,fingerprint}={}){
    if(!profile||typeof visible!=='function'||typeof readText!=='function'||
        typeof fingerprint!=='function')return [];
    const out=[],seen=new Set();
    let users=0,assistants=0;
    for(const node of region?.querySelectorAll?.(profile.selector)||[]){
      if(!visible(node)||node.closest?.('nav,aside,form,[role="navigation"]'))continue;
      const role=node.matches?.(profile.role.user)?'user':
        node.matches?.(profile.role.assistant)?'assistant':null;
      if(!role||role==='assistant'&&!includeAssistant)continue;
      if(node.matches?.('[aria-busy="true"]')||
         node.querySelector?.('[aria-busy="true"]'))continue;
      let body=null;
      for(const path of profile.content[role]){
        body=node.matches?.(path)?node:node.querySelector?.(path);
        if(body)break;
      }
      if(!body)continue; // No configured source field; never fall back to whole UI.
      const content=readText(body);
      if(typeof content!=='string'||!content.trim()||content.length>1400000)continue;
      const sourceId=profile.identity.map(field=>node.getAttribute?.(field))
        .find(value=>typeof value==='string'&&value.trim())||null;
      const key=profile.model+':'+role+':'+(sourceId||'')+':'+fingerprint(content);
      if(seen.has(key))continue;
      seen.add(key);
      const temporal=root.LasSourceTemporalOrder?.fromElement(node)||{};
      out.push({role,content,sourceId,key,...temporal});
      if(role==='user')users++;else assistants++;
    }
    if(includeAssistant&&!record&&users>0&&assistants===0)
      throw Error('已勾選保存 AI 回覆，但無法辨識 '+profile.source+' 的 AI 回覆；本次不寫入 Queue');
    return out;
  }
  root.LasConversationSourceModel=Object.freeze({sources,profileFor,project});
})(globalThis);
