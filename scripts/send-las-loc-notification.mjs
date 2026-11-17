// Called only after the LAS Cloudflare production check and LOC-impact classifier.
const SHA=process.env.LAS_SHA;
const AUD='https://auth.lo3rwang.cc/_internal/loc-deploy';
if(!/^[a-f0-9]{40}$/.test(SHA||''))throw Error('Invalid LAS main SHA');
const actionURL=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const actionToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if(!actionURL||!actionToken)throw Error('Missing GitHub Actions OIDC context');
const url=new URL(actionURL);
url.searchParams.set('audience',AUD);
const idResponse=await fetch(url,{
  headers:{Authorization:'Bearer '+actionToken},redirect:'error'
});
if(!idResponse.ok)throw Error('GitHub Actions OIDC request failed HTTP '+idResponse.status);
const id=await idResponse.json();
if(!id.value)throw Error('Missing Github OIDC token');
const res=await fetch(AUD,{
  method:'POST',redirect:'error',
  headers:{Authorization:'Bearer '+id.value,'content-type':'application/json'},
  body:JSON.stringify({sha:SHA})
});
if(!res.ok){
  // Do not log the bearer token or body. A failure must NOT be marked notified.
  throw Error('LAS deployment notification refused HTTP '+res.status);
}
console.log('LOC GitHub repository_dispatch accepted for published LAS SHA '+SHA);
