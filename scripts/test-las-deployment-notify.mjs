import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planLasDeployment,chooseLocAction} from './plan-las-deployment.mjs';

const workflow=readFileSync(new URL('../.github/workflows/notify-loc-after-auth.yml',import.meta.url),'utf8');
const file=(filename,patch='+const x=1;')=>({filename,patch});

test('las:plugins Chrome and public plugin settings do not rebuild LOC or server workers',()=>{
  const plan=planLasDeployment([
    file('plugins/chrome/background.js'),file('plugins/chrome/manifest.json'),
    file('public/plugins/chrome/oauth/config.json')]);
  assert.deepEqual(plan.las,{auth:false,mcp:false,plugins:true});
  assert.equal(plan.loc,'skip');
});

test('LAS CMS Data Mapping remains LAS-owned and never independently rebuilds LOC',()=>{
  const plan=planLasDeployment([file('app/las/tunnel/loc-mapping.mjs',
    '+const mcpOperation="mcp-read";')]);
  assert.equal(plan.las.mcp,false);
  assert.equal(plan.loc,'skip');
});

test('LAS MCP server deployment is independent; only LOC-facing protocol changes need review',()=>{
  const internal=planLasDeployment([file('app/las/mcp/server.mjs',
    '+const retryTimeout=100;')]);
  assert.equal(internal.las.mcp,true);
  assert.equal(internal.loc,'skip');
  const boundary=planLasDeployment([file('app/las/mcp/server.mjs',
    '+LOC_PROXY_ROUTES.set("/api/loc-native","/api/las-native");')]);
  assert.equal(boundary.las.mcp,true);
  assert.equal(boundary.loc,'review');
});

test('Auth internal implementation changes alone do not rebuild LOC',()=>{
  const plan=planLasDeployment([file('app/las/auth/pg-driver.mjs')]);
  assert.equal(plan.las.auth,true);
  assert.equal(plan.loc,'skip');
});
test('Auth public OAuth/server protocol delta can notify LOC after successful Auth deployment',()=>{
  const plan=planLasDeployment([file('app/las/index.mjs',
    '@@ -1 +1 @@\n-const x="/api/auth/oauth2/token";\n+const x="/api/auth/oauth2/token-v2";')]);
  assert.equal(plan.las.auth,true);
  assert.equal(plan.loc,'notify');
});
test('Auth user-facing label or comments alone do not rebuild LOC',()=>{
  const plan=planLasDeployment([file('app/las/index.mjs',
    '@@\n-// oauth2 token is unchanged\n+// oauth2 token is unchanged\n+const title="LunArcus";')]);
  assert.equal(plan.loc,'skip');
});
test('missing public protocol diff fails closed to review, not a guessed LOC build',()=>{
  const plan=planLasDeployment([{filename:'app/las/auth/auth.mjs',patch:null}]);
  assert.equal(plan.loc,'review');
});
test('Shared package updates do not automatically rebuild LOC',()=>{
  const plan=planLasDeployment([file('package.json'),file('package-lock.json')]);
  assert.equal(plan.loc,'skip');
});
test('Combined Plugins and Auth server protocol changes trigger only intended target',()=>{
  const plan=planLasDeployment([file('plugins/chrome/options.js'),
    file('app/las/auth/auth.mjs','+const issuer=LOC_ISSUER;')]);
  assert.equal(plan.las.plugins,true);
  assert.equal(plan.las.auth,true);
  assert.equal(plan.loc,'notify');
});
test('manual controls can choose notify or skip without changing the automatic classifier',()=>{
  const plan=planLasDeployment([file('app/las/mcp/tool-contracts.mjs',
    '+const newTool="/api/las-native";')]);
  assert.equal(plan.loc,'review');
  assert.equal(chooseLocAction(plan,'auto'),'review');
  assert.equal(chooseLocAction(plan,'notify'),'notify');
  assert.equal(chooseLocAction(plan,'skip'),'skip');
  assert.throws(()=>chooseLocAction(plan,'unsupported'));
});
test('unknown or unverified change list is never an automatic deployment',()=>{
  assert.equal(planLasDeployment([]).loc,'review');
  assert.equal(planLasDeployment([{filename:'../unsafe',patch:'+'}]).loc,'review');
});

test('Only a published LAS Worker can trigger signed LOC GitHub workflow notification',()=>{
  for(const contract of [
    'check_run:', 'types: [completed]',
    "github.event.check_run.name == 'Workers Builds: lunarcus'",
    "github.event.check_run.app.slug == 'cloudflare-workers-and-pages'",
    "github.event.check_run.conclusion == 'success'",
    'steps.impact.outputs.decision == \'notify\'',
    'id-token: write', 'scripts/send-las-loc-notification.mjs',
    'workflow_dispatch:', 'options: [auto, notify, skip]'
  ]) assert.ok(workflow.includes(contract),'Missing deployment contract: '+contract);
  assert.ok(!workflow.includes('LOC_PAGES_DEPLOY_HOOK'));
  assert.ok(!workflow.includes('secrets.LOC_WORKFLOW_KEY'));
  assert.ok(!workflow.includes('CLOUDFLARE_API_TOKEN'));
  const resolver=readFileSync(new URL('./resolve-las-deployment-impact.mjs',import.meta.url),'utf8');
  assert.ok(resolver.includes('/git/ref/heads/main'));
  assert.ok(resolver.includes("sha!==mainSha"));
  assert.ok(resolver.includes('planLasDeployment(files)'));
  assert.ok(resolver.includes('las_sha='));
  assert.ok(resolver.includes("event==='workflow_dispatch'&&mode==='notify'"));
  const sender=readFileSync(new URL('./send-las-loc-notification.mjs',import.meta.url),'utf8');
  assert.ok(sender.includes('ACTIONS_ID_TOKEN_REQUEST_TOKEN'));
  assert.ok(sender.includes("auth.lo3rwang.cc/_internal/loc-deploy"));
  assert.ok(!sender.includes('LOC_WORKFLOW_KEY'));
});
