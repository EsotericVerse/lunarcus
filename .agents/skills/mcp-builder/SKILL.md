---
name: mcp-builder
description: "LAS 所有 MCP Server／Gateway 協定的唯一實作來源，與既有 lunarcus Auth Worker 同版部署。"
---

# LAS MCP Builder — 唯一協定入口

MCP 協定、受保護資源 metadata、JSON-RPC tools、Streamable HTTP／SSE、OAuth bearer 驗證及 Plugins 的對接都在 `EsotericVerse/lunarcus` 維護。**不再把這套程式複製進 LOC**。

## 真正的 Worker 結構
- 唯一正式 Worker：`lunarcus`，root `wrangler.jsonc`，同時接管 `auth.lo3rwang.cc` 與 `mcp.lo3rwang.cc`。
- 單一 Worker 入口 `app/las/index.mjs` 按 hostname 分流；MCP 處理檔 `app/las/mcp/server.mjs` 是**內部模組**而非第二個 Worker。
- MCP 工具、權限協定與模型：`app/las/mcp/`；跨系統資料欄位映射：`app/las/tunnel/`。不要另建 `las-mcp` Worker 或重啟已淘汰的獨立 Wrangler deployment。

## 開發與驗收
1. 按目前上線版本驗證 initialize／tools/list／tools/call、OAuth protected-resource discovery、issuer、audience、PKCE、CORS、SSE／JSON、錯誤回應與取消／重試。
2. LAS 驗證受保護資源身份，**LOC** 才決定 Galaxy／Scope／`api.manage`／SQL Portable 業務權限；只向固定 `https://loc.lo3rwang.cc/api/las-native` 發出允許的操作，拒絕 caller-supplied SQL、任意 URL／DB profile 與 Cookie 轉送。
3. **對外連線他沒點名就不開。** LAS 只認一個身分提供者——Cloudflare SSO；代管別的 MCP server 的 OAuth、token 或呼叫政策不在範圍內，先搭骨架以後再接一樣算越權。Chrome extension 既有的 Provider 連接流程是直接打 LOC，不經過這個 Worker。2026-11-17 已移除一套沒人要求、也沒接線的 `upstream/` relay；**原始碼存在不等於功能已上線**，不要重建同類程式。
4. `npm run check:mcp`、`npm run check:auth`、`npm run auth:dry-run`；實際 Cloudflare deployment、公開 Auth/MCP 端點及登入／授權／資料回執另外驗證。

細分問題時再讀 `mcp-gateway`、`mcp-transport`、`protocol-security` 或 `tunnel-data-mapping`，不要一次載入全部。官方規格：https://modelcontextprotocol.io/specification
