---
name: oauth-oidc
description: "LAS OAuth2/OIDC 伺服器與 Chrome 公開客戶端；PKCE、metadata、redirect、token、issuer/audience。"
---

# oauth-oidc — LAS 專用能力

先畫出 LAS 的**兩個不同識別**：LAS 自己的 `lunarcus` OAuth public client；Chrome `manifest.key` 對應的 Chromium Extension ID。不能拿其中一個名稱修改另一個。（Cloudflare Access 上游 SSO Client 已於 2026-11-17 移除，不再是第三個識別——不要假設它還存在或重建它。）

## 實務檢查
- `public/plugins/chrome/oauth/client.json`、`config.json`、`plugins/chrome/oauth-config.json`、`extension-client.mjs` 和 `background.js` 必須一致。
- Chrome PKCE 採 authorization code + S256；驗證 `state`、固定 `redirect_uri`、metadata `issuer`、token endpoint 及 protected resource audience。
- public client `token_endpoint_auth_method=none`，不能在 Extension 中放 Client Secret。
- Bearer Token 不等於 LOC Scope 的實際資料寫入許可，不能因成功登入就 grant。
- 測真實 callback、token exchange、refresh／revoke、session 過期和錯誤回覆；失敗保留遮罩診斷而不洩露 code/secret。
- `mcp.lo3rwang.cc` 仍作現有 token resource URI，不代表 Extension Queue 必須走 MCP；短匯入是 LOC 原 API。

官方參考：https://www.rfc-editor.org/rfc/rfc7636 與 https://www.rfc-editor.org/rfc/rfc8414 ，Better Auth OAuth Provider https://www.better-auth.com/docs/plugins/oauth-provider 。
