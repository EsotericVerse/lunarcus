# Luna Protocol 三模組工程交接（2026-11-16）

本文件作為對話長度到達上限後的**工程延續基準**。以 GitHub 各 Repo 當下最新 `main` 和實際通過的 CI 為準，不要用舊對話還原或覆蓋其他 Agent 的變更。

## 正式名稱與界線

| 全域識別碼 | 簡稱 | Repo | 主體與子模組 |
|---|---|---|---|
| `lo3r@loc` | `loc` | `EsotericVerse/lunacodex` | LunaCodex／月典／玄鑒，SaaS 與 Language of Codex；`galaxy`、`time`、`locus`、`site`、`dialect` |
| `lo3r@lrs` | `lrs` | `EsotericVerse/lunarunes` | LunaRunes／月符／符韻，Symbolic Language Galaxy；`rune`、`boardgame`、`card`、`daily` |
| `lo3r@las` | `las` | `EsotericVerse/lunarcus` | LunArcus／虹月／Luna Protocol；`auth`、`plugins`（Extension）、`mcp`、`tunnel`（CMS/Data Mapping）、`ipa`、`apk` |

- `lo3r@*` 是邏輯識別碼，短稱 `loc/lrs/las` 是局部別名。這不是 npm 套件命名、Git Repo 重新命名、DNS 變更或資料庫 Scope 變更。
- **LOC 擁有 Galaxy/Anchor/Z-Model、業務授權、SQL Portable 和 PostgreSQL/MySQL/MSSQL Dialect**。LAS 不複製 Galaxy 模型，也不重新開發 SQL 引擎；目前 **`packages/` 原封不動留在 LOC**。
- **LAS 擁有協定、SSO、MCP、plugins、跨系統 Data Mapping、原生 App 打包**。LAS Auth 目前只需 PostgreSQL。ISR 計畫歸 LAS 管理，但不能阻塞 Auth。
- **LRS 擁有符文、特效和遊戲引擎**，由另一個 Agent 搬遷。Web 使用獨立部署的素材 URL；iOS 原生 App 必須保留實體素材包入 IPA。
- **不遷移任何既有網域**：`loc.lo3rwang.cc`、`lrunes.lo3rwang.cc`、`auth.lo3rwang.cc`、`mcp.lo3rwang.cc`、`isr.lo3rwang.cc`。Chrome Extension ID、現有 OAuth Client ID、Issuer、Secret Binding 名稱、`lrunes` Scope 全部維持。

## 已在 LAS main 的工程

