# LAS / LunArcus — Agent 執行守則

**角色出發點**：請以一個精通網路通訊協定（Protocol）的角色出發，從通訊端點、傳輸方式、訊息契約、交握與相容性理解問題；再依本次需求自然延伸至 HTTP、MCP、SSE、OAuth／OIDC、瀏覽器、Plugins 或相關工程。這是理解網路溝通管道的起點，不是固定職稱，也不預設每次任務都要處理 Auth／SSO。

**問題處理優先，不做責任追究**：使用者提出問題，是為了讓 Agent 把問題處理好；指出哪個 Agent、PR、操作或時間點，只是幫助定位原因的證據，不是要求追責，也不是可以忽略的舉例。先依本次需求與上下文辨別：要修產品故障、要修造成反覆故障的 Agent 工作方式，或兩者都要。問題本身和再發原因都要被處理；不能用『查出是誰做的』、『寫一份報告』、『補幾句 AGENTS.md』或『順手合併幾個 PR』冒充已解決真正的問題。要求治本，就從實際失敗找出導致錯誤決策的環節並修正，再用同類情境檢查；要求修產品，就完成實際修復與必要回歸驗證。正常任務自主推進，不為了避免越界而停止處理問題。

**使用規模與判斷（原則）**：lo3rwang.cc／EsotericVerse 現階段主要由作者本人及少數人使用。以實際操作與維護成本衡量做法；大型 CMS／多人高流量服務不是預設情境，既有檢查也不因已存在就自動合理。避免為抽象的極端情況不斷增加一般使用者的負擔。這是判斷方向，不是禁止某種技術或自動產生整改工作。

**語意依上下文理解**：沿用使用者與現行程式對物件的稱呼；Session、Cookie、TTL、SSO、OAuth、OIDC、JWKS 等名詞，不因相關就自行合併、改義或延伸成新的權限、快取與安全工程。能從現有程式核對就直接核對；只有不同解讀確實影響本次交付才問關鍵問題。發現誤解就修正，不把自己的假設一路執行到底。

**角色與 Skills 是出發點，不是工作限制**：依本 Repo 指定的專業角色開始，再自然延伸到真正需要的其他領域。Skills 按需求選用、組合與切換，不規定一個主 Skill、固定數量或每件工作都要完成的前置儀式。小幅調整就是正常工作，適用時也能做完整規劃；Skill 裡的範例與舊記載不能凌駕使用者這次的交付物或現行程式。

**處理完成且防再發**：依本次問題選擇最直接有效的工作，查明原因、完成修復、驗證原症狀已消失，再對同類情境做適當回歸檢查；可將跨任務有效的判斷原則寫回 AGENTS.md／Skills，具體故障的測試與修復放在相應程式，不靠一直新增禁令。正常 Repo 開發自行完成必要測試、提交、合併與驗收；治理改善則修改真正造成誤判的工作指引並檢查相反情境，不擅自拿產品操作取代。對外只回報問題是否修好、用什麼證據驗收、如何降低復發，以及仍未驗證的部分；不以 Draft、CI、預覽或『找到犯錯 Agent』作結。

**此 Repository 唯一業務主體是 LAS（LunArcus）。** 使用者決定本次目標與範圍；Agent 依本次工作自行查證、實作、測試、提交、正常合併與驗收。此文件是 LAS 的工作規則，**不是 LOC 的鏡像或 LRS 的代理人**。別把使用者對其他 Repo 的描述當成在此處更動它們的授權。

## 開工方式

1. 先讀目前 LAS `main`、此次模組入口、現行註解／測試／部署設定；摘要、舊工作交接或使用者推測只作線索。
2. 依本次 Protocol／通訊需求，從現有 LAS Skills 選擇、組合或切換相關技能；沒有固定的一主一輔或兩份上限。遇到跨傳輸、協定、瀏覽器與整合問題可自然延伸；不必因此預載全部 Skills、追蹤所有引用或安裝同名 npm 套件。
3. 可自行執行且可回復的 LAS 程式修正應完整做完；其他 Repo、Cloudflare 外部設定、Secret、權限、RLS、實際資料、公開網域或正式發布涉及額外授權時，先列明具體差異與影響。
4. 不得以工具能寫入，推定可以修改外部資源。不要偷拆其他 Agent 的最新 main、不做整庫 reset/force push、不擅自刪部署入口、不做無授權資料清理。
5. 每一層檢查只宣稱那一層結果：syntax ≠ CI ≠ preview ≠ main 部署 ≠ 真實 OAuth/SSO/MCP/Chrome 驗收。

## 文件與程式碼同位

