# LAS module ownership — colocated with app/las

The **canonical collision-resistant module identifiers** are `lo3r@loc`, `lo3r@lrs`, `lo3r@las`. The short forms `loc`, `lrs`, `las` remain convenient local aliases but are not globally unique. The `@` is part of the logical identifier, **not** a GitHub repository rename, DNS hostname, JavaScript variable name, or npm package name; if publishing npm modules later, the registry-compliant equivalent is `@lo3r/loc`, `@lo3r/lrs`, `@lo3r/las` and requires an explicit packaging decision. This document records **module ownership**, not a request to rename domains, OAuth identities, database Scopes, Git branches or packages. All modules can be deployed independently and integrated by explicit versioned interfaces.

| Module | Identity and product | Submodules |
|---|---|---|
| **lo3r@loc** (`loc`) = LunaCodex（月典／玄鑒） | Language of Codex; language codex SaaS and language appraisal framework | `loc:galaxy` (Z-Model Galaxy / Anchor), `loc:time`, `loc:locus`, `loc:site`, `loc:dialect` |
| **lo3r@lrs** (`lrs`) = LunaRunes（月符／符韻） | Symbolic Language Galaxy; runes and rune-language system | `lrs:rune` (shared foundation), `lrs:boardgame`, `lrs:card`, `lrs:daily` |
| **lo3r@las** (`las`) = LunArcus（虹月） | Luna Protocol cross-system integration | `las:auth`, `las:plugins` (Extension), `las:mcp`, `las:tunnel` (CMS/other-system mapping) |

For full module-qualified submodule names use `lo3r@loc:galaxy`, `lo3r@lrs:rune` and `lo3r@las:tunnel`. The existing `loc:galaxy`, `lrs:rune`, `las:tunnel` strings in code or documents are **shorthand labels**, not instructions to migrate deployed interfaces.

The person and brand aliases `Lucas Oscar Wang`, `lo3rwang`, `lo3r`, and `Lucipher Drucula Wang` / `lo3wang.cc` are identifiers in the owner's architecture proposal, **not live deployment hostnames by implication**.

## Fixed boundaries

- **LOC SaaS** owns Galaxy/Anchor business schemas, permissions, queries, import policy, physical databases and the existing SQL dialect implementation. LOC can extend PostgreSQL/MySQL/MSSQL drivers without pulling those into LAS.
- **LRS** owns original rune images, Effekseer and future game logic. Web consumes published links; iOS/Android native packaging requires actual local assets. The `lo3r@lrs` module identifier does not rename the established `lrunes` Scope or `lrunes.lo3rwang.cc`.
- **LAS (Luna Protocol)** owns auth/session/SSO integration, MCP protocols, extensions/plugins, and cross-system transport mappings. `las:tunnel` maps **transport and field contracts** between systems; it does not duplicate Galaxy's data model or execute client-selected SQL. Avoid a parallel SQL dialect stack.
- **LOC native packaging** owns the existing unsigned IPA build, RC/release and all App artifacts via `EsotericVerse/lunacodex/.github/workflows/ios-device-build.yml`. LAS does not own IPA/APK workflows; LRS supplies pinned, checksum-verified real files. This does not claim a signed or physically tested IPA.
- **ISR** is planned as a LAS Auth-administered optional service, not a mandatory Next.js dependency of authentication. Existing `loc-isr` runtime ownership is not yet migrated.

## Existing public identifiers (unchanged)

- `loc.lo3rwang.cc` = LOC SaaS
- `lrunes.lo3rwang.cc` = existing Rune/SaaS domain
- `auth.lo3rwang.cc` = OAuth/OIDC Issuer (unchanged); existing Cloudflare Worker script is **`lunarcus`**
- `mcp.lo3rwang.cc` = LAS MCP hostname (same production `lunarcus` Worker)
- `isr.lo3rwang.cc` = existing separate ISR Worker

The current repository layout keeps `app/las/index.mjs` as the single Worker entrypoint, `app/las/auth/` for authentication, `app/las/mcp/` for MCP transport, and `app/las/tunnel/` for fixed cross-system contracts. Cloudflare Workers Builds must watch these actual paths before merging a source move. The existing Auth Worker script was renamed separately from `auth` to `lunarcus` by the owner; do not recreate the old `auth` script or alter its `auth.lo3rwang.cc` custom domain, OAuth Client ID, Extension ID, Cloudflare secret bindings or existing Scopes as part of module naming. `packages/` currently remains in its original repository and **has not been transferred**.

## Implementation status

- `las:auth`: source deployed under `app/las/auth/`; the single `lunarcus` Worker serves Auth and MCP. SSO and Consent were verified after the owner rebuilt the Cloudflare Access SaaS application on 2026-11-17.
- `las:plugins`: LunArcus Chrome extension source moved to `plugins/chrome/`; simulated 9-visible/80-turn ChatGPT full history case passes. Native Chrome verification and production extension directory handover still required.
- `las:mcp` + `las:tunnel`: MCP protocol is under `app/las/mcp/` within the existing single Worker; fixed-operation LOC Data Mapping lives in `app/las/tunnel/loc-mapping.mjs`, with a compatibility re-export in MCP. The mapping cannot select SQL, DB targets, or untrusted service URLs. LAS owns `mcp.lo3rwang.cc`; MCP tools and authorization still require separate end-to-end acceptance.
- `loc:ipa`: the existing manual unsigned workflow and LRS checksum handoff were returned to LOC in PR #1733; LOC pins its own commit and LRS source SHA, assembles native files and packages the App. LAS has no App build trigger. Physical iOS testing and Android APK are not claimed.
- ISR: source migration blocked by missing original OpenNext source, runtime left intact.

Preserve the original LOC source until **real production** compatibility has been proved. Remove orphan copies only from the *LAS repo* after independent module tests; never delete the still-serving LOC source automatically.
