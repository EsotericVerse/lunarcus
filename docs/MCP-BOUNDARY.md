# MCP move: dependency and trust boundary

LunArcus owns **protocol transport, OIDC/OAuth integration, Chrome Extension connectivity and the MCP Gateway**. LOC owns **business data, Scope authorization, imports, SQL portable CRUD, and the PostgreSQL/MySQL/MSSQL dialect adapters**.

The current `app/loc/mcp/` directory in this repository is an exact migration snapshot, **not yet a standalone runtime**. In particular:

| Copied module | Cross-repository requirements remaining |
|---|---|
| `router.mjs` | Calls LOC-specific business actions, private Galaxy and article distribution |
| `native-operations.mjs` | Imports LOC providers, Scope policies, import pipelines, Z-Model and SQL-portable code |
| `galaxy-read.mjs` | Requires LOC Scope route index, portable search and ZenStack Galaxy model |
| `native-kysely.mjs` | Imports LOC connection profile and dialect factory; may be replaced only with existing Kysely's `PostgresDialect` for the dedicated **Gateway** connection |
| `tool-contracts.mjs` | Imports LOC Scope route index |
| `business-actions.mjs`, `private-galaxy.mjs`, `article-distribution.mjs` | LOC-side authorization and data semantics |
| `upstream-*.mjs`, `stateless-transport.mjs`, `stream-json.mjs` | Candidate LunArcus-owned MCP transport/provider modules after dependency validation |

## Binding contract to implement before activating MCP in LunArcus

1. LunArcus validates the caller's **real OAuth token** against the unchanged `auth.lo3rwang.cc/api/auth` issuer. A login alone never grants LOC business permissions.
2. LunArcus forwards only a bounded, authenticated operation to a fixed LOC service URL over a trusted server-side channel. **No generic SQL, arbitrary URL or user-selected database connections** are exposed.
3. LOC owns target database resolution, Scope access checks and policy. Queries/transactions use LOC's existing dialect and Z-Model contracts. LunArcus does not duplicate MySQL, MSSQL or SQL Portable adapters.
4. Preserve existing MCP tools, SSE streaming, idempotency receipts, resource metadata and Chrome OAuth callbacks before cutover.
5. Keep the existing production `mcp.lo3rwang.cc` route until a replacement has functional parity and real authentication/permission regression verification. No Cloudflare changes are authorized by this snapshot alone.

MCP source here is therefore a preservation/porting baseline, not evidence of deployment readiness.
