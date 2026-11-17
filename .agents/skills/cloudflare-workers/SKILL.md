---
name: cloudflare-workers
description: "LAS 既有單一 lunarcus Cloudflare Worker，Auth/MCP 雙網域、Workers Builds、Preview 與安全 Binding。"
---

# LAS Cloudflare Workers — 單一部署

**正式只有既有 `lunarcus` Worker。** Root `wrangler.jsonc` 同時宣告 `auth.lo3rwang.cc`、`mcp.lo3rwang.cc` 兩個 custom domains；`app/las/index.mjs` 按 hostname 分流，MCP handler 是同個 bundle 裡的 `mcp.mjs`。**不可重新建立獨立 `las-mcp` Worker 或讓 LOC Pages 重新接管 MCP 網域。**

1. 查 GitHub source／main SHA、Workers Builds 的 Production／Preview watch paths、最終部署 version、兩個 custom domains 所屬 Worker。Changes to `app/las/auth/**` 或 `app/las/mcp/**` 會影響同一 Worker；Plugins、Skills、純 CMS Mapping 不應因此觸發正式發布。
2. 查環境變數及 Bindings 的**名稱／類型**，不讀 Secret 值。既有的 `LOC_*` 兼容名稱有實際用途，不因搬遷而刪除或重新命名。
3. `npm run auth:dry-run` 和 `npm run mcp:dry-run` 都只是**同一 Worker** 的 dry-run；正式由 Workers Builds 對 `lunarcus` 執行，不另外從 LAS GitHub 使用 Cloudflare API Token 部署第二個 Worker。
4. 每次更新都要驗證 Auth health、MCP resource metadata、401 OAuth challenge 與分流隔離，再按需要驗 SSO callback、MCP SSE、LOC business API；部署成功不是功能驗收。
5. 現有 `loc-isr` 仍留原處並預設關閉，未完成原始碼、資源、Binding 的驗證前不得移除或裝入重型 OpenNext bundle 造成 Auth 被迫重建。
6. 修改 Cloudflare 外部設定、Build watch paths、Secret、網域或 Access 政策需精確說明變更與回復方案，取得本次授權；不要因工具可寫就任意 PATCH，也不要讓 LRS 的緊急流程連動。

Workers Builds 官方資料：https://developers.cloudflare.com/workers/ci-cd/builds/
