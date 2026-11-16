# LunArcus · 虹月

**Luna Protocol integration**: identity/SSO/OIDC, MCP Gateway, Chrome extension and native IPA packaging.

The existing Cloudflare Worker identity is `auth` at `auth.lo3rwang.cc`. Moving the code does not rename its issuer, routes, secrets or production Worker.

## Auth (staged source)

`npx wrangler@4.157.0 deploy --config services/workers/loc-authority/wrangler.jsonc --dry-run`

**Do not deploy** until independent auth smoke tests pass and the former repo's deployment is retired.

## Cross-repo ownership

- LunaCodex: LOC Web + canonical routing.
- LunaRunes: Rune game/art/source assets.
- LunArcus: Auth / MCP / Extension / on-demand native package assembly.

**Migration status:** source extraction staging, not production cutover.
