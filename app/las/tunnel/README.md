# LAS tunnel — fixed cross-system mapping

`app/las/tunnel/loc-mapping.mjs` owns validated transport envelopes and source-to-target field mapping to LOC's fixed `https://loc.lo3rwang.cc/api/las-native` endpoint. LAS must not copy LOC Galaxy/Anchor Z-Model, Scope grants, SQL dialects or arbitrary database routing. Authenticated business access stays with LOC; LAS forwards bounded requests under the established service contract.

`app/las/mcp/loc-mapping.mjs` is a compatibility re-export. It must keep forwarding to this module; do not implement parallel business policy there.

**Deployment boundary:** this is imported by the MCP runtime. Although the existing deployment impact classifier treats `app/las/tunnel/**` changes as non-triggering for LAS/LOC notifications, a change that affects MCP-executed code needs a deployed Worker version to become live. Do not confuse “do not rebuild LOC” with “no LAS release needed”; verify the actual Cloudflare Watch Paths before relying on changed mapping behavior.

See `AGENTS.md` for ownership rules and `scripts/plan-las-deployment.mjs` for the current classifier implementation.
