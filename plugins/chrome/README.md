# LunArcus｜Chrome Extension

**唯一 Chrome Extension：** 於 `chrome://extensions/` 載入 `plugins/chrome/`。

**v0.2.14 OAuth：** 新安裝使用公開 Client ID `lunarcus`（Client 名稱 `LunArcus`）。已解除安裝的舊版不需遷移授權資料；重新安裝並重新 OAuth 登入即可。Chrome 擴充功能 ID 保持 `hiaeafonocnjaclcfgjmdopbcgnafnna`，這是 Chrome 回呼網址的識別，不是 OAuth Client ID；`manifest.key` 保持相同，以確保回呼 `https://hiaeafonocnjaclcfgjmdopbcgnafnna.chromiumapp.org/loc` 正確。不使用動態註冊。


本擴充功能整合 LOC Auth OAuth + PKCE S256、Readability 一般網頁、選取文字、區域擷取、Instagram／Threads 已載入貼文、ChatGPT／Claude 已載入的逐則對話，以及選區動態錄製／暫停／恢復／停止。右鍵「LunArcus」即可選擇操作，工具列圖示只開啟設定頁，AI 回覆擷取預設關閉。

若連線或匯入失敗，開啟 extension 設定頁按「複製診斷紀錄」；紀錄只保留端點、HTTP 狀態與遮罩後的錯誤摘要，不包含 access token、refresh token、授權碼或 PKCE verifier。

目前設定頁不提供 Neon／Supabase MCP Provider 授權入口；已移除舊版 Provider Hub 與 Cloudflare Access SSO 的操作說明。Chrome Extension 使用 LunArcus Auth OAuth，LOC 業務匯入依其固定 API 與既有授權契約處理。

僅使用既有 IndexedDB `loc-channel1-queue` 與 `pending` store，版本 2 新增 `acknowledged` 去重存儲；原有未送 Queue 不清空、不搬移、不換帳號。所有功能共用這一個 Queue、這一組 LOC Auth 與短匯入 API。每次擷取入列後立即嘗試發送全部待送資料，無需累積筆數或容量門檻；手動發送同樣處理全部待送資料，傳輸仍依 API 限制分批；依擷取當下的 Scope 分批，各篇以來源為單位持續 Append，完整收齊批次／UID 回執後才刪 Queue。禁止匿名、覆寫文章及跨 Scope 混合批次。

非預設 Scope 由 LOC 網站既有 `/api/loc-native` 依 OAuth 身分與既有 `api.manage` 寫入授權核對；Extension 依擷取當時的 Scope 分批，不允許未授權 Scope 落入預設 Scope。程式不使用舊網站 Session Bridge、SQL Gateway、Clerk、Supabase Auth 或 Neon Auth。

**既有另一個已安裝 Extension 注意：** Chrome 不允許新 Extension 直接讀取不同 Extension ID 的 IndexedDB。若舊的 `loc-web-capture-v2` 已有待送資料，請先從舊版送達、確認 UID 再卸載；本倉庫不再提供第二套獨立 Extension。瀏覽器尚未載入的對話不會自動取得。

## 操作入口（0.2.1）

請直接在**網頁內容上按右鍵**，打開 Chrome 原生「LunArcus」子選單，再選擇整頁、選字、選區或錄製及其控制指令。工具列圖示僅打開設定頁（LOC Auth、Scope、是否包含 AI 回覆、Queue），**不提供擷取 Popup**。升級不改原本的 Chrome Extension ID、IndexedDB 名稱或儲存的 Queue。

## v0.2.2：互動狀態與故障回饋

右鍵功能依目前頁籤的實際錄製狀態顯示：未錄製不顯示暫停／繼續／停止；錄製中只有暫停與停止；暫停後只有繼續與停止。Chrome 工具列徽章只顯示離線 Queue 待送的擷取次數，0 即清空徽章；錯誤不再顯示為貌似「1」的驚嘆號。右鍵擷取後頁面即時提示，設定頁保留最近一次操作與具體錯誤。所有擷取資料與 UID 回執繼續使用原 IndexedDB，不清除或重新建立使用者資料。

## v0.2.3：ChatGPT 對話錄製實際入列

