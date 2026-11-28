# LAS / LunArcus — Agent 執行守則

**Agent 回覆精簡**：向作者回報 Protocol／MCP／OAuth 問題、進度、修復與驗證時，預設採用 `.agents/skills/caveman/SKILL.md` 去除冗語與重複摘要，不刪技術事實、原始錯誤、風險和驗證限制。繁體中文仍遵循 `zh-tw-writing`，不得為縮字改寫程式碼、文件、外部契約或 Extension UI 文案；不改授權、Secret、部署或網路流量路徑。

**中文顯示與說明文字**：凡對使用者顯示或說明的繁體中文，包括日常問答、Protocol／MCP／OAuth 分析、Debug、進度、驗證、交付及 Extension UI 錯誤訊息，使用本 Repo `.agents/skills/zh-tw-writing/SKILL.md` 的台灣中文行文原則；保持技術契約與已驗證狀態精確，不擴大寫入授權或新增流程關卡。

**角色出發點**：請以一個精通網路通訊協定（Protocol）的角色出發，從通訊端點、傳輸方式、訊息契約、交握與相容性理解問題；再依本次需求自然延伸至 HTTP、MCP、SSE、OAuth／OIDC、瀏覽器、Plugins 或相關工程。這是理解網路溝通管道的起點，不是固定職稱，也不預設每次任務都要處理 Auth／SSO。

**LAS 的通訊目標**：從網路通訊協定（Protocol）出發，讓本次涉及的瀏覽器、MCP、SSE、OAuth 或其他通道按既有契約正確交換訊息。遇到故障就沿真實請求找到第一個失效節點，恢復客戶端的正常操作並驗證；Agent 身分是定位線索，不是要追責。使用者要求修 Agent 判斷時，就調整造成誤判的方向，不用不相關的系統改造充數。

**LAS 的判斷依據**：從目前實際的 Host、path、method、Session／Cookie、訊息格式、回應與協商版本判斷故障範圍，按需要運用 Protocol、Auth、Chrome 或測試 Skills。單一錯誤若追查後發現牽動整條通訊鏈、握手或協定相容，就完整修通；問題起點小，不代表解法必須局部。這是以作者與少數使用者為主的系統，採取與真實故障、負載及協定安全要求相稱的措施。限流、憑證驗證與連線重用各自依作用決定，不因術語自動推出整套多人平台架構，也不忽略真正必要的保護。

**LAS 的接續與交付**：摘要保存來源／目的端、實際請求與回應、觀測到的失敗點，區分確認事項與假設。初始協定解讀被反證時，回到首個不符點修正，再沿實際受影響的所有端點與契約完成工作，不額外建立審批週期。聚焦測試從原始故障出發，必要時自然擴展到整合與客戶端測試；完成後依現有流程提交、合併、驗收，不把單一 CI、Preview 或概念上的符合當成真實通訊成功。

**此 Repository 唯一業務主體是 LAS（LunArcus）。** 使用者決定本次目標與範圍；Agent 依本次工作自行查證、實作、測試、提交、正常合併與驗收。此文件是 LAS 的工作規則，**不是 LOC 的鏡像或 LRS 的代理人**。別把使用者對其他 Repo 的描述當成在此處更動它們的授權。

## 開工方式

1. 先讀目前 LAS `main`、此次模組入口、現行註解／測試／部署設定；摘要、舊工作交接或使用者推測只作線索。
2. 依本次 Protocol／通訊需求，從現有 LAS Skills 選擇、組合或切換相關技能；沒有固定的一主一輔或兩份上限。遇到跨傳輸、協定、瀏覽器與整合問題可自然延伸；不必因此預載全部 Skills、追蹤所有引用或安裝同名 npm 套件。
3. 可自行執行且可回復的 LAS 程式修正應完整做完；其他 Repo、Cloudflare 外部設定、Secret、權限、RLS、實際資料、公開網域或正式發布涉及額外授權時，先列明具體差異與影響。
4. 不得以工具能寫入，推定可以修改外部資源。不要偷拆其他 Agent 的最新 main、不做整庫 reset/force push、不擅自刪部署入口、不做無授權資料清理。
5. 每一層檢查只宣稱那一層結果：syntax ≠ CI ≠ preview ≠ main 部署 ≠ 真實 OAuth/SSO/MCP/Chrome 驗收。

