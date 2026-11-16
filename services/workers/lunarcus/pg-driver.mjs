// LAS uses a request-scoped native PostgreSQL connection.
// LAS_DATABASE_URL is supplied by the Worker; no additional database role is assumed.
// Each Kysely acquisition owns a fresh pg.Client; no sockets cross requests.
import pg from 'pg';

export function createAuthPostgresPool(connectionString,ClientClass=pg.Client,
    {attempts=2,delayMs=400}={}){
  const options={connectionString,connectionTimeoutMillis:3500,
    ssl:{rejectUnauthorized:true}};
  return {
    async connect(){
      let lastError;
      for(let attempt=1;attempt<=attempts;attempt++){
        const client=new ClientClass(options);
        client.on?.('error',()=>{});
        try{
          await client.connect();
          // Kysely's PostgresDialect calls release() after every acquisition.
          client.release=()=>{void Promise.resolve(client.end()).catch(()=>{});};
          return client;
        }catch(error){
          lastError=error;
          void Promise.resolve(client.end?.()).catch(()=>{});
          // Only connection setup can be retried. Never retry executed SQL.
          if(attempt<attempts)
            await new Promise(resolve=>setTimeout(resolve,delayMs));
        }
      }
      throw lastError;
    },
    // No persistent pool, sockets or waiters to close between requests.
    async end(){}
  };
}
