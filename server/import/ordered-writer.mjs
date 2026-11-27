import {galaxyTable} from '../sql/engine.mjs';
import {mergeOrdered} from './ordered-conversation.mjs';

const FLAGS=Object.freeze(['statics','culture','search','trace','list','keyword','extract','others']);
const SELECT=Object.freeze(['uid','content','site','site_id','createtime','UpdateTime']);
const ALPHABET='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const MAX_CONTENT=2_000_000;
const UID=/^[A-Za-z0-9]{8}$/;
const HOSTS=new Set(['chatgpt.com','chat.openai.com','claude.ai','gemini.google.com']);

function fail(code,message,status=400){
 return Object.assign(new Error(message),{code,httpStatus:status});
}
function sourceSite(value){
 let url;
 try{url=new URL(String(value||''));}catch{throw fail('invalid_conversation_source','Invalid conversation URL');}
 if(url.protocol!=='https:'||!HOSTS.has(url.hostname)||url.username||url.password)
  throw fail('invalid_conversation_source','Invalid conversation URL');
 if(url.hostname==='chatgpt.com'||url.hostname==='chat.openai.com')return 'ChatGPT';
 if(url.hostname==='claude.ai')return 'Claude';
 return 'Gemini';
}
function validConversationId(value){
 const id=String(value||'');
 if(id.length<8||id.length>2048||/[\u0000-\u001f\u007f]/.test(id))
  throw fail('invalid_conversation_id','Invalid conversation source identifier');
 return id;
}
function timestamp(value){
 if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))
  throw fail('invalid_conversation_timestamp','Valid conversation timestamp required');
 return new Date(value);
}
function newUid(){
 const bytes=crypto.getRandomValues(new Uint8Array(8));
 return Array.from(bytes,n=>ALPHABET[n%ALPHABET.length]).join('');
}
function isUniqueConflict(error,type){
 const code=String(error?.code||'');
 if(type==='postgres')return code==='23505';
 if(type==='mysql')return code==='ER_DUP_ENTRY'||code==='1062';
 return code==='2627'||code==='2601'||code==='SQLSERVER_DUPLICATE_KEY'||
  Number(error?.number)===2627||Number(error?.number)===2601;
}
function updatedRows(result){
 const value=result?.numUpdatedRows??result?.numAffectedRows??0;
 try{return Number(value);}catch{return 0;}
}

async function existing(db,table,conversationId,site){
 const rows=await db.selectFrom(table).select(SELECT)
  .where('site','in',[site,'mcp']).where('site_id','=',conversationId)
  .orderBy('createtime','asc').limit(2).execute();
 if(rows.length>1)throw fail('ambiguous_conversation_source',
  'Ambiguous legacy conversation source',409);
 return rows[0]||null;
}

async function writeMssqlConversation(db,{scopeid,conversationId,site,updated,
 normalizedTitle,date,records}){
 const table='[dbo].['+scopeid+'_galaxy]';
 for(let attempt=0;attempt<4;attempt++){
  try{
   return await db.transaction(async execute=>{
    const found=await execute(
     'SELECT TOP (2) [uid],[content],[site],[site_id],[createtime],[UpdateTime] '+
     'FROM '+table+' WITH (UPDLOCK,HOLDLOCK) '+
     'WHERE [site] IN (@site,@legacySite) AND [site_id]=@conversationId '+
     'ORDER BY [createtime] ASC',
     {site,legacySite:'mcp',conversationId});
    if(found.rows.length>1)throw fail('ambiguous_conversation_source',
     'Ambiguous legacy conversation source',409);
    const row=found.rows[0]||null;
    const merged=mergeOrdered(row?.content??null,records);
    if(merged.content.length>MAX_CONTENT)
     throw fail('conversation_too_large','Conversation exceeds bounded storage size',413);
    if(row){
     if(merged.added===0&&row.site===site)
      return {accepted:true,duplicate:true,uid:String(row.uid).trim(),
       scopeid,count:0,messages:merged.count};
     const update={conversationId,uid:row.uid,oldSite:row.site,
      oldContent:row.content??null,site};
     let sql='UPDATE '+table+' SET [site]=@site';
     if(merged.added){sql+=',[content]=@content,[UpdateTime]=@updated';
      update.content=merged.content;update.updated=updated;}
     sql+=' WHERE [uid]=@uid AND [site]=@oldSite AND [site_id]=@conversationId '+
      'AND (([content] IS NULL AND @oldContent IS NULL) OR [content]=@oldContent)';
     const result=await execute(sql,update);
     if(result.rowCount===1)
      return {accepted:true,duplicate:merged.added===0,uid:String(row.uid).trim(),
       scopeid,count:merged.added,messages:merged.count};
     throw fail('concurrent_conversation_write_conflict',
      'Concurrent ordered conversation write conflict',409);
    }
    const uid=newUid();
    if(!UID.test(uid))throw fail('galaxy_uid_generation_failed',
     'Galaxy UID generation failed',500);
    const values={uid,title:normalizedTitle,content:merged.content,
     createtime:updated,UpdateTime:updated,date,site,site_id:conversationId,
     ...Object.fromEntries(FLAGS.map(flag=>[flag,false]))};
    const columns=Object.keys(values).map(name=>'['+name+']').join(',');
    const parameters=Object.keys(values).map(name=>'@'+name).join(',');
    await execute('INSERT INTO '+table+' ('+columns+') VALUES ('+parameters+')',values);
    return {accepted:true,duplicate:false,uid,scopeid,count:merged.added,
     messages:merged.count};
   });
  }catch(error){
   if(error?.code==='concurrent_conversation_write_conflict'||isUniqueConflict(error,'mssql'))
    continue;
   throw error;
  }
 }
 throw fail('concurrent_conversation_write_conflict',
  'Concurrent ordered conversation write conflict',409);
}

