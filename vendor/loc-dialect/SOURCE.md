# loc:dialect — LAS pinned module-only source

- **Canonical owner:** `EsotericVerse/lunacodex`, `modules/loc/dialect/`.
- **Source:** [LOC PR #1732](https://github.com/EsotericVerse/lunacodex/pull/1732), commit `0f6ce0af4255a5ef5122fec0419933f54fecf8ca`.
- **Source blob SHA:** `65259840058c0ef2e251f7ca59731950263f1135`.
- **Identity:** `@lo3r/loc-dialect`, currently private, not an npm publication.

Only the module's `index.mjs` and `package.json` are carried into LAS as a pinned, independently buildable snapshot. The LAS checkout never clones or bundles the LOC application at Auth build time. Upgrades require an explicit source/version review and independent CI.

LAS Auth uses `createKyselyDialect('postgres',{pool})` and `requestScopedPool`; its `LAS_DATABASE_URL`, SSL verification, ZenStack mapping, access grants, session handling and RLS remain LAS-owned. This is a SQL adapter contract **not a database authorization grant**.

Do not install LRS effects, rendering engine, LOC Galaxy business models or unneeded MySQL/MSSQL drivers in LAS. `dialect('pg',trustedUrl)` is available for server-side integrations that actually need a Kysely client and must call `db.destroy()`.
