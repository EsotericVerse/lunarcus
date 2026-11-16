# LOC / LRS / LAS — three-module architecture

This document records **module ownership**, not a request to rename domains, OAuth identities, database Scopes, Git branches or packages. All modules can be deployed independently and integrated by explicit versioned interfaces.

| Module | Identity and product | Submodules |
|---|---|---|
| **loc** = LunaCodex（月典／玄鑒） | Language of Codex; language codex SaaS and language appraisal framework | `loc:galaxy` (Z-Model Galaxy / Anchor), `loc:time`, `loc:locus`, `loc:site`, `loc:dialect` |
| **lrs** = LunaRunes（月符／符韻） | Symbolic Language Galaxy; runes and rune-language system | `lrs:rune` (shared foundation), `lrs:boardgame`, `lrs:card`, `lrs:daily` |
| **las** = LunArcus（虹月） | Former Galaxy Link; Luna Protocol cross-system integration | `las:auth`, `las:plugins` (Extension), `las:mcp`, `las:tunnel` (CMS/other-system mapping), `las:ipa`, `las:apk` |

The person and brand aliases `Lucas Oscar Wang`, `lo3rwang`, `lo3r`, and `Lucipher Drucula Wang` / `lo3wang.cc` are identifiers in the owner's architecture proposal, **not live deployment hostnames by implication**.

## Fixed boundaries

- **LOC SaaS** owns Galaxy/Anchor business schemas, permissions, queries, import policy, physical databases and the existing SQL dialect implementation. LOC can extend PostgreSQL/MySQL/MSSQL drivers without pulling those into LAS.
- **LRS** owns original rune images, Effekseer and future game logic. Web consumes published links; iOS/Android native packaging requires actual local assets. The `lrs` module ID does not rename the established `lrunes` Scope or `lrunes.lo3rwang.cc`.
- **LAS (Luna Protocol)** owns auth/session/SSO integration, MCP protocols, extensions/plugins, and cross-system transport mappings. `las:tunnel` maps **transport and field contracts** between systems; it does not duplicate Galaxy's data model or execute client-selected SQL. Avoid a parallel SQL dialect stack.
- **LAS native packaging** owns the build orchestration: `las:ipa` preserves the existing unsigned iOS app workflow, while `las:apk` is a planned Android counterpart. Neither is described as a working, released mobile application solely because a workflow exists.
- **ISR** is planned as a LAS Auth-administered optional service, not a mandatory Next.js dependency of authentication. Existing `loc-isr` runtime ownership is not yet migrated.

## Existing public identifiers (unchanged)

- `loc.lo3rwang.cc` = LOC SaaS
- `lrunes.lo3rwang.cc` = existing Rune/SaaS domain
- `auth.lo3rwang.cc` = existing Cloudflare `auth` Worker, OAuth/OIDC Issuer
- `mcp.lo3rwang.cc` = existing MCP hostname (currently LOC Pages)
- `isr.lo3rwang.cc` = existing separate ISR Worker

Do not rename any host, Worker Script, OAuth Client ID, Extension ID, Cloudflare secret binding or existing Scope as part of module naming. `packages/` currently remains in its original repository and **has not been transferred**.

## Implementation status

- `las:auth`: source moved; isolated PostgreSQL install, syntax check and Wrangler dry-run pass. Existing production `auth` deployment is not cut over.
- `las:plugins`: Chrome Galaxy Link extension source moved; simulated 9-visible/80-turn ChatGPT full history case passes. Native Chrome verification and production extension directory handover still required.
- `las:mcp` + `las:tunnel`: active separated Worker and fixed LOC bridge source compile; full production OAuth/permission parity and Pages-domain cutover still required.
- `las:ipa`: manual workflow transferred and LOC commit pinned between jobs; physical IPA not yet built.
- `las:apk`: planned; no Android build pipeline or signing artifacts claimed.
- ISR: source migration blocked by missing original OpenNext source, runtime left intact.

Preserve the original LOC source until **real production** compatibility has been proved. Remove orphan copies only from the *LAS repo* after independent module tests; never delete the still-serving LOC source automatically.
