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
  Auth and its request-scoped PostgreSQL connection; `server/mcp/` retains
  JSON-RPC/SSE and MCP resource verification; `server/tunnel/` sends fixed
  LOC API calls without copying LOC's business model.
- The Chrome Extension remains an independent Manifest V3 client in
  `plugins/chrome/`. Its existing LOC short and ordered import endpoints
  remain direct.

The framework has **no runtime dependencies**. Wrangler bundles the existing
Worker and publishes it; there is no frontend hydration framework, new
database migration, parallel compatibility stack, or second deploy target.

Run `npm test` and `npm run build` before merging routing changes.
Tests cover actual Auth/MCP host dispatch, workers.dev preview isolation,
protocol metadata, lazy health responses and request cleanup. Cloudflare
deployment and real OAuth/MCP/Chrome execution still require their own checks.
