// Read-only recovery preview for LOC site=mcp legacy Extension conversations.
// Never infers message order from captured_at, write time, event UUID or hashes.
// Runs offline on explicitly supplied JSON exports; no database/OAuth requests.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import process from 'node:process';

const EVENT=/^\[\[LOC-Append-Event:([0-9a-f-]{36}):([0-9a-f]{64})\]\]\r?\n\[來源：([^\]\r\n]+)；段落 (\d+)\/(\d+)\]\r?\n/gm;
const roles=new Set(['user','assistant']);
const normalize=text=>String(text||'').replace(/\r\n/g,'\n').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
function sourceIdentity(url){
  try{
    const u=new URL(url);
    if(['chatgpt.com','chat.openai.com'].includes(u.hostname))
      return {platform:'chatgpt',id:/\/c\/([a-f0-9-]{32,40})(?:\/|$)/i.exec(u.pathname)?.[1]||null};
    if(u.hostname==='claude.ai')return {platform:'claude',id:/^\/chat\/([a-f0-9-]{32,40})\/?$/i.exec(u.pathname)?.[1]||null};
    if(u.hostname==='gemini.google.com')return {platform:'gemini',id:/^\/app\/([a-zA-Z0-9_-]{6,128})\/?$/.exec(u.pathname)?.[1]||null};
  }catch{}
  return null;
}
function parseEvents(content){
  const text=String(content||'');
  const headers=[...text.matchAll(EVENT)],events=[];
  if(!headers.length)return {events,reason:'no-extension-event-markers'};
  if(text.slice(0,headers[0].index).trim())
    return {events:[],reason:'unexpected-prefix'};
  for(let i=0;i<headers.length;i++){
    const h=headers[i],end=i+1<headers.length?headers[i+1].index:text.length;
    const partIndex=Number(h[4]),partCount=Number(h[5]);
    if(partCount!==1||partIndex!==1)return {events:[],reason:'multipart-needs-source-parts'};
    const raw=text.slice(h.index+h[0].length,end).trim();
    const match=/^\[(user|assistant)\]\r?\n([\s\S]+)$/.exec(raw);
    if(!match)return {events:[],reason:'missing-role-boundary'};
    events.push({eventId:h[1],fingerprint:h[2],url:h[3],
      role:match[1],text:match[2].trim()});
  }
  return {events,reason:null};
}
function textOf(message){
  const content=message?.content;
  if(typeof message?.text==='string')return message.text;
  if(typeof content==='string')return content;
  if(typeof content?.text==='string')return content.text;
  if(Array.isArray(content?.parts)&&content.parts.every(p=>typeof p==='string'))
    return content.parts.join('\n');
  return '';
}
function entryFromMessage(message,index){
  const role=message?.role||message?.author?.role;
  const id=message?.id||message?.message_id;
  const text=textOf(message);
  if(!roles.has(role)||typeof id!=='string'||!id||!text.trim())return null;
  return {role,id,index,text};
}
// ChatGPT export has an explicit parent chain ending at current_node.
// Never select an arbitrary branch/leaf or order by object-map insertion.
function chatGptPath(conversation){
  if(!conversation?.mapping||!conversation?.current_node)return {error:'missing-parent-graph'};
  const chain=[],seen=new Set();
  let nodeId=conversation.current_node;
  while(nodeId){
    if(seen.has(nodeId))return {error:'cycle-in-parent-graph'};
    seen.add(nodeId);
    const node=conversation.mapping[nodeId];
    if(!node)return {error:'broken-parent-graph'};
    chain.push(node);
    nodeId=node.parent||null;
    if(chain.length>100000)return {error:'parent-graph-too-large'};
  }
  const entries=chain.reverse().map((node,index)=>entryFromMessage(node.message,index))
    .filter(Boolean);
  return {entries};
}
function orderedSource(conversation){
  if(conversation?.mapping)return chatGptPath(conversation);
  if(!Array.isArray(conversation?.messages))return {error:'missing-source-messages'};
  // A generic source must explicitly supply original ordinal positions.
  const rows=conversation.messages.map(row=>{
    const entry=entryFromMessage(row,row.sequence);
    return Number.isSafeInteger(row.sequence)&&row.sequence>=0?entry:null;
  });
  if(rows.some(x=>!x)||new Set(rows.map(x=>x.index)).size!==rows.length)
    return {error:'no-unique-original-sequence'};
  return {entries:rows.sort((a,b)=>a.index-b.index)};
}

