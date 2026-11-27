import * as Tedious from 'tedious';

export function parseMssqlConnectionString(value,{trustServerCertificate=false}={}){
 let url;
 try{url=new URL(String(value||''));}catch{throw new TypeError('Invalid LAS SQL Server connection URL');}
 if(!['mssql:','sqlserver:'].includes(url.protocol)||!url.hostname||
    !url.username||!url.pathname||url.pathname==='/')
  throw new TypeError('LAS SQL Server URL must include server, credentials and database');
 const database=decodeURIComponent(url.pathname.slice(1));
 if(!database||/[\u0000-\u001f\u007f]/.test(database))
  throw new TypeError('Invalid LAS SQL Server database name');
 return Object.freeze({
  server:url.hostname.replace(/^\[|\]$/g,''),
  authentication:{type:'default',options:{
   userName:decodeURIComponent(url.username),password:decodeURIComponent(url.password)
  }},
  options:{database,port:Number(url.port||1433),encrypt:true,
   trustServerCertificate:trustServerCertificate===true,
   connectTimeout:5000,requestTimeout:30000}
 });
}

function connect(config){
 const connection=new Tedious.Connection(config);
 connection.on('error',()=>{});
 return new Promise((resolve,reject)=>{
  connection.connect(error=>{
   if(error){connection.close();reject(error);return;}
   resolve(connection);
  });
 });
}

function parameter(value){
 if(value instanceof Date)return {type:Tedious.TYPES.DateTime2,value,options:{scale:3}};
 if(typeof value==='boolean')return {type:Tedious.TYPES.Bit,value};
 if(value===null||value===undefined)return {
  type:Tedious.TYPES.NVarChar,value:null,options:{length:1}
 };
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)){
  const [year,month,day]=value.split('-').map(Number);
  return {type:Tedious.TYPES.Date,value:new Date(Date.UTC(year,month-1,day))};
 }
 const text=String(value);
 return {type:Tedious.TYPES.NVarChar,value:text,
  options:{length:text.length>4000?4001:Math.max(1,text.length)}};
}

function execute(connection,sql,values={}){
 return new Promise((resolve,reject)=>{
  const rows=[];
  const request=new Tedious.Request(sql,(error,rowCount)=>{
   if(error){reject(error);return;}
   resolve({rows,rowCount:Number(rowCount)||0});
  });
  request.on('row',columns=>{
   const row={};
   for(const column of columns){
    const name=column?.metadata?.colName;
    if(typeof name==='string')row[name]=column.value;
   }
   rows.push(row);
  });
  try{
   for(const [name,value] of Object.entries(values)){
    const item=parameter(value);
    request.addParameter(name,item.type,item.value,item.options);
   }
   connection.execSql(request);
  }catch(error){reject(error);}
 });
}

function transactionCommand(connection,method,...args){
 return new Promise((resolve,reject)=>{
  connection[method]((error)=>error?reject(error):resolve(),...args);
 });
}

class MssqlDatabase{
 constructor(connectionConfig){this.connectionConfig=connectionConfig;this.connectionPromise=null;}
 async connection(){
  if(!this.connectionPromise)this.connectionPromise=connect(this.connectionConfig);
  return this.connectionPromise;
 }
 async transaction(callback){
  const connection=await this.connection();
  await transactionCommand(connection,'beginTransaction','las_ordered_import',
   Tedious.ISOLATION_LEVEL.SERIALIZABLE);
  try{
   const result=await callback((sql,values)=>execute(connection,sql,values));
   await transactionCommand(connection,'commitTransaction');
   return result;
  }catch(error){
   await transactionCommand(connection,'rollbackTransaction').catch(()=>{});
   throw error;
  }
 }
 async destroy(){
  const connection=await this.connectionPromise?.catch(()=>null);
  if(connection)connection.close();
 }
}

/** SQL Server uses the native Tedious protocol driver in its own module.
 * It intentionally does not route SQL Server through Kysely's dialect layer.
 */
export function createMssqlDatabase(connectionString,options={}){
 return new MssqlDatabase(parseMssqlConnectionString(connectionString,options));
}
