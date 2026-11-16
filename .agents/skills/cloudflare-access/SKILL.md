---
name: cloudflare-access
description: "LAS Cloudflare Access SaaS SSO OIDC app policy and diagnostics"
---

# cloudflare-access

LAS 的 Cloudflare Access SaaS OIDC Client 與 Chrome Extension Public OAuth Client、OAuth Resource Server 是三個不同身分。對照 LAS `services/workers/lunarcus/auth.mjs`、Access SaaS `setup_complete`、OIDC discovery、allow policy、Identity Provider、Callback `https://auth.lo3rwang.cc/api/auth/sso/callback/cloudflare-access`，先找第一個失敗邊界。

Secret 的存在性、Discovery 200、token negative control 都不是互動式 SSO 成功證明；HTTP 302/400/403/500/503 要精確區分。一次性公開診斷要設退出條件，不回報 Secret 值、Code、State、Token。修改 Access policy、Secrets、Binding、Worker route 等外部設定前，需針對具體改動取得使用者批准。官方 https://developers.cloudflare.com/cloudflare-one/access-controls/ 。
