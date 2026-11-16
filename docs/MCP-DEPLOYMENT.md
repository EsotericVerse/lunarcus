# LAS MCP domain handoff and deployment

## Ownership and source of truth (2026-11-17)

- Cloudflare Pages project `loc` **no longer** owns `mcp.lo3rwang.cc` (verified by reading the active Pages custom-domain list after the owner detached it).
- The MCP protocol server source is `app/las/mcp/**` with entrypoint `services/workers/las-mcp/index.mjs` in `EsotericVerse/lunarcus`.
- `services/workers/las-mcp/wrangler.jsonc` owns Worker `las-mcp` and binds **only** the transferred `mcp.lo3rwang.cc` Custom Domain. The Auth Worker `lunarcus` and hostname `auth.lo3rwang.cc` are unchanged.
- `.github/workflows/deploy-las-mcp.yml` publishes on LAS MCP server/source/config changes on `main`, or by manual dispatch. It uses LAS's existing `LOC_WORKFLOW_KEY` GitHub Actions secret as the designated Cloudflare credential, as specified by the owner. Secret presence and API permissions must be proven in the actual publish job.
- Never use this workflow to deploy `lunarunes`, modify its emergency release gate, or trigger LOC Pages. Client-only `las:plugins` and `las:tunnel` / CMS mapping changes do not trigger MCP release.

## Live cutover verification

A GitHub Workflow or Wrangler dry-run alone is not evidence of a working production MCP server.

1. LAS MCP job succeeds and Cloudflare lists a deployed `las-mcp` Worker with an active `mcp.lo3rwang.cc` route.
2. `GET https://mcp.lo3rwang.cc/.well-known/oauth-protected-resource` returns the expected OAuth resource metadata. Without bearer auth, `/mcp` returns an OAuth challenge; other unsupported routes return 404.
3. The fixed `/api/loc-native` proxy reaches LOC's existing `/api/las-native` without forwarding website session cookies. Verify actual valid OAuth, scope permission, streaming, Queue receipts and provider callbacks separately.
4. Confirm `loc.lo3rwang.cc` remains attached to LOC Pages and `auth.lo3rwang.cc` remains on `lunarcus`. Do not change the names or the credentials of those live services.

## Security and deployment boundaries

- A signing secret is **not automatically** a Cloudflare API token. The existing `LOC_WORKFLOW_KEY` can authorize the Wrangler deployment only if its value is a Cloudflare credential with sufficient permissions. Fail closed if absent or invalid, and never print the value.
- The relationship to LOC's `CLOUDFLARE_API_TOKEN` and LRS's `LOC_EMERGENCY_KEY` is owner-specified compatibility. This workflow contains no call to `loc-lrs-emergency` or LRS release code.
- Keep the LOC business/data service under `https://loc.lo3rwang.cc/api/las-native`; LAS MCP provides protocol transport, not LOC SQL or business permissions.
- Rollback requires an explicit routing decision; do not silently reattach `mcp.lo3rwang.cc` to LOC Pages.
