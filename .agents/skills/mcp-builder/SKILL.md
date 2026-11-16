---
name: mcp-builder
description: "LAS 所有 MCP Server／Gateway／Provider 協定的唯一實作來源，與既有 lunarcus Auth Worker 同版部署。"
---

# LAS MCP Builder — 唯一協定入口

MCP 協定、受保護資源 metadata、JSON-RPC tools、Streamable HTTP／SSE、OAuth bearer 驗證、上游 Provider OAuth／Policy／Vault／Tools 及 Plugins 的對接都在 `EsotericVerse/lunarcus` 維護。**不再把這套程式複製進 LOC**。

## 真正的 Worker 結構
- 唯一正式 Worker：`lunarcus`，root `wrangler.jsonc`，同時接管 `auth.lo3rwang.cc` 與 `mcp.lo3rwang.cc`。
- 單一 Worker 入口 `services/workers/lunarcus/index.mjs` 按 hostname 分流；MCP 處理檔 `services/workers/lunarcus/mcp.mjs` 是**內部模組**而非第二個 Worker。
- MCP 工具、權限協定與模型：`app/las/mcp/`；跨系統資料欄位映射：`app/las/tunnel/`。不要另建 `las-mcp` Worker 或重啟已淘汰的獨立 Wrangler deployment。

## 開發與驗收
1. 按目前上線版本驗證 initialize／tools/list／tools/call、OAuth protected-resource discovery、issuer、audience、PKCE、CORS、SSE／JSON、錯誤回應與取消／重試。
2. LAS 驗證受保護資源身份，**LOC** 才決定 Galaxy／Scope／`api.manage`／SQL Portable 業務權限；只向固定 `https://loc.lo3rwang.cc/api/las-native` 發出允許的操作，拒絕 caller-supplied SQL、任意 URL／DB profile 與 Cookie 轉送。
3. 上游 Provider OAuth／Policy／Vault 的 source 也只保留 LAS 一份；曾在 LOC Pages 的 Provider 管理控制面已退役。重開其對外 API 前必須逐項驗證 LAS 實際路由、認證與存儲 Binding，**原始碼存在不等於功能已上線**。
4. `npm run check:mcp`、`npm run check:auth`、`npm run auth:dry-run`；實際 Cloudflare deployment、公開 Auth/MCP 端點及登入／授權／資料回執另外驗證。

細分問題時再讀 `mcp-gateway`、`mcp-transport`、`protocol-security` 或 `tunnel-data-mapping`，不要一次載入全部。官方規格：https://modelcontextprotocol.io/specification
