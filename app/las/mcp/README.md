# LAS MCP — transport, tools and authorization

The canonical server URL is **`https://mcp.lo3rwang.cc/`** (no required `/mcp` suffix). Cloudflare routes it to the same existing `lunarcus` Worker as `auth.lo3rwang.cc`. `app/las/index.mjs` dispatches by hostname; `app/las/mcp/server.mjs` handles the MCP host.

## Source responsibilities

| File | Responsibility |
|---|---|
| `server.mjs` | MCP hostname entrypoint, protected-resource metadata, CORS and allowlisted LOC proxy paths |
| `router.mjs` | OAuth Bearer validation, JSON-RPC initialize, tools/list, tools/call and authorization boundary |
| `access-roles.mjs` | MCP role checks; upstream SSO identity does not grant business authority |
| `tool-contracts.mjs` | MCP operation definitions and validated tool argument schemas |
| `stateless-transport.mjs`, `stream-json.mjs` | Streamable HTTP and bounded JSON transport |
| `business-actions.mjs`, `gateway-qos.mjs` | Tool execution and admission/quality-of-service checks |
| `loc-mapping.mjs` | Compatibility re-export from `../tunnel/loc-mapping.mjs` |

No upstream MCP provider relay (Clerk/GitHub/Neon/Supabase OAuth, tool policy, pending-approval vault) is in scope. LAS uses its existing Auth issuer at `auth.lo3rwang.cc`; do not recreate the retired Cloudflare Access upstream SSO path or treat LAS as an upstream provider credential vault. An unwired `upstream/` subtree implementing that relay was removed 2026-11-17 — it was never referenced by `router.mjs` and was built without the owner's direction.

## Trust boundaries

- LAS verifies an actual access token with the existing `auth.lo3rwang.cc/api/auth` issuer. Authentication alone does not grant MCP tool or LOC article/data permissions.
- LAS forwards only fixed, bounded and authenticated operations through LOC's `https://loc.lo3rwang.cc/api/las-native` service; it does **not** accept arbitrary SQL, destination databases, SSRF URLs or client-selected grants.
- LOC remains the authority for Galaxy/Anchor, Scope authorization, business queries, Z-Model and SQL Portable (PostgreSQL/MySQL/MSSQL). LRS alone owns rune/game source and assets.
- Keep the current resource metadata, OAuth challenges, existing MCP tools, POST Streamable HTTP responses, consent behavior and idempotency receipts. The current GET `/` request with no Bearer challenges unauthorized callers; it is not a persistent GET-SSE channel.

## Acceptance

Run `npm run check:mcp` and `npm run mcp:dry-run`, then independently verify real `initialize`, `tools/list`, `tools/call`, tool-level Scope/role access, upstream provider flows and authenticated LOC operations on the public endpoint. CI/Worker deployment/SSO success alone does not prove every MCP action works. Current authentication and consent behavior must be checked against the running LAS Auth implementation; dated Cloudflare Access SSO results are historical, not a live acceptance claim.

Cloudflare custom-domain and Secret configuration must not be changed merely to move code or documentation. Current build ownership and watch paths are described beside the workflows in `.github/workflows/README.md`.
