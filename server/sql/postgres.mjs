import {Kysely,PostgresDialect} from 'kysely';
import pg from 'pg';

export function createPostgresDatabase(connectionString){
 const pool=new pg.Pool({connectionString,max:1,connectionTimeoutMillis:5000,
  idleTimeoutMillis:1000});
 pool.on('error',()=>{});
 return new Kysely({dialect:new PostgresDialect({pool})});
}
