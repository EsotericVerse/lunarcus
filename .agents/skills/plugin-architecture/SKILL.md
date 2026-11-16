---
name: plugin-architecture
description: "LAS Plugins 獨立版本與打包、Chrome Extension 契約，以及避免無關的 LOC／Auth/MCP 重複部署。"
---

# LAS Plugins — 獨立交付，不觸發 LOC Build

`las:plugins` 是 LAS 的正式模組名稱，Chrome Extension 只是其中一個客戶端，來源 `plugins/chrome/`。不要把 Plugins 當 LAS Auth Worker、LOC Z-Model 或另一個 MCP Server 的替身。

- 每個 Plugin 各自管理入口、manifest、權限、UI、OAuth public client、Queue、匯入及 UID 回執。Chromium Extension ID、LAS OAuth client ID `lunarcus` 與 Cloudflare Access SSO client ID 必須區分，不更改舊客戶端身份。
- Auth 與 MCP 均使用同一既有 `lunarcus` Worker 的**不同 hostname**；Plugins 以對外 API 使用它們，不隨每次 Plugin 發版重新編譯 Worker 或 LOC。
- LOC 保有自己的 `/api/las-native`、短匯入、Scope、SQL Portable 業務授權；Plugins 的資料提交必須遵守這些契約，不取得任意 SQL／DB 入口。
- **Plugins-only 變更 => LAS 部署決策紀錄可回傳 `locDeploy:skip`，不發 LOC GitHub 通知；不觸發 LRS 緊急部署。** 真正改變已發布公共協定時先做 LAS 本身測試與部署，再判斷 LOC 是否受影響。
- 檢查 Extension 實機登入、回呼、Queue 冪等、匯入、回執與錯誤；`npm run check:extension` 只是一層，不能以打包成功證明整段服務已通。
