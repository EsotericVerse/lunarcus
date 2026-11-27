import test from 'node:test';
import assert from 'node:assert/strict';
import {writeImportJob,readImportJob,jobKey,stagingKey,validImportId}
 from '../server/import/job-store.mjs';
import {consumePluginImportQueue}
 from '../server/import/queue-consumer.mjs';
import {importConnectionString,importSqlType,galaxyTable}
 from '../server/sql/engine.mjs';
import {mergeOrdered} from '../server/import/ordered-conversation.mjs';
import {writeOrderedConversation} from '../server/import/ordered-writer.mjs';
import {parseMssqlConnectionString} from '../server/sql/mssql.mjs';
import mcpServer from '../server/mcp/server.mjs';

const id='d7c2a7b8-3e8f-4b7d-9a61-72e5d3b6a1c4';
const bucket=()=>{
 const objects=new Map();
 return {objects,
  async put(key,value){
   const text=typeof value==='string'?value:await new Response(value).text();
   objects.set(key,text);
  },
  async get(key){
   const text=objects.get(key);
   return text===undefined?null:{json:async()=>JSON.parse(text),text:async()=>text};
  },
  async delete(key){objects.delete(key)}
 };
};

test('import job state advances monotonically and terminal receipts stay final',async()=>{
 const store=bucket(),now=new Date().toISOString();
 assert.equal(validImportId(id),true);
 await store.put(jobKey(id),JSON.stringify({job_id:id,upload_id:id,owner:'subject',
  state:'staged',conversation_count:1,record_count:1,created_at:now,updated_at:now}));
 await writeImportJob(store,id,{state:'queued'});
 await writeImportJob(store,id,{state:'running'});
 await writeImportJob(store,id,{state:'completed',result:{accepted:true}});
 await writeImportJob(store,id,{state:'failed',error:{code:'late_failure'}});
 assert.equal((await readImportJob(store,id)).state,'completed');
 assert.equal((await readImportJob(store,id)).result.accepted,true);
 assert.equal(stagingKey(id),'plugin-import/staging/'+id+'.ndjson');
});

test('Queue starts one stable Workflow job and acknowledges duplicate delivery',async()=>{
 const store=bucket(),now=new Date().toISOString();
 await store.put(jobKey(id),JSON.stringify({job_id:id,upload_id:id,owner:'subject',
  state:'staged',conversation_count:1,record_count:1,created_at:now,updated_at:now}));
 const created=[];let acked=0;
 const flow={
  async create(options){created.push(options);},
  async get(){return {id}}
 };
 const message={body:{job_id:id},ack(){acked++}};
 await consumePluginImportQueue({queue:'las-plugin-import',messages:[message]},
  {LAS_PLUGIN_IMPORT_STAGING:store,LAS_PLUGIN_IMPORT_FLOW:flow});
 await consumePluginImportQueue({queue:'las-plugin-import',messages:[message]},
  {LAS_PLUGIN_IMPORT_STAGING:store,LAS_PLUGIN_IMPORT_FLOW:{
   async create(){throw Error('Workflow already exists')},async get(){return {id}}
  }});
 assert.equal(created.length,1);
 assert.deepEqual(created[0],{id,params:{job_id:id}});
 assert.equal(acked,2);
 assert.equal((await readImportJob(store,id)).state,'queued');
});

test('DLQ marks a job failed while keeping source staging available',async()=>{
 const store=bucket(),now=new Date().toISOString();
 await store.put(jobKey(id),JSON.stringify({job_id:id,upload_id:id,owner:'subject',
  state:'queued',conversation_count:1,record_count:1,created_at:now,updated_at:now}));
 await store.put(stagingKey(id),'original stream');
 let acked=0;
 await consumePluginImportQueue({queue:'las-plugin-import-dlq',messages:[{
  body:{job_id:id},ack(){acked++}
 }]},{LAS_PLUGIN_IMPORT_STAGING:store});
 const job=await readImportJob(store,id);
 assert.equal(job.state,'failed');
 assert.equal(job.error.code,'import_queue_retries_exhausted');
 assert.equal(await (await store.get(stagingKey(id))).text(),'original stream');
 assert.equal(acked,1);
});

test('portable import config keeps each SQL type on its own connection',()=>{
 const env={LAS_DATABASE_URL:'postgres://auth@db.example/las',
  LAS_HYPERDRIVE:{connectionString:'postgres://hyper@db.example/las'},
  LAS_MYSQL_DATABASE_URL:'mysql://mysql@db.example/las',
  LAS_MSSQL_DATABASE_URL:'mssql://sql@db.example/las'};
 assert.equal(importSqlType({LAS_IMPORT_SQL_TYPE:' MYSQL '}),'mysql');
 assert.equal(importConnectionString(env,'postgres'),env.LAS_HYPERDRIVE.connectionString);
 assert.equal(importConnectionString(env,'mysql'),env.LAS_MYSQL_DATABASE_URL);
 assert.equal(importConnectionString(env,'mssql'),env.LAS_MSSQL_DATABASE_URL);
 assert.equal(galaxyTable('lo3rwang','postgres'),'silver.lo3rwang_galaxy');
 assert.equal(galaxyTable('lo3rwang','mysql'),'lo3rwang_galaxy');
 assert.equal(galaxyTable('lo3rwang','mssql'),'dbo.lo3rwang_galaxy');
 assert.throws(()=>importConnectionString({LAS_MYSQL_DATABASE_URL:'postgres://db.example/las'},'mysql'),
  /does not match/);
});

