import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkLocAuthEnvironment,lasAuthConnectionString}
 from '../server/auth/auth.mjs';
import {createAuthPostgresPool} from '../server/auth/pg-driver.mjs';

const authEnv=()=>{
 const env={
   LOC_CONTROL_ENCRYPTION_KEY:'test-secret-not-for-production-'.repeat(2),
   GOOGLE_CLIENT_ID:'test-google-id',
   GOOGLE_CLIENT_SECRET:'test-google-secret',
   LAS_DATABASE_URL:'postgresql://legacy:password@db.example.invalid/db'
 };
 return env;
};
const hyperdriveString='postgresql://edge:pass@hyperdrive.example.invalid/db';

test('LAS Wrangler binds the existing las-postgres Hyperdrive ID',()=>{
 const source=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
 assert.match(source,/"binding": "LAS_HYPERDRIVE"/);
 assert.match(source,/"id": "f80d2201f6344ccaa105d3fe47c8b518"/);
});
test('LAS Auth rejects missing Hyperdrive even with old database Secret',()=>{
 const env=authEnv();
 assert.throws(()=>lasAuthConnectionString(env),/LAS_HYPERDRIVE binding is required/);
 assert.throws(()=>checkLocAuthEnvironment(env),/LAS_HYPERDRIVE binding is required/);
});
test('LAS Auth selects the Hyperdrive connectionString instead of the Secret',()=>{
 const env={...authEnv(),LAS_HYPERDRIVE:{connectionString:hyperdriveString}};
 assert.equal(lasAuthConnectionString(env),hyperdriveString);
 assert.equal(checkLocAuthEnvironment(env),true);
 assert.throws(()=>checkLocAuthEnvironment({...env,LAS_HYPERDRIVE:{
   connectionString:'mysql://wrong-dialect.example.invalid/db'
 }}),/LAS requires PostgreSQL/);
 const source=readFileSync(new URL('../server/auth/auth.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/createAuthPostgresPool\(env\.LAS_DATABASE_URL\)/);
});
test('LAS pg Client is request-scoped with Hyperdrive transport TLS handled upstream',async()=>{
 const seen=[];
 class MockClient{
  constructor(options){seen.push(options);}
  on(){}
  async connect(){}
  async end(){this.ended=true;}
 }
 const pool=createAuthPostgresPool(hyperdriveString,MockClient,{attempts:1,delayMs:0});
 const conn=await pool.connect();
 assert.equal(seen.length,1);
 assert.equal(seen[0].connectionString,hyperdriveString);
 assert.equal(seen[0].connectionTimeoutMillis,3500);
 assert.equal(Object.hasOwn(seen[0],'ssl'),false);
 conn.release();
 await pool.end();
});
