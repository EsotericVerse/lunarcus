---
name: better-auth
description: "LAS Better Auth 1.7.18、OAuth Provider、SSO Plugin、ZenStack/PostgreSQL Session 的專門整合。"
---

# better-auth — LAS 專用能力

先確認 `package.json` 中 Better Auth、`@better-auth/oauth-provider`、`@better-auth/sso`、`@zenstackhq/better-auth` 的**實際鎖定版本**。LAS 目前由 `app/las/auth/auth.mjs` 建立 Auth，`extension-client.mjs` 提供既有第一方 Client Discovery。

## 工作判準
1. 保留 **Better Auth Plugin** 的 Session／Auth／OAuth 狀態管理，不自己複寫 token、PKCE、OAuth state 或密碼流程。
2. 目前 LAS 靜態 OAuth public client ID 為 `lunarcus`；Chrome 扩充功能 ID 為另一值。兩個 Client 不可誤認為 Cloudflare Access SaaS 的 Client。
3. `las_*` 物理表與 ZenStack modelName 的正確映射是契約；不能執行 `auth migrate`、修改 RLS 或依文件自動建表。
4. 檢查 `/api/auth/oauth2/authorize`、`/token`、`/.well-known`、`/login`、`/consent` 所屬哪個 plugin，避免重複實作。
5. 確認上游 Access 的 `issuer`、`tokenEndpointAuthentication` 與 discovery 是一致配置；測出第一個失敗邊界而非反覆換 Secret。
6. 驗收跑 `npm run check:auth`，需要時核對 Worker 正式版本與真實登入 callback，不能用測試 fixture 說 SSO 已修復。

參考：https://www.better-auth.com/docs/plugins/oauth-provider 與 https://www.better-auth.com/docs/plugins/sso 。以 Repo 鎖版的行為為先。
