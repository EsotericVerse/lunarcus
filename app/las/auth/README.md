# LAS Auth — Better Auth / OAuth / Session

`app/las/auth/` 維護 LAS 的認證與身分資料，不管理 LOC 的 Galaxy、Scope 業務權限，也不接管 LRS 的符文資料。公開 issuer 為 `https://auth.lo3rwang.cc`，同一個 LAS `lunarcus` Worker 另按主機名稱將 `mcp.lo3rwang.cc` 請求交給 MCP 模組；兩者不屬於 LOC 或 LRS 的 Routing Table。

## 單一認證與資料來源

- 目前使用 Google OAuth 登入、Better Auth 與既有 Session；**Cloudflare Access 上游 SSO 已移除**，不可從歷史交接重建。
- 只使用既有 `LAS_DATABASE_URL` PostgreSQL 連線及 `public.las_*` 資料表。實際映射見 `rainbow-tables.mjs`、`rainbow-zmodel.mjs`，存取見 `auth.mjs`、`pg-driver.mjs`。不建立第二套 D1／KV／R2／Durable Object 儲存，不執行自動 Migration、建表、修改 RLS 或隱性授權。
- LOC Web 的 `api.manage` 是獨立的業務權限。LAS 身分、LAS Session、OAuth 授權與 LOC 文章的編輯權限不可混為一談；跨系統權限須走現有的固定契約。
- 所有 Secret 與資料庫連線資訊只從環境取得，錯誤與日誌不得輸出原始憑證。

## Session、管理權限與流量

- Session 的資料來源為 PostgreSQL；簽名 Cookie Cache 目前為 30 分鐘。特權 Auth 管理操作以現有程式的即時 Session／角色檢查為準，不能只憑 Cookie Cache 授予權限。
- Admin 只能依程式已設權限執行管理操作，不能藉 Auth Admin 權限取得 LOC Scope 權限。具體角色、允許操作與例外在 `auth.mjs`。
- `auth-qos.mjs` 集中定義 Better Auth 的原生頻率規則與 JWKS 例外；Karaul 的 PELT 目前僅提供觀測訊號，**不額外收緊每個端點的頻率限制**。不要把早期版本中更嚴格的處置說明當作現行行為。
- JWKS 正常輪換、金鑰撤銷及 Session 失效是不同事件；單純請求量上升不應觸發整個 issuer 的簽名金鑰失效。

## 維護與驗證

`auth.mjs` 是 Better Auth 與官方 ZenStack adapter 的整合來源；`auth-qos.mjs` 是現行頻率規則，`rainbow-zmodel.mjs` 是現有實體欄位映射。這些契約應跟著程式碼及測試維護，**不在 README 重複逐欄定義**。

修改 Auth 時先執行 `npm run check:auth`；需要驗證 Worker bundle 時可執行 `npm run auth:dry-run`（不發布）。再按修改範圍檢查實際 OAuth 登入、Session、Consent、JWKS、管理權限及 MCP 下游身分銜接。語法、CI、Worker 部署與真實登入成功是不同的驗證層級。

舊版遷移過程、供應商比較、設定試誤與逐版結果已封存於私人 Slack 工程紀錄和 Git Commit；它們不是現行設定的替代來源。
