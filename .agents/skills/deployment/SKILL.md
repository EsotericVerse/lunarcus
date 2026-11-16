---
name: deployment
description: "LAS GitHub Actions Cloudflare Workers Builds Preview and channel release controls"
---

# deployment

先確認實際 `wrangler.jsonc`、`.github/workflows/` 及 Cloudflare Dashboard 的 Git Watch Paths。既有 `lunarcus` Auth Worker 綁定 `auth.lo3rwang.cc`，`las-mcp` 按現有流程手動發布，Chrome Extension 由 Actions 封裝，IPA 手動協調；不要讓一次 commit 連鎖發布所有服務。

執行聚焦語法／契約／dry-run 並比對 main SHA、實際 Worker Version、Cloudflare Build log／HTTP 行為。合併成功不是功能成功；避免為註解和 Skills 重新發動昂貴並無關的部署。變數、Binding、路由、Secret、Workers、Access policy 等外部改動需事先取得對象明確的同意。
