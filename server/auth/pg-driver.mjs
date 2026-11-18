// LAS Auth-only PostgreSQL lifecycle, independent of LOC SQL dialects.
// Each request obtains and closes its own pg.Client.
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
