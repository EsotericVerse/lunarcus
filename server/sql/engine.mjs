const ENGINES=new Set(['postgres','mysql','mssql']);

// Auth remains on its fixed PostgreSQL Hyperdrive. This selection applies only
// to LAS's portable Galaxy import writer and is an explicit deployment value.
export function importSqlType(env={}){
 const type=String(env.LAS_IMPORT_SQL_TYPE||'').trim().toLowerCase();
 if(!ENGINES.has(type))throw Object.assign(
  new Error('LAS_IMPORT_SQL_TYPE must be postgres, mysql, or mssql'),
  {code:'import_sql_type_unconfigured',httpStatus:503});
 return type;
}

export function importConnectionString(env={},type=importSqlType(env)){
 const value=type==='postgres'
  ?env.LAS_HYPERDRIVE?.connectionString||env.LAS_DATABASE_URL
  :type==='mysql'
    ?env.LAS_MYSQL_HYPERDRIVE?.connectionString||env.LAS_MYSQL_DATABASE_URL
    :env.LAS_MSSQL_DATABASE_URL;
 if(typeof value!=='string'||!value.trim())throw Object.assign(
  new Error('LAS database connection is unavailable'),
  {code:'import_database_unavailable',httpStatus:503});
 let url;
 try{url=new URL(value);}catch{throw Object.assign(
  new Error('LAS database connection URL is invalid'),
  {code:'import_database_url_invalid',httpStatus:503});}
 const protocols={postgres:['postgres:','postgresql:'],mysql:['mysql:'],
  mssql:['mssql:','sqlserver:']};
 if(!protocols[type]?.includes(url.protocol)||!url.hostname)
  throw Object.assign(new Error('LAS database URL does not match the selected SQL type'),
   {code:'import_database_type_mismatch',httpStatus:503});
 return value;
}

export async function createImportDatabase(env={}){
 const type=importSqlType(env);
 const connectionString=importConnectionString(env,type);
 const module=type==='postgres'?await import('./postgres.mjs'):
  type==='mysql'?await import('./mysql.mjs'):await import('./mssql.mjs');
 const db=type==='postgres'?module.createPostgresDatabase(connectionString):
  type==='mysql'?module.createMysqlDatabase(connectionString):
   module.createMssqlDatabase(connectionString,{
    trustServerCertificate:env.LAS_MSSQL_TRUST_SERVER_CERTIFICATE==='true'
   });
 return {db,type};
}

export function galaxyTable(scopeid,type){
 if(typeof scopeid!=='string'||! /^[a-z][a-z0-9]{0,14}$/.test(scopeid))
  throw Object.assign(new Error('Invalid import Scope'),{code:'invalid_scope',httpStatus:400});
 if(type==='postgres')return 'silver.'+scopeid+'_galaxy';
 if(type==='mysql')return scopeid+'_galaxy';
 if(type==='mssql')return 'dbo.'+scopeid+'_galaxy';
 throw new TypeError('Unsupported Galaxy import SQL type');
}
