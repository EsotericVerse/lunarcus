import {appendFileSync} from 'node:fs';
import {planLasDeployment,chooseLocAction} from './plan-las-deployment.mjs';

const api=process.env.GITHUB_API_URL||'https://api.github.com';
const repo=process.env.GITHUB_REPOSITORY;
const token=process.env.GH_TOKEN;
const event=process.env.GITHUB_EVENT_NAME;
const mode=process.env.LOC_DEPLOY_MODE||'auto';
const sha=process.env.LAS_SHA;
if(!repo||!token||!['check_run','workflow_dispatch'].includes(event))
  throw Error('Deployment impact resolver requires GitHub Actions repository/token/event');
async function get(path){
  const r=await fetch(api+path,{headers:{Authorization:'Bearer '+token,
    Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!r.ok)throw Error('GitHub REST check failed (HTTP '+r.status+')');
  return r.json();
}
const reference=await get('/repos/'+repo+'/git/ref/heads/main');
const mainSha=reference.object?.sha;
if(!/^[a-f0-9]{40}$/.test(mainSha||''))throw Error('Unverified LAS main SHA');
let eligible=true;
if(event==='check_run'){
  if(!/^[a-f0-9]{40}$/.test(sha||'')||sha!==mainSha)eligible=false;
}
const currentSha=event==='check_run'?sha:mainSha;
let plan={las:{auth:false,mcp:false,plugins:false},loc:'skip',reasons:['not current LAS main']};
if(eligible){
  const files=[];
  for(let page=1;page<=10;page++){
    const commit=await get('/repos/'+repo+'/commits/'+currentSha+'?per_page=100&page='+page);
    const next=commit.files||[];
    files.push(...next);
    if(next.length<100)break;
    if(page===10)throw Error('Too many changes: manual classification required');
  }
  plan=planLasDeployment(files);
}
const decision=eligible?chooseLocAction(plan,mode):'skip';
const summary={sha:currentSha,mode,decision,las:plan.las,reasons:plan.reasons};
console.log('LAS deployment decision: '+JSON.stringify(summary));
if(process.env.GITHUB_STEP_SUMMARY){
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '### LAS independent deployment decision\n\n`'+decision+'` — '+plan.reasons.join('; ')+'\n\n'+
    'LAS: Auth '+plan.las.auth+', MCP '+plan.las.mcp+
    ', Plugins '+plan.las.plugins+'\n');
}
if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,'decision='+decision+'\n');
