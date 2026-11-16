# ISR handoff — LAS ownership plan, existing runtime untouched

The owner designated ISR as a **planned LAS/Auth responsibility**, not as a required LOC SaaS runtime dependency. It remains **off by default** for LOC. No login, session issuance or SaaS publishing operation may require ISR to be reachable.

Cloudflare **read-only audit** on 2026-11-16:
- Existing Worker script: `loc-isr`.
- Existing hostname: `isr.lo3rwang.cc` (keep the address).
- Compatibility date `2026-10-24` with `nodejs_compat`.
- Bindings include `ASSETS` and `WORKER_SELF_REFERENCE`.
- Its currently deployed script is a large compiled OpenNext/Next.js artifact; the original source was **not present in the current LOC Git tree**. Recovering readable authoritative source from the minified deployment is not a valid migration.

To finish later: locate the trusted original ISR source, copy it under LAS service ownership without changing the live deployment, validate a genuinely optional/default-disabled separate build and auth isolation, then switch **deployment responsibility only** with a tested rollback. Never embed the heavy ISR bundle inside the `auth` Worker. Do not recreate assets, credentials or domains speculatively.
