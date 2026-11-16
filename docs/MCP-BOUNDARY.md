# MCP move: dependency and trust boundary

**`las` (LunArcus / Luna Protocol)** owns protocol transport, OIDC/OAuth integration, Chrome Extension, MCP Gateway and cross-module **Data Mapping**. **`loc` (LunaCodex)** owns Galaxy records/models, business authorization, imports, SQL Portable CRUD and PostgreSQL/MySQL/MSSQL dialect adapters. **`lrs` (LunaRunes)** owns rune assets and game/effects. These are module IDs, not renamed domains, database Scopes or OAuth client identifiers.

The active independently bundling LAS runtime is now `app/las/mcp/`. The modules below remain in the original **LOC repository** as the SaaS business/data implementation; they are not duplicated in the LAS runtime.

| Copied module | Cross-repository requirements remaining |
|---|---|
| `router.mjs` | Calls LOC-specific business actions, private Galaxy and article distribution |
| `native-operations.mjs` | Imports LOC providers, Scope policies, import pipelines, Z-Model and SQL-portable code |
| `galaxy-read.mjs` | Requires LOC Scope route index, portable search and ZenStack Galaxy model |
| `native-kysely.mjs` | Imports LOC connection profile and dialect factory; may be replaced only with existing Kysely's `PostgresDialect` for the dedicated **Gateway** connection |
| `tool-contracts.mjs` | Imports LOC Scope route index |
| `business-actions.mjs`, `private-galaxy.mjs`, `article-distribution.mjs` | LOC-side authorization and data semantics |
| `upstream-*.mjs`, `stateless-transport.mjs`, `stream-json.mjs` | Candidate LunArcus-owned MCP transport/provider modules after dependency validation |

## Data Mapping versus LOC data ownership

LAS mapping may normalize field names, transport envelopes, object/version references and validated source-to-target contracts across LOC and LRS. It must NOT own or duplicate LOC Galaxy's Z-Model, UID semantics, Scope grants, SQL dialect factory or business queries. Contracts can use existing LOC module exports when explicitly packaged, or bounded authenticated service calls; **no filesystem-relative imports across separate repos**. The existing `packages/` layout is not being moved as part of this migration. Auth/SSO continues using its existing PostgreSQL dialect on LAS without a second SQL Portable implementation.

## Binding contract to implement before activating MCP in LunArcus

1. LunArcus validates the caller's **real OAuth token** against the unchanged `auth.lo3rwang.cc/api/auth` issuer. A login alone never grants LOC business permissions.
2. LunArcus forwards only a bounded, authenticated operation to a fixed LOC service URL over a trusted server-side channel. **No generic SQL, arbitrary URL or user-selected database connections** are exposed.
3. LOC owns target database resolution, Scope access checks and policy. Queries/transactions use LOC's existing dialect and Z-Model contracts. LunArcus does not duplicate MySQL, MSSQL or SQL Portable adapters.
4. Preserve existing MCP tools, SSE streaming, idempotency receipts, resource metadata and Chrome OAuth callbacks before cutover.
5. Keep the existing production `mcp.lo3rwang.cc` route until a replacement has functional parity and real authentication/permission regression verification. No Cloudflare changes are authorized by this snapshot alone.

LAS MCP syntax, contract checks and Worker dry-run have passed. Production equivalence and domain cutover have **not** been performed.
