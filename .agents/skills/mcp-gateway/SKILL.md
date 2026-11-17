---
name: mcp-gateway
description: "LAS 既有 lunarcus Worker 上的 MCP OAuth Resource、Tools、QoS 與固定 LOC 業務轉送。"
---

# LAS MCP Gateway — 服務端唯一來源

`app/las/index.mjs` 在 `mcp.lo3rwang.cc` 路由進 `app/las/mcp/server.mjs`，再進 `app/las/mcp/router.mjs`。**Auth 與 MCP 是同一個 `lunarcus` Worker 的不同 hostname，沒有第二個 MCP Worker，也不回 LOC Pages 執行 Gateway。**

- LAS 擁有 tools/list／tools/call、metadata、JSON-RPC、Streamable HTTP／SSE 與限流；查清當前實際開放的 route，不能憑原始碼假定對外 API 已存在。
- Bearer Token 必須驗證 issuer、audience、有效期、Scope／subject；登入成功不自動得到 LOC 寫入權。LOC 以獨立 `api.manage`／Scope 政策做業務檢查。
- 維持固定 `/api/las-native` LOC 服務契約，不接受任意 SQL、內網 URL、DB connection、瀏覽器 cookie 或隱藏 service-token 代理。
- 限制 payload／QoS／timeout、維持安全 CORS、錯誤遮罩、SSE ID 與 UID 回執。Chrome extension 的 Provider 連接流程是直接打 LOC 的 `/api/mcp-provider-extension`，不經過這個 Worker；不要把它跟這份 MCP Gateway 混為一談。
- **對外連線他沒點名就不開。** LAS 只認一個身分提供者——LAS 自己的 Auth（`auth.lo3rwang.cc`，Google OAuth 登入、自簽 JWKS，不是 Cloudflare 的服務）；要幫別的 MCP server 代管 OAuth、token 或呼叫政策，不是「技術上做得到」就動手，是要他當場點名才算，先搭骨架以後再接一樣算越權。2026-11-17 就因為這樣移除過一套沒人要求、也沒接線的 `upstream/` relay，也移除了多繞一手的 Cloudflare Access SSO 登入路徑，不要重建同類程式。
- 測試：`npm run check:mcp`、`npm run check:auth`、`npm run auth:dry-run`，再核對已發布的 Worker version 與真實請求。部署通過不代表已通過 OAuth 或 LOC 權限驗收。