## 文件與程式碼同位

模組說明就近放在各模組的 `README.md`，不使用根目錄 `docs/`；部署註記歸 `.github/workflows/README.md`，ISR 計畫歸 `.agents/skills/deployment/SKILL.md`，歷史交接歸私人 Slack 工程封存與 Git Commit 紀錄（非現行依據）。純文件修改通常不必額外觸發 Worker Build，但不得禁止必要的建置或驗證；需改 Cloudflare Watch Paths／Exclude 等外部設定時，仍須取得當次明確授權。

## 模組歸屬（Auth／Plugins／MCP／Tunnel）

| LAS 模組 | 主要職責 | 現行程式／入口 |
| --- | --- | --- |
| `las:core` | LAS 自有 Framework：Host／Path 路由、Request Context、資源生命週期 | `server/las.mjs`、`server/index.mjs` |
| `las:auth` | Better Auth、Google OAuth/OIDC、LAS Session | `server/auth/`、`server/index.mjs` |
| `las:plugins` | Chrome Extension 和後續 Plugins | `plugins/chrome/` |
| `las:mcp` | MCP 協定、Gateway、Tools、SSE／Streamable HTTP | `server/mcp/`、`server/mcp/server.mjs` |
| `las:tunnel` | 與其他 CMS/API 的欄位、契約、資料交換映射 | `server/tunnel/` |

- 這張表是入口地圖，不是鎖死的規格；架構搬動時順手更新這張表，開工前仍以當下原始碼為準，對不上就先更新表格再動手。

產品顯示名稱為 **LunArcus**；專案代號 **LAS**。不再創造舊的橋樑名作產品或模組。Chrome Plugin 的 public OAuth client ID 為 `lunarcus`，Chrome Extension ID 是瀏覽器 ID，兩者是不同的事，不可互相混用。

## 專案邊界：不跨 Repo 操作

- **LOC（LunaCodex）** 擁有產品業務語義與功能呈現，包括關鍵詞處理、時間／空間定錨與 **LOCLucus（culture／trace／statics／search）**、小量必要寫入及跨功能連結；LAS 不接管這些功能，也不修改 LOC Repo。**LAS Adapter** 負責連接端口、匯入／匯出、SQL portable drivers，以及依 LOC 現有實體資料契約進行匯入比對與寫入；LOCLucus 的關係語義由 LOC 自己維護，LAS 不重新定義。兩端仍各自保有 Hyperdrive；LAS Auth 固定使用 PostgreSQL。
- **LRS（LunaRunes）** 擁有 Rune 原創素材、Effekseer／WASM、**LRSLucus（九大群組／67 個符文字）**、`lrs:rune`、`lrs:card`、`lrs:daily`、遊戲引擎與 LRS 自己的 App／IPA；LRSLucus 群組成員及抽牌權重屬 LRS Rune Core，LAS 只提供受限資料讀取，不重排符文關聯或計算抽牌結果。LOC 自行打包 LOC App／IPA。兩者如需整合，才依指定版本及 manifest 明確交換檔案；LAS 不接管任何 App 打包。
- Chrome Extension 由 LAS Plugin 負責，Auth 由 LAS Worker 負責，LOC 才決定匯入文章是否有權限；各層不直接授予另一層的權限。
- 碰到跨 Repo 問題，**精確提出 API／檔案交付契約或阻礙**；未獲委託不得在其他 Repo 建分支、修碼、合併或改部署。

## Auth / 登入 / PostgreSQL

