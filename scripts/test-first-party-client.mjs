import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureFirstPartyOAuthClient,isFirstPartyOAuthConsent
} from '../app/las/auth/first-party-client.mjs';
import {firstPartyOAuthClient,extensionClientDiscovery}
  from '../app/las/auth/extension-client.mjs';

const canonical=firstPartyOAuthClient();
const signed=clientId=>({
  oauth_query:new URLSearchParams({client_id:clientId,sig:'valid-signature-placeholder'}).toString()
});
function dbMock(responses){
  const calls=[];
  let released=0;
  const client={
    async query(sql,params){
      calls.push({sql,params});
      const result=responses.shift();
      if(result instanceof Error)throw result;
      if(!result)throw new Error('Unexpected query');
      return result;
    },
    release(){released++}
  };
  return {pool:{async connect(){return client}},calls,releaseCount:()=>released};
}

test('first-party identity is sourced only from bundled OAuth client JSON',async()=>{
  assert.equal(canonical.clientId,'lunarcus');
  assert.equal(extensionClientDiscovery().id,canonical.clientId);
  assert.deepEqual(await extensionClientDiscovery().resolve({},canonical.clientId),
    canonical);
  assert.equal(isFirstPartyOAuthConsent(signed(canonical.clientId)),true);
  assert.equal(isFirstPartyOAuthConsent(signed('loc-galaxy-link')),false);
  assert.equal(isFirstPartyOAuthConsent({oauth_query:'client_id=lunarcus'}),false);
  assert.equal(isFirstPartyOAuthConsent({oauth_query:'x'.repeat(8193)}),false);
});

test('missing current first-party OAuth client is inserted once via LAS connection',async()=>{
  const db=dbMock([
    {rows:[]},
    {rowCount:1,rows:[{clientId:canonical.clientId}]}
  ]);
  const result=await ensureFirstPartyOAuthClient(db.pool);
  assert.deepEqual(result,{created:true,clientId:'lunarcus'});
  assert.equal(db.releaseCount(),1);
  assert.equal(db.calls.length,2);
  assert.match(db.calls[0].sql,/FROM public\.las_oauth_client WHERE "clientId"=\$1/);
  assert.deepEqual(db.calls[0].params,['lunarcus']);
  assert.match(db.calls[1].sql,/ON CONFLICT \("clientId"\) DO NOTHING/);
  assert.match(db.calls[1].sql,/RETURNING "clientId"/);
  assert.equal(db.calls[1].params[1],canonical.clientId);
  assert.equal(db.calls[1].params[2],canonical.clientId);
  assert.equal(db.calls[1].params[6],JSON.stringify(canonical.redirectUris));
  assert.equal(db.calls[1].params[7],JSON.stringify(canonical.grantTypes));
  assert.equal(db.calls[1].params[9],JSON.stringify(canonical.scopes));
  assert.equal(db.calls[1].params[10],'none');
  assert.equal(db.calls[1].params[12],true);
  assert.equal(db.calls[1].params[14],false);
  assert.ok(!db.calls[1].sql.includes('UPDATE'));
  assert.ok(!db.calls[1].sql.includes('DELETE'));
});

test('existing matching client is never written or replaced',async()=>{
  const db=dbMock([{rows:[{
    ...canonical,scopes:[...canonical.scopes].reverse()
  }]}]);
  assert.deepEqual(await ensureFirstPartyOAuthClient(db.pool),
    {created:false,clientId:'lunarcus'});
  assert.equal(db.calls.length,1);
  assert.equal(db.releaseCount(),1);
});

test('incompatible existing client fails closed without modifying it',async()=>{
  const db=dbMock([{rows:[{...canonical,requirePKCE:false}]}]);
  await assert.rejects(()=>ensureFirstPartyOAuthClient(db.pool),
    /incompatible registration/);
  assert.equal(db.calls.length,1);
  assert.equal(db.releaseCount(),1);
});

test('concurrent client registration is idempotent and verified',async()=>{
  const db=dbMock([{rows:[]},{rowCount:0,rows:[]},
    {rows:[canonical]}]);
  assert.deepEqual(await ensureFirstPartyOAuthClient(db.pool),
    {created:false,clientId:'lunarcus'});
  assert.equal(db.calls.length,3);
  assert.equal(db.releaseCount(),1);
});

test('database failure still releases request-scoped client',async()=>{
  const db=dbMock([new Error('Test database denial')]);
  await assert.rejects(()=>ensureFirstPartyOAuthClient(db.pool),
    /Test database denial/);
  assert.equal(db.releaseCount(),1);
});
