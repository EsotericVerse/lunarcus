# LAS

LAS is its own small protocol-oriented application framework. Its core is
[`las.mjs`](./las.mjs), not Wrangler, Better Auth, Hono or MCP.

- `createLAS({auth,mcp,previewMcpPaths})` selects a module by the canonical
  production hostname, or by explicit MCP paths under LAS workers.dev previews.
- `createLASRoutes(entries)` matches exact paths; protocol-specific method,
  authentication and payload validation stay inside the registered module.
- Each request has its own `request`, `env`, `execution`, `url`,
  `preview`, `module` and `onFinish(callback)`. A module registers only
  resources it actually opens. LAS releases them once the handler finishes,
  using Cloudflare `waitUntil` when available.
- `server/index.mjs` registers Auth and MCP. `server/auth/` retains Better
  Auth and its request-scoped PostgreSQL client over `LAS_HYPERDRIVE`;
  Auth remains fixed to PostgreSQL. `server/mcp/` retains JSON-RPC/SSE,
  resource verification, and the authenticated plugin import/status routes.
- `server/import/` stages ordered conversation uploads in R2, starts them
  through Queue and Workflows, runs the existing Container normalizer, and
  writes bounded, idempotent results to the configured Galaxy table. Failed
  jobs keep their status and staged payload; Chrome keeps its local Queue
  until LAS returns a verified completion receipt.
- `server/sql/` owns import-only SQL-type selection and connection setup.
  PostgreSQL uses the existing LAS Hyperdrive binding by default. MySQL and
  MSSQL use their own optional bindings/connection secrets; these do not
  change Auth's PostgreSQL connection.
- LOC owns the logical `LOCLucus` graph with the four fixed facets `culture / trace / statics / search`; LRS owns the independent `LRSLucus` graph with nine rune groups and 67 symbol nodes. LAS Adapter is transport and authorization only: it serves fixed, authorized reads and does not reinterpret, reorder, or mutate either graph, and it does not calculate LRS draw weights. These graph definitions remain owned by their respective repositories; no shared database schema or migration is introduced by the naming contract.
- The Chrome Extension remains an independent Manifest V3 client in
  `plugins/chrome/`. Small article captures retain the current LOC short
  import contract. Ordered conversation Queue uploads use the LAS background
  import route and are acknowledged only after the final receipt is checked.

The framework has **no runtime dependencies**. Wrangler bundles the existing
Worker and publishes it; there is no frontend hydration framework, new
database migration, parallel compatibility stack, or second deploy target.

Run `npm test` and `npm run build` before merging routing changes.
Tests cover actual Auth/MCP host dispatch, workers.dev preview isolation,
protocol metadata, lazy health responses and request cleanup. Cloudflare
deployment and real OAuth/MCP/Chrome execution still require their own checks.

LAS Auth PostgreSQL runs only through the Cloudflare `LAS_HYPERDRIVE` binding,
which points to the existing `las-postgres` Hyperdrive configuration.
The Worker must not fall back to `LAS_DATABASE_URL`; keep the old Secret
untouched until a deployed Worker binding, JWKS/Session OAuth operation and
Hyperdrive metrics have all been verified. Database SQL schema, OAuth
signing keys and LAS-owned public tables are unchanged.
