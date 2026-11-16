# LAS Agent 執行守則｜LunArcus

**唯一工作 Repository：EsotericVerse/lunarcus。** LOC 和 LRS 分別由其他 Agent／專案負責。LAS 可以只讀參考兩邊已合併的版本化契約，不在別人的 Repo 提交、合併、發布、清理、改權限，也不指揮對方修改。使用者最新明確指示優先；先查 LAS 最新 main、註解、設定、測試和實際部署，再決定最小完整方案。

## LAS 的六個模組

- `las:auth`：LAS 登入、Better Auth、Cloudflare Access SSO、OAuth Provider、Session、現有 `las_*` 資料表及其既定權限。
- `las:plugins`：Chrome Extension／插件，唯一 Chrome 來源是 `plugins/chrome/`，包含 UI、擷取、OAuth PKCE、離線 Queue 和封裝。
- `las:mcp`：MCP Builder、Gateway、JSON-RPC/Streamable HTTP/SSE、Provider 連接、工具契約及授權入口。
- `las:tunnel`：與其他 CMS／服務的固定 Data Mapping、欄位轉換和傳輸，不複製 LOC Galaxy 或任意執行 SQL。
- `las:ipa`：保留既有的 Apple/iOS Capacitor 工作流；LAS 打包 LOC App 與 LRS 的版本固定原始素材，不另造第二條 IPA 管線。
- `las:apk`：Android 打包職責；未實作完成不能聲稱已交付。

產品名稱 **LunArcus／LAS**，不新增 `las:galaxy-link`。對外名稱與 OAuth Public Client ID、Chrome Extension ID、回呼路徑、既有協定工具名稱是不同概念；只能逐個核對相容性，不因命名自動破壞 IDs。

## 工作準則：自己做完，不把測試丟給使用者

1. **先看現在的 code，不憑摘要或記憶。** 讀 current main、最近 Commit、真正入口、依賴圖、註解與部署設定；不能只看「Build PASS」判定功能成功。
2. **先取得可重現的證據**，明確指出第一個失敗邊界；不要把 SSO、OAuth、OAuth Grant、RLS、SQL Adapter、Cloudflare Worker 與 Extension 一概混為一談。
3. **在 LAS 範圍內實作並自行驗證**：有針對錯誤的測試，執行 npm／CI，必要時透過已授權的只讀 API、日誌、Browser、Preview 和 main 驗證真實功能。不以「請你測」或「Preview 綠燈」當交付。
4. **自行完成 Git 收尾**：核對 branch/main、避免蓋掉其他 Agent 修改、PR 送出、CI 過關、合併、核對部署 SHA。失敗不能盲合併；不使用 reset --hard／force push 取巧。
5. **每層驗證分開報告**：語法、測試、建置、部署、正式 OAuth 回呼、Scope Grant、MCP 工具實際操作、Chrome 本機和 IPA 真機互不等價。無法實測哪一層就說未驗證。
6. **外部權限變更要明確同意**：修改 Cloudflare Access policy、Worker Route、Secret、Binding、資料表、RLS、Token 或刪除資源之前，列出差異、風險和復原方案，取得對該次修改的授權。可以自己查的只讀資料先自行查，不要求用戶交出 Secret。
7. **不要盲加依賴**：優先現有 `better-auth`、OAuth Provider、SSO、ZenStack、Kysely、pg、Zod、現成 MCP transport。選中模組後必須接通資料流與測試，不是只 install；LRS 特效不進 LAS Auth/MCP。
8. **三邊都有工程底座，各有專業延伸。** LAS `.agents/skills/` 需包含 LOC 已有的 13 個主技能入口，再有 LAS 自己的 MCP Gateway、CMS Tunnel、Chrome、Native Packaging、Cloudflare Access 專業入口；不自動預載所有技能或下載整包依賴。按任務讀一份主要 Skill，必要時再參照 `.agents/SKILL-LINKS.md`。
9. **SQL Portable 不等於共享資料權限**：LAS 的 `vendor/loc-dialect/` 只引用已 pin 的 module-only SQL driver contract。LAS 掌握自己的 `LAS_DATABASE_URL`、TLS、Session、模型、RLS 和角色，不裝 LOC 主程式；LRS 也不因此授權 LAS 讀取其私有資料。
10. **MCP 專業品質是 LAS 的責任**：驗證 RFC/JWT/OIDC、`initialize`／`tools/list`／`tools/call`、JSON Schema、Streamable HTTP 的 JSON/SSE、取消、error status、401/403/429/503、Provider token 和資料授權。OAuth Token 只證明身分，不會自動 grant 工具權限。
11. **插件和打包各驗各的**：Extension 使用 Chrome 真實 UI、PKCE、Queue 及 UID 回執；iOS/Android 必須把 native 原始素材實際打進輸出，不可用 Web image links 代替。未驗證真機不得宣稱可用。
12. **臨時 Debug 有退出條件**：公開 SSO Debug Endpoint 不得長期開放；定位問題後關閉，並確認生產版已切到安全版本。日志和報告不得輸出憑證／授權碼／Token／Secret。
13. **不跨 Scope，不跨 Repo**：LAS 的 `las:tunnel` 只做明確 CMS Mapping，不私造 LOC Galaxy/Anchor 模型，不碰 LRS game engine／素材來源；現有公開域名與 OAuth Redirect 只按實際契約改動。
14. **成本和部署要有意義**：確認 Cloudflare Builds 實際 Git Watch Paths 與 GitHub Workflows 的區別。Extension ZIP 的更新不應無故重新部署 Auth；正式 Worker `lunarcus`、手動 MCP Worker 和 IPA 工作流各自獨立。
15. **代碼註解是維護知識；介面只顯示使用者內容**。不為補文件改數千行程式，不在 Extension 畫面暴露工程內幕；架構事實以實際 code 和測試為準。

完整工作採「定位 → 修正 → 自己跑測試 → CI → 合併 → 正式功能驗收」閉環。使用者只需要處理 Agent 無法獲得的私人授權步驟，不應被要求反覆測同一個問題。