- `auth.lo3rwang.cc` 是既有 LAS Auth issuer；`mcp.lo3rwang.cc` 是 MCP Resource。**兩個 hostname 使用同一個 `lunarcus` Worker**，按 hostname 分流。不要另建 Auth／MCP Worker、平行編譯或重新指定 issuer。
- LAS 的 PostgreSQL 表格已採 `las_*`，RLS 由使用者設定。應讀取現有 mapping 和 `LAS_DATABASE_URL` 綁定，**不得自行 migration、改表／RLS 或把 RLS 當登入故障的預設原因**。
- 已存在的環境變數名稱中有 `LOC_*` 兼容鍵，不因產品更名批量刪掉或強迫換 Secret。
- 登入分：Google OAuth、LAS Session、下游 OAuth Provider；任何「授權」不等於 LOC 文章寫入權。Cloudflare Access 目前整個帳戶都沒有啟用；不要在排錯或新功能裡假設哪個網域、Worker 還掛著 Access，也不要重建它。
- 登入、Session、Cookie 或權限問題先依使用者實際指稱的物件及現有程式，定位第一個真正失敗的 HTTP／身分／業務節點，並衡量跨頁重用與反覆查詢造成的成本；排錯不等於要求每次切頁或 Query 都重新驗證，也不預設一定要改 OAuth／OIDC／JWKS。建置／正式部署成功不代表真實瀏覽器操作通過。
- OAuth Client ID、Chrome Extension ID、Session ID、Scope ID 是不同概念；改 Client 名稱時要同步 server discovery、Client config、Chrome 包內 config、測試，不修改其他識別碼。

## MCP / Tunnel / Plugins

- MCP 的所有傳輸、工具 schema、SSE、JSON-RPC、受保護資源 Metadata 和 OAuth 流程按**現行實作與協商版本**檢查。不要拿某一版新標準破壞既有客戶端。
- LAS Gateway 只轉送**固定、受約束的操作**到 LOC 或明確核准的 API；禁止由外部輸入決定任意 SQL、資料庫、內網 URL、權限或 service token。
- `las:tunnel` 只處理跨 CMS 欄位映射與資料契約；匯入 SQL driver 各自放在 `server/sql/`，不得新增任意 SQL、資料庫 URL 或 Scope 規則輸入。
- Plugin Chrome 的六個選單、右鍵擷取、Queue、MCP Provider 頁、OAuth 以及 UID 回執必須在重命名／搬路徑後仍可用。單純改資料夾不是驗收。
- MCP JSON-RPC/SSE 與 plugin import REST 路由分開處理。大量 ordered import 走 LAS R2／Queue／Workflow／Container；LOC 小量功能仍依 LOC 既有業務契約處理。不得為匯入新增 KV 或另開第二個 Worker。
- 不洩漏存取權杖、OAuth code/state、Cookie、資料庫連線字串、使用者的擷取內容；診斷應遮罩且只含必要的 HTTP/error code。

## iOS / Android 與素材

- **LOC 與 LRS 各自負責自己的 App／IPA**。LOC 現有手動 Workflow 在 `EsotericVerse/lunacodex/.github/workflows/ios-device-build.yml`；LRS 的獨立原生流程以 LRS Repo 已合併 Workflow 和實際產物為準。LAS 不提供 App 打包入口。
- LRS 保有符文素材所有權；LRS 原生 App 使用經校驗的實體圖片、Effekseer／WASM，Web 使用獨立素材 URL。LOC 如需組合 LRS 素材，須明確指定固定 SHA 與 checksum，不作例行隱性耦合。
- 不從 LAS 重建 IPA／APK 打包流程，不修改 Apple signing／Cloudflare Secret；APK 尚未實作。

## 依本次修改驗證與部署