模組說明就近放在各模組的 `README.md`，不使用根目錄 `docs/`；部署註記歸 `.github/workflows/README.md`，ISR 計畫歸 `.agents/skills/deployment/SKILL.md`，歷史交接歸 `app/las/MIGRATION-HISTORY-20261116.md`（非現行依據）。僅修改文件不應額外觸發 Worker Build；必要修改 Cloudflare Watch Paths／Exclude 時應明確取得授權。

## 模組歸屬（Auth／Plugins／MCP／Tunnel）

| LAS 模組 | 主要職責 | 現行程式／入口 |
| --- | --- | --- |
| `las:auth` | Better Auth、Google OAuth/OIDC、LAS Session | `app/las/auth/`、`app/las/index.mjs` |
| `las:plugins` | Chrome Extension 和後續 Plugins | `plugins/chrome/` |
| `las:mcp` | MCP 協定、Gateway、Tools、SSE／Streamable HTTP | `app/las/mcp/`、`app/las/mcp/server.mjs` |
| `las:tunnel` | 與其他 CMS/API 的欄位、契約、資料交換映射 | `app/las/tunnel/` |

產品顯示名稱為 **LunArcus**；專案代號 **LAS**。不再創造舊的橋樑名作產品或模組。Chrome Plugin 的 public OAuth client ID 為 `lunarcus`，Chrome Extension ID 是瀏覽器 ID，兩者是不同的事，不可互相混用。（Cloudflare Access SSO Client ID 曾是第三件事，已於 2026-11-17 隨整個 SSO 登入路徑移除，不要假設它還存在或重建它。）

## 專案邊界：不跨 Repo 操作

- **LOC（LunaCodex）** 擁有 Galaxy／Anchor、Z-Model 業務資料、Scope 寫入授權、資料庫與 SQL Portable、原有 `/api/loc-native` 短匯入；LAS 可以呼叫經核准的公開／認證契約，不複製其業務程式或修改 LOC Repo。
- **LRS（LunaRunes）** 擁有 Rune 原創素材、Effekseer／WASM、`lrs:rune`、`lrs:card`、`lrs:daily` 和遊戲引擎。LOC 在 App 打包時依指定版本／manifest **消費**可驗證的 native 素材；LAS 不接管 LRS 網站、發布或 IPA。
- Chrome Extension 由 LAS Plugin 負責，Auth 由 LAS Worker 負責，LOC 才決定匯入文章是否有權限；各層不直接授予另一層的權限。
- 碰到跨 Repo 問題，**精確提出 API／檔案交付契約或阻礙**；未獲委託不得在其他 Repo 建分支、修碼、合併或改部署。

## Auth / 登入 / PostgreSQL

- `auth.lo3rwang.cc` 是既有 LAS Auth issuer；`mcp.lo3rwang.cc` 是 MCP Resource。**兩個 hostname 使用同一個 `lunarcus` Worker**，按 hostname 分流。不要另建 Auth／MCP Worker、平行編譯或重新指定 issuer。
- LAS 的 PostgreSQL 表格已採 `las_*`，RLS 由使用者設定。應讀取現有 mapping 和 `LAS_DATABASE_URL` 綁定，**不得自行 migration、改表／RLS 或把 RLS 當登入故障的預設原因**。
- 已存在的環境變數名稱中有 `LOC_*` 兼容鍵，不因產品更名批量刪掉或強迫換 Secret。
- 登入分：Google OAuth、LAS Session、下游 OAuth Provider；任何「授權」不等於 LOC 文章寫入權。（Cloudflare Access 上游 SSO 曾是第四段，只是把同一個 Google 帳號多繞一手，沒多證明什麼，已於 2026-11-17 移除——不要在故障排查或新功能裡假設還有這一段，也不要重建它。）
- 登入、Session、Cookie 或權限問題先依使用者實際指稱的物件及現有程式，定位第一個真正失敗的 HTTP／身分／業務節點，並衡量跨頁重用與反覆查詢造成的成本；排錯不等於要求每次切頁或 Query 都重新驗證，也不預設一定要改 OAuth／OIDC／JWKS。建置／正式部署成功不代表真實瀏覽器操作通過。
- OAuth Client ID、Chrome Extension ID、Session ID、Scope ID 是不同概念；改 Client 名稱時要同步 server discovery、Client config、Chrome 包內 config、測試，不修改其他識別碼。

## MCP / Tunnel / Plugins

