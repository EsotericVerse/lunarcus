---
name: chrome-extension
description: "LAS Manifest V3 Chrome Extension PKCE, context menus, offline Queue and ZIP packaging"
---

# chrome-extension

`plugins/chrome/` 是 LunArcus 唯一 Extension 來源。六頁總覽、每日符文、MCP 連線、擷取、Queue、設定，以及原有右鍵擷取／錄製，不因 Repo 搬遷而失效。

OAuth public client 是 `lunarcus`，Chrome Extension ID 是獨立識別；保留受信任 `manifest.key`、Chromium redirect URI、PKCE S256。測試獲權、角色和資料 Scope，不依賴舊 Client ID 相容性。Queue 流程是頁面→擷取→IndexedDB→LOC `/api/loc-native`→UID 回執，不能憑 Token 成功就清待送資料。

執行 `npm run check:extension`、CI ZIP 目錄驗證；真實 Chrome UI／右鍵選單／OAuth 登入及回執需獨立實機測試，沒有實機結果不得假報。
