import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {
  verifyWorkflowOidc,makeLocSignedRequest,signLocRequest,
  handleLocDeploymentSignal,LOC_SIGNAL_PATH
} from '../services/workers/lunarcus/loc-notification.mjs';
const crypto=webcrypto;
const sha='a'.repeat(40),version='a40c157e-a001-4a12-9f34-014264b9feea';
const secret='only-for-tests-no-real-auth-key-1234567890';
const audience='https://auth.lo3rwang.cc'+LOC_SIGNAL_PATH;
const origFetch=globalThis.fetch;
const origCrypto=globalThis.crypto;
function b64(bytes){return Buffer.from(bytes).toString('base64url')}
async function tokenPair(){
  const keys=await crypto.subtle.generateKey({
    name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),
    hash:'SHA-256'
  },true,['sign','verify']);
  const publicJwk=await crypto.subtle.exportKey('jwk',keys.publicKey);
  return {privateKey:keys.privateKey,publicJwk:{...publicJwk,kid:'mock',use:'sig',alg:'RS256'}};
}
const keys=await tokenPair();
async function idToken(overrides={}){
  const now=Math.floor(Date.now()/1000);
  const header=b64(JSON.stringify({alg:'RS256',typ:'JWT',kid:'mock'}));
  const claims={
    iss:'https://token.actions.githubusercontent.com',aud:audience,
    repository:'EsotericVerse/lunarcus',repository_id:'1459462420',
    workflow_ref:'EsotericVerse/lunarcus/.github/workflows/notify-loc-after-auth.yml@refs/heads/main',
    sub:'repo:EsotericVerse/lunarcus:ref:refs/heads/main',ref:'refs/heads/main',
    sha,iat:now,exp:now+300,...overrides
  };
  const payload=b64(JSON.stringify(claims));
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,
    new TextEncoder().encode(header+'.'+payload));
  return header+'.'+payload+'.'+b64(signature);
}
async function withMocks(testBody){
  const calls=[];
  globalThis.crypto=crypto;
  globalThis.fetch=async(url,opts={})=>{
    calls.push({url:String(url),opts});
    if(String(url).endsWith('/.well-known/jwks'))
      return Response.json({keys:[keys.publicJwk]});
    if(String(url).endsWith('/commits/main'))
      return Response.json({sha});
    if(String(url).endsWith('/dispatches'))
      return new Response(null,{status:204});
    throw Error('Unexpected network request');
  };
  try{await testBody(calls)}finally{
    globalThis.fetch=origFetch;globalThis.crypto=origCrypto;
  }
}
function build(jwt){return new Request(audience,{
  method:'POST',
  headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
  body:JSON.stringify({sha})
})}
test('Signed envelope is short-lived and does not contain credentials',async()=>{
  globalThis.crypto=crypto;
  try{
    const req=makeLocSignedRequest(sha,version,secret,Date.parse('2026-11-17T01:00:00Z'));
    assert.equal(req.schema,'loc.las-published.v1');
    assert.equal(Date.parse(req.expiresAt)-Date.parse(req.issuedAt),300000);
    assert.match(await signLocRequest(req,secret),/^[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(req).includes(secret));
  }finally{globalThis.crypto=origCrypto;}
});
test('OIDC GitHub signature, repo, branch, workflow and SHA protect notification',async()=>{
  await withMocks(async(calls)=>{
    assert.equal((await verifyWorkflowOidc(await idToken(),sha)).sha,sha);
    await assert.rejects(()=>verifyWorkflowOidc(await idToken({ref:'refs/heads/dev'}),sha),/Unauthorized/);
    await assert.rejects(()=>verifyWorkflowOidc(await idToken({sha:'b'.repeat(40)}),sha),/Unauthorized/);
    assert.ok(calls.some(c=>c.url.endsWith('/.well-known/jwks')));
  });
});
test('Fail closed without GitHub dispatch credential; never send untrusted tokens',async()=>{
  await withMocks(async(calls)=>{
    const r=await handleLocDeploymentSignal(build(await idToken()),{
      LOC_WORKFLOW_KEY:secret,CF_VERSION_METADATA:{id:version}
    });
    assert.equal(r.status,503);
    assert.ok(!calls.some(c=>c.url.endsWith('/dispatches')));
    const bad=await handleLocDeploymentSignal(build('bad.token.parts'),{
      LOC_WORKFLOW_KEY:secret,LOC_GITHUB_DISPATCH_TOKEN:'test',CF_VERSION_METADATA:{id:version}
    });
    assert.equal(bad.status,403);
  });
});
test('Valid release notifies LOC repository_dispatch once through GitHub only',async()=>{
  await withMocks(async(calls)=>{
    const r=await handleLocDeploymentSignal(build(await idToken()),{
      LOC_WORKFLOW_KEY:secret,LOC_GITHUB_DISPATCH_TOKEN:'mock-github-dispatch-auth',
      CF_VERSION_METADATA:{id:version}
    });
    assert.equal(r.status,202);
    const dispatch=calls.find(c=>c.url.endsWith('/dispatches'));
    assert.ok(dispatch);
    assert.equal(dispatch.url,'https://api.github.com/repos/EsotericVerse/lunacodex/dispatches');
    assert.equal(JSON.parse(dispatch.opts.body).event_type,'loc-las-published');
    assert.equal(JSON.parse(dispatch.opts.body).client_payload.request.version,version);
    assert.equal(calls.filter(c=>c.url.endsWith('/dispatches')).length,1);
  });
});