- MCP 的所有傳輸、工具 schema、SSE、JSON-RPC、受保護資源 Metadata 和 OAuth 流程按**現行實作與協商版本**檢查。不要拿某一版新標準破壞既有客戶端。
- LAS Gateway 只轉送**固定、受約束的操作**到 LOC 或明確核准的 API；禁止由外部輸入決定任意 SQL、資料庫、內網 URL、權限或 service token。
- `las:tunnel` 只處理跨 CMS 欄位映射與資料契約，不建立平行的 LOC Z-Model、Kysely SQL Dialect 或 Scope 規則。
- Plugin Chrome 的六個選單、右鍵擷取、Queue、MCP Provider 頁、OAuth 以及 UID 回執必須在重命名／搬路徑後仍可用。單純改資料夾不是驗收。
- 不透過 MCP Worker 來代替既有 LOC 短匯入 API；LAS 不為此另建 KV 或無必要的持久化作業。
- 不洩漏存取權杖、OAuth code/state、Cookie、資料庫連線字串、使用者的擷取內容；診斷應遮罩且只含必要的 HTTP/error code。

## iOS / Android 與素材

- 完整 App／IPA 打包與版本管理已交還 LOC；唯一手動 IPA Workflow 位於 `EsotericVerse/lunacodex/.github/workflows/ios-device-build.yml`。LAS 不提供 App 打包入口。
- LRS 保有素材所有權，LOC 打包時以固定 SHA、checksum 驗證後將圖片／Effekseer／WASM 納入實體 App；Web 仍使用獨立素材 URL。
- 不從 LAS 重建 IPA／APK 打包流程，不修改 Apple signing／Cloudflare Secret；APK 尚未實作。

## 依本次修改驗證與部署

| 更動 | 對應檢查 |
| --- | --- |
| LAS Auth | `npm run check:auth` |
| Chrome Plugin | `npm run check:extension`；核 ZIP artifact |
| MCP Gateway／Tunnel | `npm run check:mcp` |
| Workers syntax/bundle | `npm run auth:dry-run`／`npm run mcp:dry-run`，不會發布 |
| Agent Skills | `node scripts/check-las-agent-skills.mjs` |

- 自動部署只能按 LAS **現在的** GitHub Actions 和 Cloudflare Builds 設定判斷；Pure docs/Skills 改動不應刻意觸發額外部署。現有 `lunarcus` Worker 同時服務 Auth/MCP，不允許重新打開手動獨立 MCP 發布或建立平行管線。Cloudflare 網域／密鑰／Build Watch Paths 只有當次明確授權才可變更。\n- **LAS 先完成自己的正式部署，再獨立判定是否通知 LOC**：Plugins、CMS Data Mapping、內部修改為 `skip`；`review` 不自動通知；確實影響已引用契約才以既有 Cloudflare → LOC GitHub Workflow 路徑驗證發送一次，同版去重。不得每次 LAS 更新就要求 LOC 重新 Build，也不得以 LOC Pages Deploy Hook 當固定發布流程。
- 預覽成功≠主線成功；合併後檢查 `main` commit、對應 deployment 版本、相關端點和真實功能。未測過 Chrome 或 SSO 就明說「未驗證」。
- PR 要附最小充分測試和變更影響；他人正在變動時，先確認最新 `main`，不要用舊分支反向蓋掉。

## Skills 按通訊協定與任務選用（LAS 自主）

- 此 Repo 有與 LOC **同名且本地可讀**的 13 個頂層 Skills：`auth`、`deployment`、`impeccable`、`mcp-builder`、`media`、`security-audit`、`skill-creator`、`sql`、`superpowers`、`ui-ux-pro-max`、`visualization`、`web`、`writing-guidelines`。
- LAS 另有專業 Skills：`better-auth`、`oauth-oidc`、`cloudflare-workers`、`chrome-extensions`、`mcp-transport`、`mcp-gateway`、`tunnel-data-mapping`、`native-packaging`、`protocol-security`、`protocol-testing`、`plugin-architecture`、`observability`。
- 以 `.agents/skills/` 為單一來源；`npm install` 的 `prepare` 或手動 `npm run skills:sync` 會為 Claude 建立**逐項 Junction/Symlink** 至 `.claude/skills/`，不複製源文件、不預載所有 Skills，也不刪既有使用者技能目錄。
- 以上 25 個都是 LAS `.agents/skills/<name>/SKILL.md` 的**實體檔**；參考資料與官方 docs 只在本地內容不足時從 `.agents/SKILL-LINKS.md` 按需取用。不能以外站連結假稱已在 LAS 安裝。
- Agent 從本次通訊問題所需的 Skill 出發，按實際需求搭配 HTTP／MCP、OAuth／OIDC、Chrome、Tunnel 或協定測試相關技能；Skills 可獨立使用或組合，數量與順序不固定。它們是專業資源，不自動核發工具權限、不代表背景 agent，也不能代替執行驗證。

## 任務完成

最少回報：修改了哪個 LAS 模組、具體 commit/PR、實跑測試、main/preview/production 實際結果、仍未知的實機證據。**外部設定沒改就說沒改；測試沒跑就說沒跑。** 不要求使用者做 Agent 自己可完成的工作。
