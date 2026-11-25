// LAS owns its Hyperdrive-bound Auth database connection. Hyperdrive handles
// origin TLS and pooling; LAS owns its request-scoped pg connection lifecycle.
// No SQL target discovery, database sharing, or implicit privileges.
import pg from 'pg';
function requestScopedPool(options,ClientClass=pg.Client,
    {attempts=2,delayMs=400}={}){
  return {
    async connect(){
      let lastError;
      for(let attempt=1;attempt<=attempts;attempt++){
        const client=new ClientClass(options);
        client.on?.('error',()=>{});
        try{
          await client.connect();
          client.release=()=>{void Promise.resolve(client.end()).catch(()=>{});};
          return client;
        }catch(error){
          lastError=error;
          void Promise.resolve(client.end?.()).catch(()=>{});
          if(attempt<attempts)
            await new Promise(resolve=>setTimeout(resolve,delayMs));
        }
      }
      throw lastError;
    },
    async end(){}
  };
}

export function createAuthPostgresPool(connectionString,ClientClass=pg.Client,
    {attempts=2,delayMs=400}={}){
  return requestScopedPool({
    connectionString,connectionTimeoutMillis:3500
  },ClientClass,{attempts,delayMs});
}
