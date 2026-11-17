---
name: mcp-transport
description: "LAS MCP Streamable HTTP、SSE、JSON-RPC、protocol version 與連線相容的專題。"
---

# mcp-transport — LAS 專用能力

LAS 目前實作應先讀 `app/las/mcp/{stateless-transport,stream-json}.mjs` 和 `app/las/mcp/server.mjs`。不要因新版 MCP 規格直接刪既有客戶端需要的相容路徑。LAS 沒有上游 MCP provider relay；身分提供者只有 Cloudflare SSO（`auth.lo3rwang.cc`）。2026-11-17 已移除一套未接線、也未經授權新增的 `upstream/`（Clerk/GitHub/Neon/Supabase OAuth relay）子目錄，不要再重建同類程式。

- 解析 initialize negotiation、JSON-RPC 2.0 的 `id`、batch/error、Content-Type、Accept、HTTP status、Origin 與授權 header。
- Streamable HTTP 的回應可以是 JSON 或單次請求的 SSE stream；**不要**把 SSE 簡化成一般 JSON，也不要把持久化 Stream 與 Auth Session 混成一個。
- 特定 MCP 協定版本（如 2026-07-28 的 GET stream 變更）必須以 negotiated protocol／現行契約為準，不能破壞舊版客戶端。
- 超時、斷線、取消、重試與 backpressure 要測；不在 stream events 洩漏 tokens 或私人內容。
- 對應 `npm run check:mcp`，包含 JSON 和 SSE、正反授權測試與 Worker dry-run。

官方傳輸規格：https://modelcontextprotocol.io/specification 。歷史版本請依實際 client negotiated version 查閱。
