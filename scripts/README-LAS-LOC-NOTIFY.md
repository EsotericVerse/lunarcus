# LAS → LOC production notification
The existing \`lunarcus\` Worker keeps the Cloudflare Secret \`LOC_WORKFLOW_KEY\`.
It is used **only after** a successful Cloudflare Workers production check for the
current LAS main and after a verified LOC-facing contract change. Its intended
value is a fine-grained GitHub credential authorized to create
\`repository_dispatch\` events in \`EsotericVerse/lunacodex\`. Neither the key
nor its contents appear in event payloads or GitHub CI logs.

GitHub Actions obtains a short-lived GitHub OIDC identity for
\`https://auth.lo3rwang.cc/_internal/loc-deploy\`; the Worker verifies the signed
OIDC token, repository ID, main commit SHA, exact workflow and audience before
using \`LOC_WORKFLOW_KEY\` to send \`loc-las-published\` to LOC. The LOC receiver
then checks the authenticated GitHub event sender and verifies LAS main SHA and
Cloudflare production check before requesting **LOC-owned** Cloudflare Pages
deployment. The receiver keeps one durable GitHub receipt per LAS Worker version
on a separate LOC branch and never edits LOC main.

No \`LOC_PAGES_DEPLOY_HOOK\` is used by LAS. LOC alone owns its optional Pages
hook Secret in its GitHub Actions environment. If \`LOC_WORKFLOW_KEY\` is not a
GitHub Dispatch-capable credential, the Worker explicitly fails rather than
creating a new token, changing Auth, touching RLS or falling back to Pages.
Nothing runs on ordinary Plugin, Docs or internal LAS commits.
