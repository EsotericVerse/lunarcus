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
## Lucus Architecture and LunArcus Protocol

**Lucus = Lucas + Locus = Lucus** is the author's special Latin concept for a "light-based spacetime anchor", imagined as the sacred grove atop the Universe Tree. Lucus is the semantic/structural architecture; **LunArcus Protocol** is the connection and transformation protocol. They are related but not interchangeable: the protocol connects Lucus-structured elements; it does not define the meaning of those elements.

The future conceptual chain is **Galaxy -> Universe -> Universe Tree**. Lucus sits on the Universe Tree as its sacred grove, using fine-grained, particle-level spacetime anchor elements to establish relations and transformations. This is future design, not a claim that the Universe Tree, particle engine, or complete cross-system protocol is implemented today.

Fixed project-specific Lucus relations:
- LOC: `LOCLucus` has four facets — Culture / `TLucus` (time: Era > Period > Date), Trace / `LLucus` (space: Trace > Path > Point), Statics / `KLucus` (keyword: Category > Class > Group > Item > Pattern), and Search / `SLucus` (source/site: Universe > Galaxy > Domain > From).
- LRS: `LRSLucus` relates nine rune groups to 67 symbol nodes. Groups 1–8 contain eight runes each; group 9 contains `[0,65,66]`. Symbol 0 (德) belongs to the relation but is not drawable; 1–66 are drawable.

These are distinct LOC/LRS domain graphs over the shared Lucus architecture, not duplicate datasets. The LunArcus Protocol is the future inter-system connection/transform contract. Its particle-level payload, identity exchange, relation traversal and transformation semantics remain to be specified; do not invent wire formats, endpoints, tables or migrations. Current LAS fixed-operation adapters continue to enforce authorization and data access, but must not be described as a completed Lucus particle protocol.
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