/** Persist a bounded, source-ordered conversation batch to the trusted LAS DB.
 * This writer touches only the existing Galaxy row; it never creates schema,
 * calls LOC, resolves keywords, or changes Anchor relationships.
 */
export async function writeOrderedConversation(db,{type='postgres',scopeid,
 conversation_id,updated_at,title,records}={}){
 const table=galaxyTable(scopeid,type),id=validConversationId(conversation_id);
 const site=sourceSite(id),updated=timestamp(updated_at);
 if(!Array.isArray(records)||!records.length||records.length>100)
  throw fail('invalid_conversation_batch','Conversation batch requires 1–100 records');
 const normalizedTitle=String(title||'LOC conversation').trim().slice(0,350);
 const date=(records[0]?.created_at&&Number.isFinite(Date.parse(records[0].created_at))
  ?new Date(records[0].created_at):updated).toISOString().slice(0,10);
 if(type==='mssql')return writeMssqlConversation(db,{scopeid,
  conversationId:id,site,updated,normalizedTitle,date,records});
 for(let attempt=0;attempt<4;attempt++){
  const row=await existing(db,table,id,site);
  const merged=mergeOrdered(row?.content??null,records);
  if(merged.content.length>MAX_CONTENT)
   throw fail('conversation_too_large','Conversation exceeds bounded storage size',413);
  if(row){
   if(merged.added===0&&row.site===site)
    return {accepted:true,duplicate:true,uid:String(row.uid).trim(),
     scopeid,count:0,messages:merged.count};
   const update={
    ...(merged.added?{content:merged.content,UpdateTime:updated}:{}),
    ...(row.site!==site?{site}:{})
   };
   let builder=db.updateTable(table).set(update).where('uid','=',row.uid)
    .where('site','=',row.site).where('site_id','=',id);
   builder=row.content==null?builder.where('content','is',null):
    builder.where('content','=',row.content);
   if(updatedRows(await builder.executeTakeFirst())===1)
    return {accepted:true,duplicate:merged.added===0,uid:String(row.uid).trim(),
     scopeid,count:merged.added,messages:merged.count};
   continue;
  }
  const uid=newUid();
  if(!UID.test(uid))throw fail('galaxy_uid_generation_failed',
   'Galaxy UID generation failed',500);
  const values={uid,title:normalizedTitle,content:merged.content,
   createtime:updated,UpdateTime:updated,date,site,site_id:id,
   ...Object.fromEntries(FLAGS.map(flag=>[flag,false]))};
  try{
   await db.insertInto(table).values(values).executeTakeFirst();
   return {accepted:true,duplicate:false,uid,scopeid,count:merged.added,messages:merged.count};
  }catch(error){if(isUniqueConflict(error,type))continue;throw error;}
 }
 throw fail('concurrent_conversation_write_conflict',
  'Concurrent ordered conversation write conflict',409);
}
