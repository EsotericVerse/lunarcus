# LunArcus Chrome Extension

以 Chrome 擴充功能方式擷取已載入的網頁與對話內容，透過 LAS OAuth 驗證後送交 LOC 的固定短匯入 API。這是現行使用入口；版本演進與故障交接請查 Git Commit 歷史與私人 Slack 工程封存，不在本頁逐版累積。

## 使用方式

在網頁上按右鍵，開啟「LunArcus」子選單，選擇整頁、選字、選區或錄製操作。工具列圖示只開啟設定頁，不提供第二套擷取 Popup。擷取範圍限瀏覽器當下已載入的內容，不代表未載入歷史對話也已保存。是否包含 AI 回覆由設定控制；串流尚未完成的回覆不應當成完整內容。

## 身分、匯入與離線資料

- OAuth 使用 `auth.lo3rwang.cc`、PKCE S256，公開 Client ID 為 `lunarcus`；Chrome Extension ID 與 OAuth Client ID 不同。現有擴充功能識別與回呼設定由 `manifest.json`、`oauth-config.json` 決定，不因改文件而改變。
- 資料匯入由 LOC `https://loc.lo3rwang.cc/api/loc-native` 的既有業務權限驗證處理；LAS 不私自授予 Scope 權限。
- 待送內容保留於原有 IndexedDB Queue。擷取後可以自動嘗試傳送；離線、授權失敗或 UID 回執不完整時保留原始待送資料，不能因失敗清除 Queue 或跨 Scope 混送。
- 擷取與匯入異常可在設定頁複製遮罩後的診斷資訊；不能包含 access token、refresh token、授權碼或 PKCE verifier。

## 驗證

本目錄實作、`manifest.json` 與相應測試是功能契約來源。修改擷取、OAuth、Queue 或回執處理後，執行 `npm run check:extension`，並分別驗證真實 Chrome 操作、登入回呼、資料保存和完整 UID 回執。測試通過不代表實機操作已驗收。