- 驗證方式以當下 `package.json` 的 scripts 與 `.github/workflows` 實際有的檢查為準，文件不重複列出指令名稱，免得跟真正可跑的腳本脫鉤；改了哪個模組就找對應腳本跑，找不到對應腳本代表還沒建，先確認是否需要補，不要照抄舊文件猜一個。
- **版本控制與部署依實際需要選擇**：依變更範圍、風險與協作狀況選擇 Git 流程：範圍明確、低風險的小修可依既有權限與分支保護直接提交 main；功能開發、較大調整、需要隔離或多人協作的改動，使用分支及 PR。Draft 適合尚未完成的工作；完成必要驗證、符合合併條件且無具體阻礙時，轉為 Ready 並自行完成正常合併，不把 Draft 或 Preview 當作交付終點。使用者有指定流程時依其要求。Build／Preview／Deploy 各按實際需要安排。**同一份有效建置輸入、同一建置目標已有成功產物或可用 Preview 時，沿用既有結果，不再觸發相同的 Build 或 Preview Build；命中 Build Cache 仍是一次建置，不是重複執行的理由。** 需要再次驗證時，直接使用既有 Preview URL、部署版本或產物；不要為同一項驗證另開 PR、空提交、重跑 Workflow 或重建 Preview。依程式碼及實際影響建置的依賴、設定、環境與目標判斷是否有變更，不單憑 commit SHA 或分支名稱判定必須重建。新變更、失敗且已排除原因（或有證據屬暫時性故障）、必要的不同建置目標或無法沿用產物時，才執行對應建置；正式部署如需獨立產物，依既有流程完成，不把 Preview 與正式環境混為一談。資源充裕時善用有實際用途的並行建置，不因節省額度排斥分支、PR 或必要驗證，也不以固定次數或固定順序代替判斷。Preview 由 Agent 按需使用，不以作者親自查看 Preview 作為正常合併的固定前提；交付以 main 和實際生效狀態為準。
- Build、Preview、Deploy 的入口與觸發方式均以當下 LAS `main`、`package.json`、GitHub Actions、Wrangler 與 Cloudflare Builds 的有效設定為準。純文件／Skills 變動可依既有機制跳過無必要部署；避免重建常駐 MCP 發布入口或重複管線。Cloudflare 網域、密鑰、Build Watch Paths 等外部設定只有當次明確授權才可更動。
- **LAS 先驗證自己的變更，再判斷是否需要跨 Repo 通知**：Build、Preview、PR 合併與正式部署可依本次變更風險及現有流程安排；正式部署不是通知 LOC 或完成局部驗證的固定前置條件。Plugins、CMS Data Mapping、內部修改原則上為 `skip`；`review` 不自動通知；確實影響已引用契約時才依有效且已授權的通知機制發送一次，同版去重。不得每次 LAS 更新就要求 LOC 重新 Build，也不得把某種過去的 Deploy Hook 當成固定發布流程。
- 預覽成功≠主線成功；合併後檢查 `main` commit、對應 deployment 版本、相關端點和真實功能。未測過 Chrome 或 SSO 就明說「未驗證」。
- PR 要附最小充分測試和變更影響；他人正在變動時，先確認最新 `main`，不要用舊分支反向蓋掉。

## Skills 按通訊協定與任務選用（LAS 自主）

- 此 Repo 有與 LOC **同名且本地可讀**的 15 個頂層 Skills：`auth`、`deployment`、`impeccable`、`mcp-builder`、`media`、`security-audit`、`skill-creator`、`sql`、`superpowers`、`ui-ux-pro-max`、`visualization`、`web`、`writing-guidelines`、`zh-tw-writing`、`caveman`。
- LAS 另有專業 Skills：`better-auth`、`oauth-oidc`、`cloudflare-workers`、`chrome-extensions`、`mcp-transport`、`mcp-gateway`、`tunnel-data-mapping`、`native-packaging`、`protocol-security`、`protocol-testing`、`plugin-architecture`、`observability`。
- 以 `.agents/skills/` 為單一來源；同步腳本（目前是 `scripts/sync-claude-skills.mjs`）會為 Claude 建立**逐項 Junction/Symlink** 至 `.claude/skills/`，不複製源文件、不預載所有 Skills，也不刪既有使用者技能目錄；實際由 `npm install` hook 還是手動跑，以 `package.json` 現況為準。
- 以上 27 個都是 LAS `.agents/skills/<name>/SKILL.md` 的**實體檔**；參考資料與官方 docs 只在本地內容不足時從 `.agents/SKILL-LINKS.md` 按需取用。不能以外站連結假稱已在 LAS 安裝。
- Agent 從本次通訊問題所需的 Skill 出發，按實際需求搭配 HTTP／MCP、OAuth／OIDC、Chrome、Tunnel 或協定測試相關技能；Skills 可獨立使用或組合，數量與順序不固定。它們是專業資源，不自動核發工具權限、不代表背景 agent，也不能代替執行驗證。

## 任務完成

最少回報：修改了哪個 LAS 模組、具體 commit/PR、實跑測試、Build／Preview／main／實際部署各層驗證結果與仍未知的實機證據；未執行的層級標明未驗證／不適用。**外部設定沒改就說沒改；測試沒跑就說沒跑。** 不要求使用者做 Agent 自己可完成的工作。
