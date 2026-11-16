# LAS MCP deployment and existing domain

The existing `mcp.lo3rwang.cc` hostname is attached to **LOC Cloudflare Pages** today; its record is NOT a Worker Custom Domain. LAS must **not** attempt to bind an additional Worker to that same hostname while Pages owns it.

## Build status

- Independent LAS protocol Worker: `services/workers/las-mcp/index.mjs`.
- Worker name: `las-mcp`, deliberately `workers_dev=false` and `routes=[]` for safe staging.
- Commands: `npm run check:mcp` and `npm run mcp:dry-run` (no deployment).
- `.github/workflows/deploy-las-mcp.yml` is manual only. It publishes only a **route-less Worker**, not a live MCP cutover.
- `loc` exposes `/api/las-native` with fixed, OAuth-verified operations. Current `mcp.lo3rwang.cc/api/loc-native` remains available until the future switchover.

## LAS Data Mapping

MCP input/output schemas and wire envelopes live in `app/las/mcp/loc-mapping.mjs`. The fixed LOC service URL is `https://loc.lo3rwang.cc/api/las-native`. LAS never opens the LOC SaaS business database or constructs SQL. The existing Kysely/ZenStack Z-Model and Postgres/MySQL/MSSQL factories remain in `loc`; standalone LAS Auth has its own existing PostgreSQL pool and official `PostgresDialect`.

## Production cutover prerequisites

1. LOC's `/api/las-native` is deployed and tested for unauthenticated rejection, valid OAuth identity binding, active LOC api.manage role enforcement, per-Scope read/record permissions, public read, statistics, append and native import.
2. The route-less LAS Worker has been deployed and smoke-tested under a safe preview channel or Worker Preview against the LOC API, including Extension client `hiaeafonocnjaclcfgjmdopbcgnafnna`, Queue receipts and OAuth callback.
3. The current LOC Pages-owned `mcp.lo3rwang.cc` binding is detached **only when LAS Worker cutover is immediately ready**; attach the existing hostname to the LAS Worker without modifying its DNS name, then validate and retain rollback to LOC Pages.
4. No change to `auth.lo3rwang.cc`, OIDC issuer or Auth secrets. All production routing modifications require verifying existing Cloudflare bindings and CLI authorization. Never infer that a dry-run equals live permission parity.

MCP source duplicated in `app/loc/mcp` is an inactive migration snapshot; active LAS runtime is `app/las/mcp`. Remove the archived snapshot only after live cutover and dependency checks.
