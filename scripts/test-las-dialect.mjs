import test from 'node:test';
import assert from 'node:assert/strict';
import {Kysely,PostgresDialect} from 'kysely';
import dialect,{createKyselyDialect,requestScopedPool}
  from '../vendor/loc-dialect/index.mjs';
import {createAuthPostgresPool}
  from '../services/workers/lunarcus/pg-driver.mjs';

test('LAS contains the exact independent loc:dialect public contract',async()=>{
  const db=dialect('pg','postgresql://localhost/las_test');
  assert.ok(db instanceof Kysely);
  const compiled=db.selectNoFrom(eb=>eb.val(7).as('value')).compile();
  assert.match(compiled.sql,/select/i);
  assert.deepEqual(compiled.parameters,[7]);
  await db.destroy();
  assert.throws(()=>dialect('mysql','postgresql://localhost/las_test'),/Unsupported SQL driver/);
  assert.throws(()=>dialect('pg','https://example.invalid'),/PostgreSQL URL/);
  assert.throws(()=>dialect('pg','bad-url'),/Invalid database URL/);
});

test('LAS Auth shares factory but keeps its own PostgreSQL TLS and acquisition contract',async()=>{
  assert.ok(createKyselyDialect('postgres',{pool:{connect(){throw Error('not connected')},end(){}}})
    instanceof PostgresDialect);
  const attempted=[],closed=[];
  let n=0;
  class TestClient {
    constructor(options){this.options=options;attempted.push(options);}
    on(){}
    async connect(){if(++n===1)throw Error('test transient failure');}
    async end(){closed.push(this);}
  }
  const pool=createAuthPostgresPool('postgresql://localhost/las_test',
    TestClient,{attempts:2,delayMs:0});
  const client=await pool.connect();
  assert.equal(n,2);
  assert.equal(attempted.length,2);
  assert.equal(attempted[0].ssl.rejectUnauthorized,true);
  assert.equal(attempted[0].connectionTimeoutMillis,3500);
  assert.equal(attempted[0].connectionString,'postgresql://localhost/las_test');
  assert.equal(typeof client.release,'function');
  client.release();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(closed.length,2);
  await pool.end();
});

test('shared loc:dialect must not control LAS Auth roles, user session or target selection',()=>{
  assert.equal(typeof requestScopedPool,'function');
  assert.equal(typeof createAuthPostgresPool,'function');
});
