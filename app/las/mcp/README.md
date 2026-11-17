# MCP move: dependency and trust boundary

**`lo3r@las` (LAS / LunArcus / Luna Protocol)** owns protocol transport, OIDC/OAuth integration, Chrome Extension, MCP Gateway and cross-module **Data Mapping**. **`lo3r@loc` (LOC / LunaCodex)** owns Galaxy records/models, business authorization, imports, SQL Portable CRUD and PostgreSQL/MySQL/MSSQL dialect adapters. **`lo3r@lrs` (LRS / LunaRunes)** owns rune assets and game/effects. These are module IDs, not renamed domains, database Scopes or OAuth client identifiers.

The LAS MCP source is owned by `app/las/mcp/`; `app/las/mcp/server.mjs` is a handler inside the single `lunarcus` Worker. `https://mcp.lo3rwang.cc/` is the primary MCP entrypoint, without an additional `/mcp` suffix. LOC business/data implementation remains in the LOC repository and is accessed through the fixed `/api/las-native` contract; it is not duplicated in LAS.

| Copied module | Cross-repository requirements remaining |
|---|---|
| `router.mjs` | Calls LOC-specific business actions, private Galaxy and article distribution |
| `native-operations.mjs` | Imports LOC providers, Scope policies, import pipelines, Z-Model and SQL-portable code |
| `galaxy-read.mjs` | Requires LOC Scope route index, portable search and ZenStack Galaxy model |
| `native-kysely.mjs` | Imports LOC connection profile and dialect factory; may be replaced only with existing Kysely's `PostgresDialect` for the dedicated **Gateway** connection |
| `tool-contracts.mjs` | Imports LOC Scope route index |
| `business-actions.mjs`, `private-galaxy.mjs`, `article-distribution.mjs` | LOC-side authorization and data semantics |
| `upstream/upstream-*.mjs`, `stateless-transport.mjs`, `stream-json.mjs` | LAS-owned transport and upstream-provider adapters; verify dependencies during any move |

## Data Mapping versus LOC data ownership

LAS mapping may normalize field names, transport envelopes, object/version references and validated source-to-target contracts across LOC and LRS. It must NOT own or duplicate LOC Galaxy's Z-Model, UID semantics, Scope grants, SQL dialect factory or business queries. Contracts can use existing LOC module exports when explicitly packaged, or bounded authenticated service calls; **no filesystem-relative imports across separate repos**. The existing `packages/` layout is not being moved as part of this migration. Auth/SSO continues using its existing PostgreSQL dialect on LAS without a second SQL Portable implementation.

## MCP boundary to maintain

1. LunArcus validates the caller's **real OAuth token** against the unchanged `auth.lo3rwang.cc/api/auth` issuer. A login alone never grants LOC business permissions.
2. LunArcus forwards only a bounded, authenticated operation to a fixed LOC service URL over a trusted server-side channel. **No generic SQL, arbitrary URL or user-selected database connections** are exposed.
3. LOC owns target database resolution, Scope access checks and policy. Queries/transactions use LOC's existing dialect and Z-Model contracts. LunArcus does not duplicate MySQL, MSSQL or SQL Portable adapters.
4. Preserve existing MCP tools, SSE streaming, idempotency receipts, resource metadata and Chrome OAuth callbacks; test each affected path before claiming production parity.
5. The current `mcp.lo3rwang.cc` production custom domain belongs to the existing `lunarcus` Worker. Do not recreate a standalone Worker or alter that domain when refactoring files.

LAS MCP code checks and Worker dry-run do not by themselves establish authenticated `initialize`, `tools/list` and `tools/call` acceptance on the public endpoint. The Cloudflare domain cutover has occurred; complete tool-level acceptance must be tracked separately.
