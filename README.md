# LunArcus — 虹月

LunArcus is the authentication and cross-system integration repository for the LOC ecosystem. It owns **Auth / SSO**, **Plugins** (including the Chrome Plugin), **MCP**, and **Tunnel**; LOC owns complete App/IPA packaging.

## Module identities and ownership

The unique, stable **logical module identifiers** are `lo3r@loc`, `lo3r@lrs`, and `lo3r@las`. The short names `loc`, `lrs`, and `las` remain local aliases; repository names, registered npm package names and existing hostnames are separate identifiers. This is a naming contract, not an instruction to rewrite public API identifiers.

| Module | Repository | Responsibility | Existing hostnames |
|---|---|---|---|
| `lo3r@loc` (loc) = LunaCodex | `EsotericVerse/lunacodex` | LOC SaaS, Galaxy data and Z-Model, business authorization, SQL Portable and database dialects (PostgreSQL / MySQL / MSSQL) | `loc.lo3rwang.cc` |
| `lo3r@lrs` (lrs) = LunaRunes | `EsotericVerse/lunarunes` | Rune assets, Effekseer/effects, rune UI and games | `lrunes.lo3rwang.cc` |
| `lo3r@las` (las) = LunArcus / Luna Protocol | `EsotericVerse/lunarcus` | Identity/SSO, Plugins, MCP protocol/gateway, **cross-module Data Mapping**; ISR planned under LAS Auth | `auth.lo3rwang.cc`, `mcp.lo3rwang.cc` |

`lo3r@lrs` replaces the previously suggested module label `lrune`; it does **not** rename the existing `lrunes` database Scope, `lrunes.lo3rwang.cc`, asset directories, OAuth client, or other public compatibility keys.

**Module contracts:** LAS owns cross-module transport and data mapping, not Galaxy business records or the actual LOC data schema; LOC keeps its existing SQL dialect implementation. LAS Auth uses the existing PostgreSQL runtime without bringing MySQL/MSSQL into this repo. Shared `packages` have **not** been migrated or reorganized, and no duplicate SQL adapter should be introduced to simulate sharing before a real package/service contract exists.

## Auth (LAS-owned deployment pipeline)

- Worker source: `services/workers/lunarcus/`
- Existing Cloudflare Worker script: **`lunarcus`** (owner-renamed from `auth`). Existing hostname/issuer **`auth.lo3rwang.cc`** remains unchanged. Do not recreate an `auth` Worker, create a second OIDC issuer or invalidate clients.
- Existing Cloudflare secret binding names beginning with `LOC_` remain **compatibility contracts**; rename the system LunArcus, not the live secret keys, OAuth scopes, extension ID, or existing user database.
- `npm ci --ignore-scripts` installs a deliberately smaller **PostgreSQL-only** Auth runtime; no Next.js, MySQL, MSSQL, rune renderer, or Sharp/asset pipeline.
- `npm run check:auth`; `npm run auth:dry-run`.
- Cloudflare **Workers Builds: lunarcus** is the connected GitHub build/deploy integration. The GitHub Actions `.github/workflows/deploy-lunarcus-auth.yml` validates scoped Auth changes (`main` or manual dispatch) and performs a dry-run **without publishing**; do not add a second Wrangler deployment job for the same Worker.
- Keep the existing `lunarcus` Worker, `auth.lo3rwang.cc` issuer and existing secret bindings. Actual production Build Watch Paths and main deployments must be checked in Cloudflare (the presence of a PR check alone does not prove production publish).
- No LAS GitHub Actions deployment secret is needed by this validation-only workflow. The manual LAS MCP workflow remains independently token-gated and cannot take over the MCP domain.
- Build/preview/deployment success does not prove browser SSO, OAuth exchange or session compatibility. These require separate HTTP/OIDC and browser acceptance.

## Plugins (las:plugins)

The Chrome Plugin is implemented as a browser extension in `plugins/chrome/`; **Plugins** is the LAS module name. Client-side Plugin changes alone do not rebuild LAS server Workers or LOC.


- Files: `plugins/chrome/`
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

## Adaptive deployment impact (LAS first, LOC only when needed)

- `scripts/plan-las-deployment.mjs` independently classifies **LAS Auth Worker**, **LAS MCP Server**, and **las:plugins** changes. `app/las/tunnel/` CMS Data Mapping belongs to LAS, not LOC; a mapping change can require LAS MCP rebundling, but does **not** rebuild LOC.
- `notify-loc-after-auth.yml` runs only after a successful Cloudflare `Workers Builds: lunarcus` check for the current LAS `main`, and uses the checked commit diff to classify whether LOC needs to rebuild. Published Auth/OAuth public contract changes can notify LOC; internal Auth implementation, Plugin, Data Mapping, routine package, documentation and Skills changes do not automatically notify it.
- An MCP Server change concerns the **LAS MCP** deployment, which remains manual and route-less until cutover. A changed MCP-to-LOC API boundary is flagged **review** rather than silently redeploying LOC.
- LOC impact is `notify`, `skip`, or `review`; automatic mode only sends the protected LOC Pages/main hook for `notify`. Manual `workflow_dispatch` provides `auto`, `notify`, or `skip` override. `review` means no automatic LOC release.
- `LOC_PAGES_DEPLOY_HOOK` is optional in LAS GitHub Actions Secrets; when unset, LOC can consume LAS's already-published service at the next normal LOC deployment. Never commit the hook URL, duplicate LOC's deploy pipeline or push an artificial LOC commit.
- Deployment classification is a conservative **path plus changed-code heuristic**, not a guarantee of application compatibility. Real OAuth/SSO and MCP tests remain separate.

## iOS IPA ownership

- The existing manual unsigned iOS IPA workflow was returned to LOC: [`EsotericVerse/lunacodex/.github/workflows/ios-device-build.yml`](https://github.com/EsotericVerse/lunacodex/blob/main/.github/workflows/ios-device-build.yml).
- LOC builds the whole App and pins the LRS source SHA. LRS supplies original Rune images/Effekseer/WASM as real, checksum-verified files; LOC Web stays URL-only for Rune assets.
- LAS no longer has an IPA workflow or an App artifact release path; its Auth, MCP, Tunnel and Plugins deployment remain independent.

## Local Windows checkout

The three sibling folders are `C:\GitHub\lunacodex`, `C:\GitHub\lunarunes`, `C:\GitHub\lunarcus`.
If `lunarcus` was cloned using sparse-checkout with only root files, the migrated directories will not appear until its sparse paths are expanded. Since this repository is small, after the approved branch merges, run `git -C C:\GitHub\lunarcus sparse-checkout disable` when you want all source files locally.

**Migration policy:** this IPA ownership change does not authorize deleting LOC source or changing Cloudflare binding/secret/domain settings; LAS Auth and MCP require their own acceptance.

## Formal module namespaces

The canonical namespace is `loc / lrs / las`, **not** `lrune`. LAS submodules are `las:auth`, `las:plugins` (including this Extension), `las:mcp`, and `las:tunnel` (cross-system/CMS data mapping). Ownership and implementation status are tracked in `docs/MODULE-ARCHITECTURE.md`.

## ISR (planned service ownership)

The existing `loc-isr` Worker at `isr.lo3rwang.cc` contains an OpenNext bundle but its original source is not in the current LOC Git tree. It remains untouched until source recovery and separate build verification. ISR is optional and off by default; it must never block `las:auth`. See `docs/ISR-HANDOFF.md`.
