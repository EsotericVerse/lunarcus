---
name: deployment
description: "LAS GitHub Actions、Cloudflare Workers Builds、Preview、正式部署與最小觸發範圍。"
---

# deployment — LunArcus / LAS

LAS 根目錄 `wrangler.jsonc` 的 `lunarcus` Worker 是 Auth，網域 `auth.lo3rwang.cc`。LAS MCP 使用 `services/workers/las-mcp/wrangler.jsonc`，**僅手動發布且不接管 `mcp.lo3rwang.cc`**。Extension ZIP 由 `.github/workflows/package-extension.yml` 獨立處理；IPA 是另一個手動工作流。

- 先查 Worker Builds 的 Git repo、branch、watch paths、正式 deployment SHA、preview 與 Secret **名稱**；勿推論設定缺失。
- `npm run auth:dry-run`、`npm run mcp:dry-run` 是建置測試，不發布。
- Cloudflare 外部設定、路由、密鑰或建置觸發的變更，必須先列明差異、影響、復原方式再徵得使用者同意。
- 不為 `plugins/chrome` 純介面、文案、Skill 文件的變更新增 Auth 部署；既有 Workers Builds 規則未授權不得自行 PATCH。
- 見 `cloudflare-workers`、`protocol-testing`；不要把 Preview 綠燈當成正式 SSO 可用。
