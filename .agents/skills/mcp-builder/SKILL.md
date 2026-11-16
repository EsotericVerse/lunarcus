---
name: mcp-builder
description: "LAS MCP server、工具、resources、prompts、Gateway 與跨系統協定工程主技能。"
---

# mcp-builder — LunArcus / LAS

主要責任 `las:mcp`；入口 `services/workers/las-mcp/index.mjs`、`app/las/mcp/router.mjs`、`app/las/mcp/tool-contracts.mjs`。LAS 只處理**協定、入口、連線、請求映射**，不複製 LOC Galaxy、SQL dialect、Scope 決策或 LRS Rune 引擎。

- 讀現有 MCP 工具清單、JSON-RPC、version negotiation、OAuth protected resource metadata、transport／SSE，再改一個明確的契約。
- 工具參數需 schema 驗證、限制大小與 QoS；授權由 LAS 驗證 caller token，LOC 才核對業務寫入授權；不轉接任意 SQL、網址或 DB 指令。
- HTTP / JSON 與 streaming 回應須對應 status、headers、錯誤型別及中斷；避免把 SSE 當無限制長連線。
- 優先 `npm run check:mcp` 和 `npm run mcp:dry-run`，必要時測真實 discovery／token／SSE；沒有實測不能報正式 Gateway 可用。
- 按需查 `mcp-transport`、`mcp-gateway`、`tunnel-data-mapping`、`protocol-security`。
- 最新規範：https://modelcontextprotocol.io/specification
