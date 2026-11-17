# MCP hosted by existing LunArcus Worker

Cloudflare's existing `lunarcus` Worker owns **both** `auth.lo3rwang.cc` and `mcp.lo3rwang.cc` as custom domains. Verified from Cloudflare Workers Domains on 2026-11-17 after the owner detached MCP from the LOC Pages project and attached it to `lunarcus`.

## Deployment

- **One Worker, no new `las-mcp` Worker.** `wrangler.jsonc` is the sole production deploy config. The `app/las/index.mjs` entrypoint dispatches `mcp.lo3rwang.cc` requests to `app/las/mcp/server.mjs` before any Better Auth or PostgreSQL pool initialization. The latter is a module entrypoint, not a separate production Worker.
- Cloudflare Workers Builds connected to `EsotericVerse/lunarcus` deploys the existing `lunarcus` Worker. Production and Preview must watch `app/las/**`, `vendor/loc-dialect/**`, root `wrangler.jsonc` and dependency manifests (as of the pre-merge audit, this Cloudflare external change has **not** yet been applied). The old `services/workers/lunarcus/**` watch-path pattern can be removed after checking the current `app/las/**` watch but is not itself a second deployment; no new Worker build is required for Plugins-only or CMS Mapping-only edits. Do not build LOC from Plugins-only edits.
- `.github/workflows/deploy-las-mcp.yml` verifies only. It never deploys or creates a second Worker, never requires `LOC_WORKFLOW_KEY` in LAS GitHub Secrets, and never changes LRS.
- `auth.lo3rwang.cc` continues serving Better Auth, SSO and OAuth. The MCP hostname serves protected-resource metadata, MCP JSON-RPC/SSE transport, and only explicitly allowlisted LOC proxy routes.
- LOC retains `https://loc.lo3rwang.cc/api/las-native` for its own business authorization and SQL portable logic. No LOC database access is moved to LAS.

## Verify real production

1. GitHub PR checks pass, then Cloudflare's `lunarcus` Workers Build completes successfully.
2. Cloudflare Workers Domains lists **both** custom domains pointing to service `lunarcus` production.
3. `GET https://auth.lo3rwang.cc/health` remains a working Auth health endpoint; `GET https://mcp.lo3rwang.cc/.well-known/oauth-protected-resource` returns LAS MCP resource metadata.
4. Unauthenticated `GET /` challenges with 401 on the MCP hostname (the optional `/mcp` alias is not the canonical server URL); the MCP hostname never serves Auth session routes. Validate authenticated MCP, SSE, LOC business proxies and full SSO separately before claiming functional completion.
5. `loc.lo3rwang.cc` remains owned by LOC Pages and `isr.lo3rwang.cc` remains on `loc-isr`.

## ISR

The owner assigns future ISR operational ownership to LAS, but it is currently **off by default**, and `loc-isr` must not be removed or rebuilt yet. There is no recovered trustworthy ISR source in this repository. Heavy Next/OpenNext ISR compilation is not a dependency of Auth or MCP deployment. A future ISR cutover must be isolated, tested, and explicitly approved.

## Optional LOC notification

LAS may record `skip`, `notify`, or `review` following a successful LAS deploy; Plugins-only and internal changes mean `skip`. This decision is not permission to flood LOC builds. Actual LOC deployment, when required, must be executed by a LOC-owned GitHub Workflow and deduplicated per published contract version. Until that chain is validated, keep LOC notification disabled; no direct Pages deploy hook is part of MCP cutover.
