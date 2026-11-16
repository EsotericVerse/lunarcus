---
name: mcp-gateway
description: "LAS MCP Gateway and protocol/tool builder, OAuth, JSON-RPC, Streamable HTTP and SSE"
---

# mcp-gateway

以 `app/las/mcp/router.mjs`、`app/las/mcp/tool-contracts.mjs`、`app/las/mcp/stateless-transport.mjs` 和 `services/workers/las-mcp/index.mjs` 為實際契約。新的 MCP Tool 必須同步完成工具定義、Zod 輸入、`tools/list` 廣告、`tools/call` dispatch、所需 OAuth Scope 和獨立的 Role Grant。

驗收：`initialize`、`ping`、`tools/list`、`tools/call`、未知工具、畸形 JSON、過大輸入、通知、不支援版本、`application/json` 或 `text/event-stream`、取消、timeout；無 Token→401、有 Token 無角色→403、Rate Limit→429、上游失敗→503。不能把 OAuth 登入當作 grant。

現有 Provider 相關 `upstream-*.mjs` 掌握上游 OAuth consent／token refresh；不得外洩至 log。先執行 `npm run check:mcp` 與 `npm run mcp:dry-run`，正式環境須另測。參考 https://modelcontextprotocol.io/specification/2025-11-25 。
