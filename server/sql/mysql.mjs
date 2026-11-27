import {Kysely,MysqlDialect} from 'kysely';
import mysql from 'mysql2/promise';

export function createMysqlDatabase(connectionString){
 const pool=mysql.createPool({uri:connectionString,waitForConnections:true,
  connectionLimit:1,queueLimit:1,enableKeepAlive:true,
  supportBigNumbers:true,bigNumberStrings:true});
 return new Kysely({dialect:new MysqlDialect({pool:async()=>pool})});
}
