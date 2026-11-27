# LAS plugin import

The ordered-conversation endpoint is `POST /api/plugins/import/stream` on the
MCP host. It requires a valid LAS OAuth bearer with `loc:import`, a stable
upload ID, and bounded conversation/record counts.

The Worker streams the NDJSON body into the existing R2 staging bucket. Queue
messages contain only the job ID. A Queue consumer starts one Cloudflare
Workflow, which passes the staged stream through `PluginImportContainer`, then
compares and writes bounded, idempotent batches to Galaxy through the selected
LAS SQL driver. `GET /api/plugins/import/status` returns the owner-scoped job
state and final receipt.

The Chrome Extension retains every source row in IndexedDB until it validates
the completed receipt. A failed job records a bounded error code and retains
its staged payload; a manual retry gets a new job ID after the terminal error
is observed. Successful jobs remove their staged payload after the receipt is
recorded.

The import writer does not parse LOC keywords, create schema, modify Anchor
relationships, or take over LOC's small feature writes.
