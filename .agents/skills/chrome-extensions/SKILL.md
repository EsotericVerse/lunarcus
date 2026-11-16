---
name: chrome-extensions
description: "LAS plugins/chrome Manifest V3、Chrome Identity OAuth、右鍵選單、對話擷取、IndexedDB Queue。"
---

# chrome-extensions — LAS 專用能力

入口 `plugins/chrome/`。`manifest.json`、`background.js`、`content.js`、`options-pages.js`、`options.js` 構成單一 Chrome Extension；六頁選單不能在整理時漏掉。

- 頁面：總覽／每日符文／MCP 連線／擷取／Queue／設定；右鍵包含整頁、選字、選區、錄製、暫停、恢復、停止。已安裝版本的行為由這些程式碼驗證，不憑圖片推斷。
- Chrome MV3 service worker 有可能被暫停；需以 `chrome.alarms`、事件處理、IndexedDB 恢復設計，不能依賴恆駐背景頁。
- `chrome.identity.getRedirectURL('loc')`／`launchWebAuthFlow`，公開 Client ID `lunarcus`；禁止把上游 Secret 放入 Browser。
- Queue 使用 `loc-channel1-queue`，匯入 `https://loc.lo3rwang.cc/api/loc-native`，依 UID 回執和 Scope 驗證才清待送。
- 分辨選區／AI 回覆是否完成、DOM 可見範圍、Chrome 權限與使用者主動擷取；不虛構歷史訊息。
- `npm run check:extension` + ZIP artifact 檢查只測靜態與模擬；Chrome 實機需要檢驗登入、擷取、UID、重啟和離線重送。

參考：https://developer.chrome.com/docs/extensions/reference/api/identity 、https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/ 。
