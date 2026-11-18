# LunArcus — 虹月

LAS is the protocol and identity integration repository of the `lo3r@loc` / `lo3r@lrs` / `lo3r@las` system. The existing `lunarcus` Cloudflare Worker serves `auth.lo3rwang.cc` and `mcp.lo3rwang.cc`; its single entrypoint is `app/las/index.mjs` (defined in root `wrangler.jsonc`).

Documentation follows ownership instead of a root `docs/` directory:

- **Architecture and repo boundaries:** `app/las/README.md`, `AGENTS.md`
- **Auth and database:** `app/las/auth/README.md` and `app/las/auth/`
- **MCP transport and authorization:** `app/las/mcp/README.md` and `app/las/mcp/`
- **Cross-system data mapping:** `app/las/tunnel/README.md` and `app/las/tunnel/`
- **Cloudflare build/deployment:** `.github/workflows/README.md` and the workflows / `scripts/plan-las-deployment.mjs`
- **Chrome Extension:** `plugins/chrome/README.md`
- **ISR planned-only ownership:** `.agents/skills/deployment/SKILL.md`
- **Historical handoffs (not current deployment authority):** private Slack engineering archive and Git Commit history

Run `npm run check:auth`, `npm run check:mcp`, or `npm run check:extension` for the relevant module; `npm run auth:dry-run` does not publish. LOC owns the complete App/IPA packaging workflow and Galaxy/SQL Portable business implementation; LRS owns rune assets and engine. Cloudflare external Watch Paths must be verified before merging the module-path refactor.