function sourceIndex(conversations){
 const grouped=new Map();
 for(const c of conversations){
  if(!c||typeof c!=='object')continue;
  const id=String(c.id||c.conversation_id||'');
  const platform=c.mapping?'chatgpt':String(c.platform||'');
  if(!id||!['chatgpt','claude','gemini'].includes(platform))continue;
  const key=platform+':'+id;
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(c);
 }
 return grouped;
}
function reconstruct(galaxyRows,sourceConversations,{readable=false}={}){
 if(!Array.isArray(galaxyRows)||!Array.isArray(sourceConversations))
  throw new TypeError('Rows and source conversations must be arrays');
 const sources=sourceIndex(sourceConversations),result=[],readableRows=[];
 for(const row of galaxyRows){
  if(row?.site!=='mcp')continue;
  const basic={uid:String(row.uid||''),title:String(row.title||'').slice(0,100),
   source_type:'unknown',status:'not-reconstructed'};
  if(/\bPR\s*#\s*\d+/i.test(String(row.title||''))){
   result.push({...basic,source_type:'github-pr',reason:'not-a-conversation'});continue;
  }
  const parsed=parseEvents(row.content);
  if(parsed.reason){
   result.push({...basic,reason:parsed.reason});continue;
  }
  const urls=[...new Set(parsed.events.map(e=>e.url))];
  const url=String(row.url||urls[0]||'');
  const identity=sourceIdentity(url),eventIdentity=sourceIdentity(urls[0]);
  if(!identity?.id||urls.length!==1||!eventIdentity?.id||
      identity.id!==eventIdentity.id||identity.platform!==eventIdentity.platform){
   result.push({...basic,source_type:'extension-chat',event_count:parsed.events.length,
    reason:'ambiguous-or-missing-conversation-id'});continue;
  }
  const matchesForSource=sources.get(identity.platform+':'+identity.id)||[];
  if(matchesForSource.length!==1){
   result.push({...basic,source_type:'extension-chat',event_count:parsed.events.length,
    reason:matchesForSource.length?'multiple-original-conversation-exports':
     'original-conversation-export-not-provided'});continue;
  }
  const ordered=orderedSource(matchesForSource[0]);
  if(ordered.error){
   result.push({...basic,source_type:'extension-chat',event_count:parsed.events.length,
    reason:ordered.error});continue;
  }
  const matches=[],ambiguous=[],missing=[];
  for(const event of parsed.events){
   const found=ordered.entries.filter(m=>m.role===event.role&&
    normalize(m.text)===normalize(event.text));
   if(found.length===1)matches.push({event_id:event.eventId,message_id:found[0].id,
    source_order:found[0].index,role:event.role});
   else if(!found.length)missing.push(event.eventId);
   else ambiguous.push(event.eventId);
  }
  const uniqueMatched=new Set(matches.map(m=>m.message_id)).size===matches.length;
  const verified=!missing.length&&!ambiguous.length&&uniqueMatched;
  const matchedIds=new Set(matches.map(m=>m.message_id));
  const missingFromCapture=ordered.entries.filter(m=>!matchedIds.has(m.id));
  result.push({...basic,source_type:'extension-chat',event_count:parsed.events.length,
   matched:matches.length,unmatched:missing.length,ambiguous:ambiguous.length,
   status:verified?'verified-order-preview':'not-reconstructed',
   reason:verified?null:!uniqueMatched?'duplicate-original-message-match':
    'incomplete-or-ambiguous-match',
   ordered_event_ids:verified?matches.sort((a,b)=>a.source_order-b.source_order)
    .map(m=>m.event_id):[],
   original_message_count:ordered.entries.length,
   source_messages_missing_from_capture:verified?missingFromCapture.length:null,
   complete_capture:verified&&missingFromCapture.length===0
  });
  if(verified&&readable){
   // Render from the original export in source order, not the malformed
   // append order. Missing captured turns are clearly marked, never invented.
   const lines=['# '+String(row.title||'對話').replace(/[\r\n]/g,' '),
    '','來源：'+url,'原始對話識別：'+identity.id,
    '順序依據：原始對話訊息父子關係／明確訊息序號',
    '擷取覆蓋：'+matches.length+'/'+ordered.entries.length,''];
   for(const m of ordered.entries){
    lines.push('## '+String(m.index+1).padStart(4,'0')+' '+(m.role==='user'?'使用者':'AI 回覆'));
    lines.push('訊息 ID：'+m.id);
    if(!matchedIds.has(m.id))lines.push('來源：原始匯出補回（Extension 未擷取）');
    lines.push('',m.text,'');
   }
   readableRows.push({uid:basic.uid,source_id:identity.id,platform:identity.platform,
    evidence:'source-export',capture_complete:missingFromCapture.length===0,
    markdown:lines.join('\n')});
  }
 }
 return {report:result,readableRows};
}
export function analyzeRows(galaxyRows,sourceConversations){
 return reconstruct(galaxyRows,sourceConversations).report;
}
export function previewReadable(galaxyRows,sourceConversations){
 return reconstruct(galaxyRows,sourceConversations,{readable:true});
}
async function main(args){
 if((args.length!==6&&args.length!==8)||args[0]!=='--galaxy'||
    args[2]!=='--source'||args[4]!=='--out'||
    (args.length===8&&args[6]!=='--readable-out'))
  throw Error('Usage: node scripts/reconcile-mcp-conversations.mjs --galaxy loc-rows.json --source original-conversations.json --out preview.json [--readable-out readable.json]');
 if(args.length===8&&(args[5]===args[7]||args[1]===args[7]||args[3]===args[7]))
  throw Error('Readable output path must not replace a source file or report');
 const galaxy=JSON.parse(await readFile(args[1],'utf8'));
 const src=JSON.parse(await readFile(args[3],'utf8'));
 const {report,readableRows}=previewReadable(
  Array.isArray(galaxy)?galaxy:galaxy.rows,
  Array.isArray(src)?src:src.conversations);
 await writeFile(args[5],JSON.stringify({read_only:true,generated_at:new Date().toISOString(),
  total:report.length,verified:report.filter(x=>x.status==='verified-order-preview').length,
  rows:report},null,2)+'\n',{flag:'wx',mode:0o600});
 if(args.length===8)
  await writeFile(args[7],JSON.stringify({read_only:true,recovered:readableRows.length,
   conversations:readableRows},null,2)+'\n',{flag:'wx',mode:0o600});
 process.stdout.write('Read-only preview generated. No database writes.\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2)).catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
