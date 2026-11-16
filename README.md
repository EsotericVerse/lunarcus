# LunArcus — 虹月

LunArcus is the integration and packaging repository for the LOC ecosystem. Its responsibilities are **Auth / SSO**, **Chrome Extension**, **MCP gateway**, and orchestration of the **existing unsigned iOS IPA build**.

## Module identities and ownership

The unique, stable **logical module identifiers** are `lo3r@loc`, `lo3r@lrs`, and `lo3r@las`. The short names `loc`, `lrs`, and `las` remain local aliases; repository names, registered npm package names and existing hostnames are separate identifiers. This is a naming contract, not an instruction to rewrite public API identifiers.

| Module | Repository | Responsibility | Existing hostnames |
|---|---|---|---|
| `lo3r@loc` (loc) = LunaCodex | `EsotericVerse/lunacodex` | LOC SaaS, Galaxy data and Z-Model, business authorization, SQL Portable and database dialects (PostgreSQL / MySQL / MSSQL) | `loc.lo3rwang.cc` |
| `lo3r@lrs` (lrs) = LunaRunes | `EsotericVerse/lunarunes` | Rune assets, Effekseer/effects, rune UI and games | `lrunes.lo3rwang.cc` |
| `lo3r@las` (las) = LunArcus / Luna Protocol | `EsotericVerse/lunarcus` | Identity/SSO, Extension, MCP protocol/gateway, **cross-module Data Mapping**, IPA orchestration; ISR planned under LAS Auth | `auth.lo3rwang.cc`, `mcp.lo3rwang.cc` |

`lo3r@lrs` replaces the previously suggested module label `lrune`; it does **not** rename the existing `lrunes` database Scope, `lrunes.lo3rwang.cc`, asset directories, OAuth client, or other public compatibility keys.

**Module contracts:** LAS owns cross-module transport and data mapping, not Galaxy business records or the actual LOC data schema; LOC keeps its existing SQL dialect implementation. LAS Auth uses the existing PostgreSQL runtime without bringing MySQL/MSSQL into this repo. Shared `packages` have **not** been migrated or reorganized, and no duplicate SQL adapter should be introduced to simulate sharing before a real package/service contract exists.

## Auth (source staged; deployment not cut over)

- Worker source: `services/workers/lunarcus/`
- Existing Cloudflare Worker script: **`auth`**. Existing hostname/issuer **`auth.lo3rwang.cc`** stay unchanged. Do not create a second OIDC issuer or invalidate clients.
- Existing Cloudflare secret binding names beginning with `LOC_` remain **compatibility contracts**; rename the system LunArcus, not the live secret keys, OAuth scopes, extension ID, or existing user database.
- `npm ci --ignore-scripts` installs a deliberately smaller **PostgreSQL-only** Auth runtime; no Next.js, MySQL, MSSQL, rune renderer, or Sharp/asset pipeline.
- `npm run check:auth`; `npm run auth:dry-run`.
- `.github/workflows/deploy-lunarcus-auth.yml` is **manual**. Before using it, configure the new repository's `CLOUDFLARE_API_TOKEN` Actions secret with only required permissions. A token in the old repository is not transferred automatically.
- Do not trigger this workflow until its dry-run succeeds and the live Worker bindings are compared to the expected configuration. Existing Worker and old deployment remain intact until handover.

## Chrome Extension

- Files: `extensions/lunarcus-galaxy-link/`
- Original `manifest.key`, OAuth `client_id` and Chromium redirect URI are retained to preserve the Extension identity and local Queue continuity.
- The original binary icon and Hero are retained by Git blob SHA. Third-party attribution/license files remain alongside the vendored scripts.
- The Chrome profile will still point at the old unpacked folder until it is deliberately switched after validation. **Do not clear storage or reinstall a second copy while the original is in use.**

## MCP Gateway (built independently; production routing unchanged)

- Active LAS protocol lives in `app/las/mcp/` and `services/workers/las-mcp/`.
- The fixed mapping in `app/las/mcp/loc-mapping.mjs` calls LOC's OAuth-verified business endpoint. LOC owns Galaxy, Z-Model, Scope permissions and SQL dialects.
- LAS builds independently with `npm run check:mcp` and `npm run mcp:dry-run` without MySQL, MSSQL or LOC business packages.
- The duplicate original MCP source snapshot has been removed from LAS. It is still safely retained in `lunacodex`.
- `mcp.lo3rwang.cc` remains on LOC Cloudflare Pages until live end-to-end cutover, not merely Wrangler dry-run.
- See `docs/MCP-BOUNDARY.md` and `docs/MCP-DEPLOYMENT.md`.

## iOS IPA ownership

- `.github/workflows/ios-device-build.yml` is a manual **LunArcus-owned orchestration** of the EXISTING LOC Capacitor/iOS build. It checks out `EsotericVerse/lunacodex` to `loc-source` and uses the current verified native steps.
- An iOS App still packages its original required files, including rune images; the Web-only remote-asset strategy must not be applied to the native IPA.
- Artifacts are produced by LunArcus Actions. No build/deploy is triggered by a LOC Web push. Current LRS asset integration remains dependent on the separate rune project's verified output.
- Do not launch parallel old/new IPA jobs during handover. Release attachment is optional and only targets an already-existing LAS release; an unsigned Actions artifact is the default.

## Local Windows checkout

The three sibling folders are `C:\GitHub\lunacodex`, `C:\GitHub\lunarunes`, `C:\GitHub\lunarcus`.
If `lunarcus` was cloned using sparse-checkout with only root files, the migrated directories will not appear until its sparse paths are expanded. Since this repository is small, after the approved branch merges, run `git -C C:\GitHub\lunarcus sparse-checkout disable` when you want all source files locally.

**Migration policy:** no source deletion from `lunacodex` or Cloudflare binding/secret/domain changes before full Auth+MCP+IPA acceptance.

## Formal module namespaces

The canonical namespace is `loc / lrs / las`, **not** `lrune`. LAS submodules are `las:auth`, `las:plugins` (including this Extension), `las:mcp`, `las:tunnel` (cross-system/CMS data mapping), `las:ipa`, and `las:apk` (planned). Ownership and implementation status are tracked in `docs/MODULE-ARCHITECTURE.md`.

## ISR (planned service ownership)

The existing `loc-isr` Worker at `isr.lo3rwang.cc` contains an OpenNext bundle but its original source is not in the current LOC Git tree. It remains untouched until source recovery and separate build verification. ISR is optional and off by default; it must never block `las:auth`. See `docs/ISR-HANDOFF.md`.
