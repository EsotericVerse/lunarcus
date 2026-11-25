// LAS owns Auth database configuration and TLS policy. The LOC dialect module
// provides only Kysely's request-scoped pg connection lifecycle.
// No SQL target discovery, database sharing, or implicit privileges.
import pg from 'pg';
import {requestScopedPool} from '../../vendor/loc-dialect/index.mjs';

export function authDatabaseConnection(env={}){
  const binding=env.LAS_HYPERDRIVE;
  return binding===undefined
    ?{connectionString:env.LAS_DATABASE_URL,hyperdrive:false}
    :{connectionString:binding?.connectionString,hyperdrive:true};
}

export function createAuthPostgresPool(connectionString,ClientClass=pg.Client,
    {attempts=2,delayMs=400,hyperdrive=false}={}){
  return requestScopedPool({
    connectionString,connectionTimeoutMillis:3500,
    ...(hyperdrive?{}:{ssl:{rejectUnauthorized:true}})
  },ClientClass,{attempts,delayMs});
}
