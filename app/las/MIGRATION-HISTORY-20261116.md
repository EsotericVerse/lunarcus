> **Historical handoff snapshot — 2026-11-16.** This file preserves the original engineering chronology and may contain **superseded** deployment, IPA ownership and SSO/MCP status statements. For current truth, inspect main source, AGENTS.md, app/las/README.md, app/las/mcp/README.md and current Cloudflare/GitHub configuration. Do not treat historical “pending” items as live blockers without re-verification.

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

1. [LAS PR #1](https://github.com/EsotericVerse/lunarcus/pull/1)：移入原 Auth/SSO Worker（原 Cloudflare script `auth`；2026-11-16 使用者已將實際 Worker 改名為 `lunarcus`，網域不變）、Extension 原始碼與圖示、MCP 原始碼快照、IPA 手動流程。減少 LAS 直接套件依賴，使用 `pg`／Kysely／Better Auth／ZenStack。
2. [LAS PR #2](https://github.com/EsotericVerse/lunarcus/pull/2)：明確定義 `loc/lrs/las` 所有權；本次再升級為 `lo3r@loc/lo3r@lrs/lo3r@las`。
3. [LAS PR #3](https://github.com/EsotericVerse/lunarcus/pull/3)：獨立 `app/las/mcp/`、`services/workers/las-mcp/`，使用 `app/las/mcp/loc-mapping.mjs` 向 LOC 固定 API 傳遞有 OAuth Bearer 的請求。MCP 不直接引用 LOC 業務庫；新增手動、**無正式網域 Route** 的 Wrangler workflow。Extension 整篇 ChatGPT 歷史擷取改為逐段捲動與去重，模擬 9 則 DOM、80 則完整對話的測試通過。
4. [LAS PR #4](https://github.com/EsotericVerse/lunarcus/pull/4)：清除 **LAS Repo** 內 23 個過時 `app/loc/mcp/*` 快照（**不刪 LOC 原始資料**），正式命名空間、完整分工、IPA 在 guard 與 build 採同一 LOC commit、ISR 現況交接、模組邊界測試。當前 PR 分支 `chore/las-repo-cleanup-ipa-isr-20261116`。CI: [run 43806631002](https://github.com/EsotericVerse/lunarcus/actions/runs/43806631002) 通過：npm 安裝、Auth／Extension 語法與擷取測試、MCP 合約測試、命名與打包契約檢查、兩個 Worker dry-run。

5. [LAS PR #5](https://github.com/EsotericVerse/lunarcus/pull/5)：修復 IPA Guard 的 Bash `printf` 輸出錯接，確實產生 `version`、`base_version`、`ipa_name`、`release_tag`、`loc_sha` 五項；新增執行真實 shell 的回歸測試，CI [run 43807796925](https://github.com/EsotericVerse/lunarcus/actions/runs/43807796925) 通過，合併 commit `d1d799d9b23b2fa668673fbb03dda345baafd103`。**只驗證 Guard 輸出，並非已完成 IPA 實機建置**。
6. [LAS PR #6](https://github.com/EsotericVerse/lunarcus/pull/6)：正式將 LOC 固定 API／Data Mapping 搬至 `app/las/tunnel/loc-mapping.mjs`；MCP 原路徑改為 re-export 保持介面相容。新增跨目錄功能身分檢查、建構語法驗證及 tunnel CI path。CI [run 43808108562](https://github.com/EsotericVerse/lunarcus/actions/runs/43808108562) 通過。未引入 CMS SQL 引擎、沒有改 Cloudflare 路由。

7. [LAS PR #7](https://github.com/EsotericVerse/lunarcus/pull/7)：配合使用者已完成的 Cloudflare Worker script 改名 `auth` → `lunarcus`，同步修正 Wrangler、部署前契約檢查與文件；**網域、OIDC issuer、Secrets 名稱完全不變**。CI 通過。
8. [LAS PR #8](https://github.com/EsotericVerse/lunarcus/pull/8)：新增 **實際執行** LAS MCP Worker HTTP 入口的回歸測試（metadata、未授權 401、主機/路徑、Cookie 與 Host header 隔離、固定代理、CORS）；GitHub Actions 驗證通過，合併 commit `03984328959fd035af43b7310b3b9d6561ac55ef`。Cloudflare 額外 Preview Build Check 曾失敗，屬於獨立 Build Trigger 設定，不是此套 Node 測試失敗。
9. [LAS PR #9](https://github.com/EsotericVerse/lunarcus/pull/9)：維持**唯一手動 IPA Workflow**，新增可選 `lrs_commit`（40 字元固定 SHA）的 LRS 原始美術素材實體交付；逐項 SHA-256、67 卡、9 群組圖與路徑/衝突檢查；未指定則不觸發 LRS checkout，完全保留舊流程。GitHub Actions 核心測試通過，合併 commit `7ac498a90aa7367bd22bbff2f0057fd5de924f89`。沒有實際產生 IPA、沒有包含 LRS 尚未完成的完整特效/遊戲原生整合。

## LOC 配套 API 已合併、已部署（仍需真實授權驗收）

[LOC PR #1728](https://github.com/EsotericVerse/lunacodex/pull/1728) 已合併至 LOC `main`：`dbf6c51f1bc8110c8c0341a1f5b742254e28b188`。原來的 `/api/loc-native` 維持，新增固定操作的 `/api/las-native`；OAuth、`api.manage`、Galaxy Z-Model 與 SQL 都由 LOC 負責。Cloudflare Pages `loc` 正式部署 `40a83408-f5cd-46b0-879e-9f9a609fd61c` 的 commit 為該 SHA，部署 `deploy` 階段回報 **success**（2026-11-16）。**仍未證實真實 Bearer 的 UserInfo、Scope、MCP tool、SSE、讀寫實際完成。** LOC 自動部署及 Guard 原則保持原樣，勿在其他流程新增不必要的主幹建置。

## 尚未完成、不可假稱完成

- **正式 Auth deployment**：LAS Auth 獨立 bundle dry-run 通過；Cloudflare 現行 Worker script 為 `lunarcus`，綁定原 `auth.lo3rwang.cc`，尚未以 LAS 新 Repo 完成正式部署與端到端驗收；新 Repo `CLOUDFLARE_API_TOKEN` Actions Secret 的可用性尚未核實。舊 SSO 問題不會因原始碼搬移自動修復。
- **MCP 正式切換**：目前 `mcp.lo3rwang.cc` 在 LOC Pages 上。LAS Worker 名稱 `las-mcp`，`workers_dev=false` 且 `routes=[]`，**不應搶接現有網域**。驗證 OAuth audience/Issuer、UserInfo、Scope 讀寫、MCP tool 與 SSE、Provider OAuth callback、Extension Queue receipts 後，才可安排可立即回退的部署所有權切換。
- **Extension 實機**：80 則測試是模擬，非真實 Chrome/ChatGPT 對話驗收；舊 extension profile 仍可能指向 LOC 目錄。切換 unpacked extension 的工作目錄時不應更換 Extension ID 或清除 IndexedDB Queue。
- **IPA**：LAS 原有 Capacitor/Xcode 手動 Workflow 已可選擇固定 LRS SHA，將 LRS art-only 原始素材以實體檔案形式併入同一 IPA export。驗證只涵蓋檔案契約/模擬測試；**尚未實際建 IPA，亦未驗收完整 Effekseer、WASM、遊戲引擎原生素材**。LRS PR #1 仍是 Draft，不得把 Web URL-only 當 iOS 素材。
- **APK**：`las:apk` 有正式子模組規劃，但沒有實作、建置或簽署流程，不能宣稱完成。
- **ISR**：Cloudflare 既有 `loc-isr` Worker 在 `isr.lo3rwang.cc`，其執行碼是大型已編譯 OpenNext Worker。LOC 目前程式庫未找到它對應的完整可信原始碼；**不要從線上壓縮產物逆推源碼或把大型 Next bundle 放進 `lunarcus` Auth Worker**。ISR 保留線上不動，預設關閉，待可信 source 復原再獨立建置／切換。

## 多線並行接續門檻（2026-11-16）

- **LOC 線（其他 Agent 可獨立處理）**：保持 `dbf6c51` 以上的主幹變更，先驗證 `/api/las-native` OAuth Bearer、固定操作及 `api.manage`，勿移走 Galaxy、SQL Portable 或更動正式網域。
- **LAS Auth/MCP 線**：`lunarcus` 才是現有 Auth Worker script，`auth.lo3rwang.cc` 是不變的服務網域。`las-mcp` 尚未接管 `mcp.lo3rwang.cc`；只可在無正式 route 的情況下進行安全分階段驗證。正式切換之前完成 SSO/UserInfo、tools、SSE、Provider callback 與 Extension Queue receipts 驗收。
- **LRS 與 IPA 線**：LRS PR #1 在 `work/rune-artifact-contract` → `migration/independent-deploy` 仍為 Draft。Web 使用獨立 LRS URL；iOS 在 LAS 單一 IPA 流程下指定不可變 LRS SHA 並帶入真實素材。LAS `lrs_commit` 未指定時保留目前的既有資源交付。等 LRS 準備好完整 Effects/VFX 交付，再做真實 IPA 驗收。
- **Cloudflare Build Trigger 異常**：LAS 額外 Workers Builds Check 曾自動執行 `npx wrangler preview`，因根目錄沒有 `previews` 配置而失敗；GitHub Actions 自身的 LAS 檢查是成功的。**不得為掩蓋這個外部 Build Trigger 錯誤而擅自開啟 preview 或修改正式 Worker route**。此項待 Cloudflare Build Trigger 擁有者確認。
- **低優先**：ISR 最終歸 LAS、獨立且預設停用；APK 尚未實作。兩項不阻塞 Auth/MCP/LRS 的主要驗收。

## Windows 本機

`C:\GitHub\lunacodex`、`C:\GitHub\lunarunes`、`C:\GitHub\lunarcus` 均已建立。先前兩個新 Repo 由 sparse clone 初始化。

```powershell
git -C C:\GitHub\lunarcus pull --ff-only origin main
git -C C:\GitHub\lunarcus sparse-checkout disable
```

其他 Agent 正在移動 LRS；先從最新 Repo 版本確認實際檔案，再決定完整檢出，不要再度從 LOC 下載 7GB 符文生成素材。

## 重要安全原則

絕不 bulk revert、不覆蓋其他 Agents 更動、不刪仍在服務的 LOC 原始碼、不任意更換 Cloudflare 網域、OAuth 身分或 Secret、不把 SQL 及身份驗證 grant 混用。GitHub Actions 綠燈僅代表所列測試通過，**不等於線上 OAuth/SSO、MCP、IPA、ISR 驗收完成**。
