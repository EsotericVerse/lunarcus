---
name: cloudflare-workers
description: "LAS Auth Worker、MCP Worker、Workers Builds、Preview、路由、Bindings 和部署診斷。"
---

# cloudflare-workers — LAS 專用能力

正式 Auth Worker 是 `lunarcus`、root `wrangler.jsonc`、custom domain `auth.lo3rwang.cc`；MCP 另有 `services/workers/las-mcp/wrangler.jsonc` 且**手動發布**，不可接管 LOC 正在使用的 MCP 網域。

## 必查的部署層
1. GitHub source `EsotericVerse/lunarcus`、branch `main`、Workers Builds watch paths、Cloudflare Worker production deployment commit/version。
2. Worker bindings 的**名稱與型別**；不可顯示 Secret 值，也不把 Secret「存在」誤判為一定正確。
3. `wrangler deploy --dry-run` 只測建置；preview 通過只測隔離預覽，不保證正式 Session。
4. 保留目前的自動主線部署、合法 preview 和 user-owned token；沒有明確授權**不 PATCH** Cloudflare routes、secrets、Access 政策或 CI。
5. 純 Plugin/UI/文案更新不能理所當然觸發 Auth Worker；先查 Watch Paths 再決定是否需要提出設定變更。
6. Auth version metadata 參與 cookie-cache version；不必要的正式部署可能失效舊 Cookie Cache，須避免部署扇出。

參考：https://developers.cloudflare.com/workers/ci-cd/builds/ 、https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/ 、https://developers.cloudflare.com/workers/versions-and-deployments/ 。
