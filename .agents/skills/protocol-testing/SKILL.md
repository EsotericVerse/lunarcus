---
name: protocol-testing
description: "LAS Auth、MCP、Chrome、Tunnel、IPA 的 contract/integration/regression 測試與部署證據。"
---

# protocol-testing — LAS 專用能力

**分層驗收，不以測試數量取代失敗原因。**

| 層級 | LAS 入口 | 能證明 | 不能證明 |
|---|---|---|---|
| Syntax / Auth HTTP | `npm run check:auth` | 程式與模擬登入路徑 | 真實瀏覽器用 Google OAuth 完成登入 |
| Chrome | `npm run check:extension` | 模擬 UI/Queue/匯入契約 | 真實 Chrome callback |
| MCP | `npm run check:mcp` | HTTP/JSON/SSE 契約 | 正式 token/Provider/LOC 整合 |
| Cloudflare bundle | `npm run auth:dry-run`／`mcp:dry-run` | 可打包 Worker | 正式路由與真實 Session |
| IPA | `node --test scripts/test-ipa-workflow-metadata.mjs scripts/test-las-ipa-runes.mjs` | 固定 artifact/來源契約 | 裝置安裝運作 |

每次 PR 要有一項針對**原問題會失敗**的測試。合併後核 main SHA、實際 Worker 部署版本及必要的使用者路徑；不在無授權情況下動 Cloudflare、資料庫或其他 repo。
