---
name: mcp-builder
description: "LAS MCP Builder and tool contracts, transports, Zod validation and OAuth"
---

# mcp-builder

LAS 優先專業領域：`app/las/mcp/router.mjs`、`tool-contracts.mjs`、`stateless-transport.mjs`、`upstream-sse.mjs`，與 `services/workers/las-mcp/index.mjs`。定義 Tool 時逐一處理 `initialize`、`tools/list`、`tools/call`、JSON-RPC 錯誤、MCP 協定版本、輸入 Zod→JSON Schema、回覆型態、Streamable HTTP／SSE。

OAuth resource token 的 issuer/audience/scope 檢查與 role Grant 是不同層；工具實際資料操作再由業務 API 決定。無 Token 401、無 role 403、429 限速、503 後端故障不得被 200 JSON 包掉。不要為建 Tool 引入新的 SQL 權限或直接抓 LOC Galaxy。測試由 `npm run check:mcp` 起手，協定細節參考 https://modelcontextprotocol.io/specification/2025-11-25 。需要 Provider/Vault、SSE 細節再選 `mcp-gateway`。
