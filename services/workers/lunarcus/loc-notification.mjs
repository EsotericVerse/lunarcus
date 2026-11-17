// LAS -> LOC notification is authorized by GitHub Actions OIDC.
// LOC_WORKFLOW_KEY signs the dispatch; GitHub API requires its own repository-scoped credential.
export const LOC_SIGNAL_PATH='/_internal/loc-deploy';
const URL='https://auth.lo3rwang.cc'+LOC_SIGNAL_PATH;
const REPO='EsotericVerse/lunarcus';
const TARGET='EsotericVerse/lunacodex';
const WF=REPO+'/.github/workflows/notify-loc-after-auth.yml@refs/heads/main';
const ISSUER='https://token.actions.githubusercontent.com';
const HEX_SHA=/^[a-f0-9]{40}$/;
const VERSION=/^[a-f0-9-]{36}$/i;
const KEYS=['schema','repo','target','sha','worker','version','issuedAt','expiresAt'];
const json=(value,status)=>new Response(JSON.stringify(value),{
  status,headers:{'content-type':'application/json','cache-control':'no-store'}
});
const bytes=b64=>Uint8Array.from(atob(b64.replace(/-/g,'+').replace(/_/g,'/')+
  '='.repeat((4-b64.length%4)%4)),ch=>ch.charCodeAt(0));
const encode=value=>new TextEncoder().encode(value);
const hex=b=>[...b].map(v=>v.toString(16).padStart(2,'0')).join('');
const canonical=req=>KEYS.map(k=>String(req[k]??'')).join('\n');
async function fetchJson(url,init={}){
  const res=await fetch(url,{...init,redirect:'error'});
  if(!res.ok)throw Error('Remote identity or state check HTTP '+res.status);
  return res.json();
}
export async function verifyWorkflowOidc(jwt,sha){
  if(!HEX_SHA.test(sha))throw Error('Invalid LAS SHA');
  const parts=String(jwt||'').split('.');
  if(parts.length!==3)throw Error('Invalid OIDC JWT');
  const header=JSON.parse(new TextDecoder().decode(bytes(parts[0])));
  const claims=JSON.parse(new TextDecoder().decode(bytes(parts[1])));
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>180)
    throw Error('Untrusted JWT algorithm');
  const jwks=await fetchJson(ISSUER+'/.well-known/jwks');
  const jwk=jwks.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA'&&
    k.use==='sig'&&k.alg==='RS256');
  if(!jwk)throw Error('Unknown GitHub OIDC signing key');
  const key=await crypto.subtle.importKey('jwk',jwk,
    {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const verified=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,
    bytes(parts[2]),encode(parts[0]+'.'+parts[1]));
  if(!verified)throw Error('Invalid GitHub OIDC signature');
  const now=Math.floor(Date.now()/1000);
  if(claims.iss!==ISSUER||claims.aud!==URL||
    claims.repository!==REPO||String(claims.repository_id)!=='1459462420'||
    claims.ref!=='refs/heads/main'||claims.sha!==sha||
    claims.workflow_ref!==WF||
    claims.sub!=='repo:'+REPO+':ref:refs/heads/main'||
    !Number.isInteger(claims.iat)||!Number.isInteger(claims.exp)||
    claims.iat>now+60||claims.exp<=now||claims.exp>now+600)
    throw Error('Unauthorized GitHub workflow identity');
  return claims;
}
export function makeLocSignedRequest(sha,version,secret,now=Date.now()){
  if(!HEX_SHA.test(sha)||!VERSION.test(version))throw Error('Invalid LAS deployment');
  if(typeof secret!=='string'||secret.length<32)
    throw Error('LOC_WORKFLOW_KEY unavailable for signing');
  const req={
    schema:'loc.las-published.v1',repo:REPO,target:TARGET,sha,
    worker:'lunarcus',version,
    issuedAt:new Date(now).toISOString(),
    expiresAt:new Date(now+300000).toISOString()
  };
  return req;
}
export async function signLocRequest(req,secret){
  const k=await crypto.subtle.importKey('raw',encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC',k,encode(canonical(req)))));
}
export async function handleLocDeploymentSignal(request,env){
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  if(request.headers.get('origin'))return json({error:'browser_origin_forbidden'},403);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))
    return json({error:'expected_json'},415);
  if(Number(request.headers.get('content-length')||0)>2048)
    return json({error:'payload_too_large'},413);
  let body;
  try{body=await request.text();if(body.length>2048)throw Error();body=JSON.parse(body);}
  catch{return json({error:'invalid_payload'},400);}
  const sha=body?.sha;
  const match=/^Bearer ([A-Za-z0-9._-]+)$/.exec(request.headers.get('authorization')||'');
  if(!match)return json({error:'github_oidc_required'},401);
  try{
    await verifyWorkflowOidc(match[1],sha);
    if(!env.LOC_WORKFLOW_KEY||!env.LOC_GITHUB_DISPATCH_TOKEN)
      return json({error:'release_dispatch_credentials_unavailable'},503);
    const current=await fetchJson('https://api.github.com/repos/'+REPO+'/commits/main',{
      headers:{'accept':'application/vnd.github+json','user-agent':'LAS-LOC-notify'}
    });
    if(current.sha!==sha)return json({error:'stale_main_revision'},409);
    const version=String(env.CF_VERSION_METADATA?.id||'');
    const req=makeLocSignedRequest(sha,version,env.LOC_WORKFLOW_KEY);
    const signature=await signLocRequest(req,env.LOC_WORKFLOW_KEY);
    const response=await fetch('https://api.github.com/repos/'+TARGET+'/dispatches',{
      method:'POST',redirect:'error',
      headers:{
        'authorization':'Bearer '+env.LOC_GITHUB_DISPATCH_TOKEN,
        'accept':'application/vnd.github+json',
        'x-github-api-version':'2022-11-28',
        'content-type':'application/json',
        'user-agent':'LAS-LOC-notify'
      },
      body:JSON.stringify({event_type:'loc-las-published',
        client_payload:{request:req,signature}})
    });
    if(response.status!==204)
      return json({error:'github_dispatch_failed',httpStatus:response.status},502);
    return json({accepted:true,lasSha:sha,version},202);
  }catch(error){
    // No raw error, jwt, GitHub credential or signing secret in the response.
    return json({error:'deployment_identity_verification_failed'},403);
  }
}