辨識新版 ChatGPT 對話的語意標籤（You said／你說）與訊息區塊，不再只仰賴 data-message-author-role。聊天頁選取錄製區域會涵蓋同一個 main 對話容器，避免只錄製單一訊息泡泡而得不到訊息節點。無法辨識內容、Queue 寫入失敗均顯示原因；錄製狀態不代表入列成功。原有 Queue、OAuth、Scope、UID 流程不變。

## v0.2.4：長對話、錄製確認與失敗退避

ChatGPT 巢狀 DOM 以外層訊息 Turn 去重，同一則訊息不再重複入列；已載入超過 100 則的長對話以每次最多 100 則入列，不會整批拒絕。動態錄製對串流內容採 1.25 秒去抖，按停止時等待尚未完成的 Queue 寫入，最後擷取也必須拿到 Queue 回執。HTTP 5xx 顯示可安全揭露的短錯誤原因並採指數退避（上限一小時），避免無效請求；手動傳送仍可重試，429 遵守流量限制。現有 IndexedDB、Queue、已保存 UID、OAuth、Extension ID、Scope ID 均不變。

## v0.2.5：第三方 ChatGPT Shadow 擷取模組完整移植

Apache-2.0 授權的 [ChatGPT Shadow](https://github.com/dialoguesai/chatgpt-shadow-extension) `extract.js` 已完整放入 `vendor/ChatGPTShadowExtract.js`，保留其原始授權文件；由 LOC 原本的 `content.js` 將新版 ChatGPT 的搜尋單元、舊版角色節點、Markdown／程式碼、訊息 ID、串流辨識，統一轉入原有的 `items.captured` 與 IndexedDB Queue。只在明確按右鍵擷取／啟動錄製時注入，不啟用 Shadow 原本的自動常駐同步、週期輪詢、Topos、另一套儲存或第三方登入。串流中的 AI 回覆不寫入；等到內容完成才納入（需原有「包含 AI 回覆」設定開啟）。新對話尚未取得正式 `/c/<id>` 時不冒險以暫存網址建立 Galaxy 來源；不同對話的殘留 DOM 會被丟棄。保留既有 Queue／Scope／OAuth／UID 回執與 Chrome Extension ID。

## v0.2.11：全頁擷取、對話錄製與 Queue 發送

ChatGPT／Claude 開始錄製立即監看對話主區域，不需再點選錄製範圍；整頁擷取是已載入訊息的一次快照，不會被殘留的「尚在生成」狀態阻止。只有可見的生成停止按鈕代表正在生成；已完成的訊息可持續擷取，最後一則未完成的 AI 訊息暫不保存。Queue 不再等待擷取數量或大小門檻，接收擷取後立即發送全部待送資料；離線、未授權、回執不完整時原始 Queue 照常保留，底層維持分批傳輸與失敗退避。未載入於網頁 DOM 的歷史對話仍不能視為已保存，不能以 Queue 新增筆數宣稱完整封存。

## v0.2.12：LAS 獨立 Extension 與 LOC 資料 API

- `oauth-config.json` 隨 Extension 一同封裝，不再向 LOC 網站索取 Extension 的 OAuth 設定檔；OAuth Issuer 仍為 `auth.lo3rwang.cc`，Chrome Extension ID 不變，OAuth Client ID 自 v0.2.14 起為 `lunarcus`。
- Queue 的短匯入直接發送至 `https://loc.lo3rwang.cc/api/loc-native`。這是 LOC 的業務資料 API，**不需要啟動 LAS MCP Worker**。既有 `resource` URI 仍保留為 `https://mcp.lo3rwang.cc`，僅供目前 OAuth Token audience 驗證使用，不代表啟用或呼叫 MCP 服務。
- 這次依新安裝模式使用 `lunarcus` Client ID，重新登入後才會取得新 Token；不執行舊 OAuth Client 的自動遷移。
- MCP Provider 狀態只在使用者主動進入「MCP 連線」頁時查詢；Extension 一般啟動、登入和 Queue 擷取不會主動探測它。
- GitHub Actions 的 `Package LAS Chrome Extension` 會在本目錄更新時完成測試並產生 ZIP Artifact。解壓 ZIP 後以 Chrome「載入未封裝項目」指向含 `manifest.json` 的資料夾。維持相同的已安裝 Extension，不要刪掉舊 Extension 或清除瀏覽器儲存空間。
- 本次測試不等於真實 OAuth 回呼與資料庫寫入驗收。實機仍需檢查登入、單篇擷取、Queue 完整 UID 回執及重啟瀏覽器後資料保存。
