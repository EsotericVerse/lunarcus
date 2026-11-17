---
name: auth
description: "LAS Better Auth、Google OAuth、Session 和登入授權故障入口。"
---

# auth — LunArcus / LAS

處理 `las:auth` 時以 `app/las/index.mjs`、`app/las/auth/{auth,extension-client}.mjs` 與 `wrangler.jsonc` 為準。LAS Better Auth Session、下游 OAuth Provider、LOC 內容授權是不同邊界，**不可混成一次授權**。

- 先查首次失敗點：登入 UI → `sign-in/social`(Google) → LAS Session → `oauth2/authorize`／consent → token → 客戶端回呼。**Cloudflare Access SSO 已於 2026-11-17 移除**：它只是把同一個 Google 帳號多繞一手驗證，沒有多證明什麼，還是前一次換網域時唯一斷掉的那段；現在 Google OAuth 是唯一登入路徑，不要在故障排查或新功能裡假設有第二條路可選，也不要重建它。
- LAS 已有 `las_*` PostgreSQL tables 和 RLS：只做對應與程式修正，**不執行自動 migration、改表、改 RLS、改 Secret**。
- 登入成功不代表 LOC 的 Scope、api.manage 或業務資料寫入權；不做隱性 grant。
- 先跑 `npm run check:auth`，要判斷線上故障再查公開 metadata、受遮罩日誌與真正 callback；Worker Build 成功不是登入成功。
- API 細節按需使用 `better-auth`、`oauth-oidc` 專用 Skill，不全量預讀。
