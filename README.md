# LunArcus — 虹月

LunArcus is the integration and packaging repository for the LOC ecosystem. Its responsibilities are **Auth / SSO**, **Chrome Extension**, **MCP gateway**, and orchestration of the **existing unsigned iOS IPA build**.

## Module identities and ownership

The stable **module IDs** are `loc`, `lrs`, and `las` (lowercase). Repository names and existing service hostnames are separate identifiers.

| Module | Repository | Responsibility | Existing hostnames |
|---|---|---|---|
| `loc` = LunaCodex | `EsotericVerse/lunacodex` | LOC SaaS, Galaxy data and Z-Model, business authorization, SQL Portable and database dialects (PostgreSQL / MySQL / MSSQL) | `loc.lo3rwang.cc` |
| `lrs` = LunaRunes | `EsotericVerse/lunarunes` | Rune assets, Effekseer/effects, rune UI and games | `lrunes.lo3rwang.cc` |
| `las` = LunArcus / Luna Protocol | `EsotericVerse/lunarcus` | Identity/SSO, Extension, MCP protocol/gateway, **cross-module Data Mapping**, IPA orchestration; ISR planned under LAS Auth | `auth.lo3rwang.cc`, `mcp.lo3rwang.cc` |

`lrs` replaces the previously suggested module label `lrune`; it does **not** rename the existing `lrunes` database Scope, `lrunes.lo3rwang.cc`, asset directories, OAuth client, or other public compatibility keys.

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

## MCP gateway (source staged; NOT yet a standalone live deployment)

- Existing source copied to `app/loc/mcp/` for a lossless handover.
- The old router/native operations have LOC business-service imports (queries, Scope authorization, Z-Model and portable SQL). A copied folder alone is **not** a working independent gateway.
- Keep the production `mcp.lo3rwang.cc` service on its existing route while moving pure gateway/identity/protocol components to LunArcus. LOC's business queries and portable SQL dialects remain in `lunacodex` behind verified, bounded server-side interfaces.
- See `docs/MCP-BOUNDARY.md` for outstanding dependencies. Do not deploy or expose a new MCP endpoint from these staged files.

## iOS IPA ownership

- `.github/workflows/ios-device-build.yml` is a manual **LunArcus-owned orchestration** of the EXISTING LOC Capacitor/iOS build. It checks out `EsotericVerse/lunacodex` to `loc-source` and uses the current verified native steps.
- An iOS App still packages its original required files, including rune images; the Web-only remote-asset strategy must not be applied to the native IPA.
- Artifacts are produced by LunArcus Actions. No build/deploy is triggered by a LOC Web push. Current source integration from `lunarunes` is pending the other agent's migration.
- Do not launch parallel old/new IPA jobs during handover. No releases are published unless explicitly requested and compatible tags exist.

## Local Windows checkout

The three sibling folders are `C:\GitHub\lunacodex`, `C:\GitHub\lunarunes`, `C:\GitHub\lunarcus`.
If `lunarcus` was cloned using sparse-checkout with only root files, the migrated directories will not appear until its sparse paths are expanded. Since this repository is small, after the approved branch merges, run `git -C C:\GitHub\lunarcus sparse-checkout disable` when you want all source files locally.

**Migration policy:** no source deletion from `lunacodex` or Cloudflare binding/secret/domain changes before full Auth+MCP+IPA acceptance.
