---
name: security-audit
description: "LAS Auth、MCP、Extension、跨 CMS transport、Worker 與打包供應鏈安全檢查。"
---

# security-audit — LunArcus / LAS

先界定 LAS 邊界，不因掃到跨 Repo 引用而去改 LOC/LRS。

- 身分：OAuth redirect exact match、PKCE、state、issuer、audience、SSO callback、session／CSRF。
- MCP：token binding、Origin、HTTP method、SSE streaming、JSON-RPC schema、size/timeout、QoS、不得任意 URL/SQL 或跨 Scope。
- Extension：Manifest 權限、tab 擷取、Chrome identity callback、儲存的 Token／Queue、診斷遮罩。
- Worker：Secret 名稱/版本、敏感錯誤、CORS、非公開路由、外部連線與日誌。
- Native：IPA/APK 組件簽章、外部素材驗章、供應鏈與第三方授權。
- 現有 `check:auth`、`check:mcp`、`check:extension` 的測試應聚焦「拒絕不合法」案例；不要用失敗清空真資料。
