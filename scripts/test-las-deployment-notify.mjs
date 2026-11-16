import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/notify-loc-after-auth.yml',import.meta.url),'utf8');

test('only Cloudflare production Auth completion can notify LOC',()=>{
  for(const contract of [
    'check_run:', 'types: [completed]',
    "github.event.check_run.name == 'Workers Builds: lunarcus'",
    "github.event.check_run.app.slug == 'cloudflare-workers-and-pages'",
    "github.event.check_run.conclusion == 'success'",
    '/git/ref/heads/main', 'LAS_SHA', 'main_sha'
  ]) assert.ok(workflow.includes(contract),'Missing trusted LAS gate: '+contract);
  assert.ok(!workflow.includes('repository_dispatch'),'Do not mutate LOC workflows');
  assert.ok(!workflow.includes('git push'),'Do not create a dummy LOC commit');
});

test('LOC deployment is a single secret-protected Pages hook',()=>{
  assert.ok(workflow.includes('secrets.LOC_PAGES_DEPLOY_HOOK'));
  assert.ok(workflow.includes('https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/'));
  assert.ok(workflow.includes('curl --fail'));
  assert.ok(workflow.includes('--request POST'));
  assert.ok(workflow.includes("services/workers/lunarcus/"));
  assert.ok(workflow.includes('vendor/loc-dialect/'));
  assert.ok(!workflow.includes('CLOUDFLARE_API_TOKEN'));
});