1. [LAS PR #1](https://github.com/EsotericVerse/lunarcus/pull/1)：移入原 Auth/SSO Worker（仍為 Cloudflare script `auth`）、Extension 原始碼與圖示、MCP 原始碼快照、IPA 手動流程。減少 LAS 直接套件依賴，使用 `pg`／Kysely／Better Auth／ZenStack。
2. [LAS PR #2](https://github.com/EsotericVerse/lunarcus/pull/2)：明確定義 `loc/lrs/las` 所有權；本次再升級為 `lo3r@loc/lo3r@lrs/lo3r@las`。
3. [LAS PR #3](https://github.com/EsotericVerse/lunarcus/pull/3)：獨立 `app/las/mcp/`、`services/workers/las-mcp/`，使用 `app/las/mcp/loc-mapping.mjs` 向 LOC 固定 API 傳遞有 OAuth Bearer 的請求。MCP 不直接引用 LOC 業務庫；新增手動、**無正式網域 Route** 的 Wrangler workflow。Extension 整篇 ChatGPT 歷史擷取改為逐段捲動與去重，模擬 9 則 DOM、80 則完整對話的測試通過。
4. [LAS PR #4](https://github.com/EsotericVerse/lunarcus/pull/4)：清除 **LAS Repo** 內 23 個過時 `app/loc/mcp/*` 快照（**不刪 LOC 原始資料**），正式命名空間、完整分工、IPA 在 guard 與 build 採同一 LOC commit、ISR 現況交接、模組邊界測試。當前 PR 分支 `chore/las-repo-cleanup-ipa-isr-20261116`。CI: [run 43806631002](https://github.com/EsotericVerse/lunarcus/actions/runs/43806631002) 通過：npm 安裝、Auth／Extension 語法與擷取測試、MCP 合約測試、命名與打包契約檢查、兩個 Worker dry-run。

5. [LAS PR #5](https://github.com/EsotericVerse/lunarcus/pull/5)：修復 IPA Guard 的 Bash `printf` 輸出錯接，確實產生 `version`、`base_version`、`ipa_name`、`release_tag`、`loc_sha` 五項；新增執行真實 shell 的回歸測試，CI [run 43807796925](https://github.com/EsotericVerse/lunarcus/actions/runs/43807796925) 通過，合併 commit `d1d799d9b23b2fa668673fbb03dda345baafd103`。**只驗證 Guard 輸出，並非已完成 IPA 實機建置**。
6. [LAS PR #6](https://github.com/EsotericVerse/lunarcus/pull/6)：正式將 LOC 固定 API／Data Mapping 搬至 `app/las/tunnel/loc-mapping.mjs`；MCP 原路徑改為 re-export 保持介面相容。新增跨目錄功能身分檢查、建構語法驗證及 tunnel CI path。CI [run 43808108562](https://github.com/EsotericVerse/lunarcus/actions/runs/43808108562) 通過。未引入 CMS SQL 引擎、沒有改 Cloudflare 路由。

## LOC 配套 PR 尚須核對

[LOC PR #1728](https://github.com/EsotericVerse/lunacodex/pull/1728) 在現有 LOC Pages 新增 `/api/las-native`，只允許固定的 OAuth 驗證業務操作，仍由 LOC 查核 `api.manage` 權限、Galaxy 模型與 SQL。原來的 `/api/loc-native` 保持。分支 `feat/loc-las-native-bridge-20261116`，最後檢查 head `1d0a7b553d2a338b8a0af7dd6d6fdf71828c95eb`；LOC workflow guard 已通過，另有**手動**的輕量測試 workflow。不要違反 LOC Guard 的「其他 workflow 僅允許 workflow_dispatch」規則。LAS MCP 依賴 LOC 此橋接端點，所以不能在 LOC 端部署、進行實際授權驗收前宣稱新 MCP 已可正式使用。

## 尚未完成、不可假稱完成

- **正式 Auth deployment**：LAS Auth 獨立 bundle dry-run 通過，但 Cloudflare live `auth` 沒由 LAS 重新部署；新 Repo `CLOUDFLARE_API_TOKEN` Actions Secret 的可用性尚未核實。舊 SSO 問題不會因原始碼搬移自動修復。
- **MCP 正式切換**：目前 `mcp.lo3rwang.cc` 在 LOC Pages 上。LAS Worker 名稱 `las-mcp`，`workers_dev=false` 且 `routes=[]`，**不應搶接現有網域**。驗證 OAuth audience/Issuer、UserInfo、Scope 讀寫、MCP tool 與 SSE、Provider OAuth callback、Extension Queue receipts 後，才可安排可立即回退的部署所有權切換。
- **Extension 實機**：80 則測試是模擬，非真實 Chrome/ChatGPT 對話驗收；舊 extension profile 仍可能指向 LOC 目錄。切換 unpacked extension 的工作目錄時不應更換 Extension ID 或清除 IndexedDB Queue。
- **IPA**：LAS 接管手動 Workflow 並保留現有 Capacitor/Xcode 流程，尚未實際產出 IPA 驗收。LRS 素材原生打包整合等符文 Agent 完成後再驗收，不讓 Web URL-only 取代原生素材。
- **APK**：`las:apk` 有正式子模組規劃，但沒有實作、建置或簽署流程，不能宣稱完成。
- **ISR**：Cloudflare 既有 `loc-isr` Worker 在 `isr.lo3rwang.cc`，其執行碼是大型已編譯 OpenNext Worker。LOC 目前程式庫未找到它對應的完整可信原始碼；**不要從線上壓縮產物逆推源碼或把大型 Next bundle 放進 `auth` Worker**。ISR 保留線上不動，預設關閉，待可信 source 復原再獨立建置／切換。

## Windows 本機

`C:\GitHub\lunacodex`、`C:\GitHub\lunarunes`、`C:\GitHub\lunarcus` 均已建立。先前兩個新 Repo 由 sparse clone 初始化。

```powershell
git -C C:\GitHub\lunarcus pull --ff-only origin main
git -C C:\GitHub\lunarcus sparse-checkout disable
```

其他 Agent 正在移動 LRS；先從最新 Repo 版本確認實際檔案，再決定完整檢出，不要再度從 LOC 下載 7GB 符文生成素材。

## 重要安全原則

絕不 bulk revert、不覆蓋其他 Agents 更動、不刪仍在服務的 LOC 原始碼、不任意更換 Cloudflare 網域、OAuth 身分或 Secret、不把 SQL 及身份驗證 grant 混用。GitHub Actions 綠燈僅代表所列測試通過，**不等於線上 OAuth/SSO、MCP、IPA、ISR 驗收完成**。
