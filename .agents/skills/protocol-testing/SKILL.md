---
name: protocol-testing
description: "LAS 通訊協定的 contract/integration/regression 測試，包含 Auth/OAuth、MCP、Chrome 與 Tunnel 端點。"
---

# protocol-testing — LAS 專用能力

**分層驗收，不以測試數量取代失敗原因。**

| 層級 | LAS 入口 | 能證明 | 不能證明 |
|---|---|---|---|
| Syntax / Auth HTTP | `npm run check:auth` | 程式與模擬登入路徑 | 真實瀏覽器用 Google OAuth 完成登入 |
| Chrome | `npm run check:extension` | 模擬 UI/Queue/匯入契約 | 真實 Chrome callback |
| MCP | `npm run check:mcp` | HTTP/JSON/SSE 契約 | 正式 token/Provider/LOC 整合 |
| Cloudflare bundle | `npm run auth:dry-run`／`mcp:dry-run` | 可打包 Worker | 正式路由與真實 Session |

修正可重現的 Protocol／傳輸故障時，使用能對照原失敗請求的聚焦回歸測試；純文字／工作指引修正則核對原意、範圍與相反解讀，不假造 HTTP 故障測試。合併後依變更內容核對 main SHA、實際 Worker 版本及必要客戶端路徑；不以測試數量代替通訊是否恢復。
