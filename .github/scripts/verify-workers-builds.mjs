// GitHub-only observation of Cloudflare's existing Git-connected build check.
// No Cloudflare API, credentials, Worker upload, DNS or grant operations.
const repo=process.env.GITHUB_REPOSITORY;
const sha=process.env.TARGET_SHA;
const token=process.env.GITHUB_TOKEN;
const worker='lunarcus';
const context='Workers Builds: '+worker;
const phase=process.env.RELEASE_PHASE==='preview'?'preview':'production';
if(!repo||!sha||!/^[a-f\d]{40}$/i.test(sha)||!token)
  throw Error('Missing GitHub identity for '+phase+' verification');
const url='https://api.github.com/repos/'+repo+'/commits/'+sha+'/check-runs?per_page=100';
const headers={
  authorization:'Bearer '+token,
  accept:'application/vnd.github+json',
  'x-github-api-version':'2022-11-28'
};
let found=false;
for(let attempt=0;attempt<15;attempt++){
  const response=await fetch(url,{headers});
  if(!response.ok)throw Error('GitHub check lookup failed HTTP '+response.status);
  const checks=(await response.json()).check_runs||[];
  const matches=checks.filter(row=>row.name===context&&
    row.app?.slug==='cloudflare-workers-and-pages');
  const check=matches.sort((a,b)=>String(b.started_at||'').localeCompare(String(a.started_at||'')))[0];
  if(check){
    found=true;
    if(check.status==='completed'){
      if(check.conclusion==='success'){
        console.log('Verified Cloudflare '+phase+' build check for commit '+sha);
        console.log('Evidence: '+check.details_url);
        process.exit(0);
      }
      throw Error('Cloudflare '+phase+' build reported '+check.conclusion+
        ' for '+sha+'; '+check.details_url);
    }
  }
  if(attempt<14)await new Promise(resolve=>setTimeout(resolve,10000));
}
throw Error(found
  ?'Cloudflare '+phase+' build has not completed for '+sha
  :'Cloudflare '+phase+' check absent for '+sha+
    '. Verify the existing Git integration and Preview Builds settings separately.');
