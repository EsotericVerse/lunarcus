---
name: auth
description: "LAS OAuth, SSO, Access, Better Auth, Sessions and permission boundaries"
---

# auth

工作入口 `services/workers/lunarcus/auth.mjs`、`index.mjs`、`extension-client.mjs`。區分四層：Cloudflare Access 驗證／OIDC Provider → Better Auth Callback／Session → LAS 的 OAuth Provider → LOC/MCP 的業務授權。公開 Client ID、Cloudflare SSO Client ID 與 Chrome Extension ID 各不相同。

需要排錯時追蹤第一個異常的 HTTP 請求／回應，不因環境變數 present 就斷言成功。執行 `npm run check:auth`、對應測試，必要時驗證公開 Discovery 與安全的 Cloudflare 日誌；真實 SSO 回呼未驗證就標示未完成。不得自行改 Access policy、Secret、RLS 或 Grant。專題時再讀 `cloudflare-access`。
