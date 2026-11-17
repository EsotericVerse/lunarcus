# LAS tunnel — fixed cross-system mapping

`app/las/tunnel/loc-mapping.mjs` owns validated transport envelopes and source-to-target field mapping to LOC's fixed `https://loc.lo3rwang.cc/api/las-native` endpoint. LAS must not copy LOC Galaxy/Anchor Z-Model, Scope grants, SQL dialects or arbitrary database routing. Authenticated business access stays with LOC; LAS merely forwards bounded requests via the established service contract.

`app/las/mcp/loc-mapping.mjs` is a compatibility re-export for MCP. It must continue to forward to this module; never implement parallel business policy there. Code changes to this mapping alone should not require a LAS Worker build or force a LOC deploy. Refer to `AGENTS.md` for repo boundaries and `scripts/plan-las-deployment.mjs` for impact classification.