test('ordered merge is idempotent and preserves source order',()=>{
 const messages=[
  {message_id:'m2',source_order:2,parent_id:'m1',role:'assistant',text:'第二句'},
  {message_id:'m1',source_order:1,parent_id:null,role:'user',text:'第一句'}
 ];
 const first=mergeOrdered(null,messages);
 const second=mergeOrdered(first.content,messages);
 assert.equal(first.added,2);
 assert.equal(second.added,0);
 assert.equal(second.count,2);
 assert.ok(second.content.indexOf('"message_id":"m1"')<
  second.content.indexOf('"message_id":"m2"'));
});

test('ordered import writes one source Galaxy row and accepts an idempotent retry',async()=>{
 const rows=new Map(),inserts=[];
 const db={
  selectFrom(table){
   let conditions=[];
   const query={select(){return query},where(...args){conditions.push(args);return query},
    orderBy(){return query},limit(){return query},
    async execute(){
     const siteCondition=conditions.find(([key,op])=>key==='site'&&op==='in');
     const idCondition=conditions.find(([key,op])=>key==='site_id'&&op==='=');
     return [...rows.values()].filter(row=>siteCondition?.[2].includes(row.site)&&
      row.site_id===idCondition?.[2]).slice(0,2);
    }};
   assert.equal(table,'silver.lo3rwang_galaxy');
   return query;
  },
  insertInto(table){
   return {values(value){return {async executeTakeFirst(){
    rows.set(value.uid,value);inserts.push({table,value});return {numInsertedOrUpdatedRows:1n};
   }}}};
  }
 };
 const args={scopeid:'lo3rwang',
  conversation_id:'https://chatgpt.com/c/12345678-1234-4234-8234-123456789abc',
  updated_at:'2026-11-27T00:00:00.000Z',title:'對話',
  records:[{message_id:'m1',source_order:0,parent_id:null,role:'user',text:'你好'}]};
 const first=await writeOrderedConversation(db,args);
 const retry=await writeOrderedConversation(db,args);
 assert.equal(inserts.length,1);
 assert.equal(first.accepted,true);
 assert.equal(first.duplicate,false);
 assert.equal(retry.duplicate,true);
 assert.equal(inserts[0].value.site,'ChatGPT');
 assert.equal(inserts[0].value.site_id,args.conversation_id);
});

test('MSSQL import uses the native parameterized writer and idempotent retry',async()=>{
 let row=null;const statements=[];
 const db={async transaction(callback){
  return callback(async(sql,values)=>{
   statements.push(sql);
   if(sql.startsWith('SELECT TOP'))return {rows:row?[row]:[],rowCount:0};
   if(sql.startsWith('INSERT')){row={...values};return {rows:[],rowCount:1};}
   throw Error('Unexpected MSSQL statement');
  });
 }};
 const args={type:'mssql',scopeid:'lo3rwang',
  conversation_id:'https://chatgpt.com/c/12345678-1234-4234-8234-123456789abc',
  updated_at:'2026-11-27T00:00:00.000Z',title:'對話',
  records:[{message_id:'m1',source_order:0,parent_id:null,role:'user',text:'你好'}]};
 const first=await writeOrderedConversation(db,args);
 const retry=await writeOrderedConversation(db,args);
 assert.equal(first.accepted,true);
 assert.equal(retry.duplicate,true);
 assert.match(statements[0],/\[dbo\]\.\[lo3rwang_galaxy\]/);
 assert.match(statements[0],/WITH \(UPDLOCK,HOLDLOCK\)/);
 assert.ok(statements.some(sql=>sql.includes('VALUES (@uid')));
 assert.equal(row.site,'ChatGPT');
 assert.equal(row.site_id,args.conversation_id);
});

test('MSSQL URL uses the selected database and encrypted native connection settings',()=>{
 const config=parseMssqlConnectionString(
  'mssql://user%40tenant:pass%21@sql.example:1433/galaxy?encrypt=true');
 assert.equal(config.server,'sql.example');
 assert.equal(config.authentication.options.userName,'user@tenant');
 assert.equal(config.authentication.options.password,'pass!');
 assert.equal(config.options.database,'galaxy');
 assert.equal(config.options.encrypt,true);
 assert.equal(config.options.trustServerCertificate,false);
});

test('LAS import and status paths are registered before OAuth validation',async()=>{
 const upload=await mcpServer.fetch(new Request(
  'https://mcp.lo3rwang.cc/api/plugins/import/stream',{
   method:'POST',headers:{'content-type':'application/x-ndjson',
    'x-las-upload-id':id,'x-las-conversation-count':'1','x-las-record-count':'1'},
   body:'{}\n'
  }),{});
 const status=await mcpServer.fetch(new Request(
  'https://mcp.lo3rwang.cc/api/plugins/import/status?job_id='+id),{});
 assert.equal(upload.status,401);
 assert.equal(status.status,401);
 assert.notEqual(upload.status,404);
 assert.notEqual(status.status,404);
});
