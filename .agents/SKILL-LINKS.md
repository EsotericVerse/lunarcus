# LAS Skills 索引 — LOC 基礎能力全部具備，LAS 通道專業另外補強

本文件不是登入時的 Skill 自動載入清單，不會安裝 npm 套件。LAS 對照 LOC `main`（2026-11-16）的 13 個 Skill 類別，**每一個都已在 LAS `.agents/skills/` 有自己的 `SKILL.md`**。操作時只開任務相關入口，詳細參考可以查 LOC 固定來源或官方當前版本，不需要 Clone/Install LOC/LRS。

## LOC 共有的 13 個主 Skill（LAS 同等擁有）

- `auth`：身份、SSO、OAuth、OIDC／Session
- `deployment`：Cloudflare、Workers Builds、GitHub Actions、Preview
- `impeccable`：產品視覺品質、品牌色彩和質感
- `mcp-builder`：MCP Tool Builder／協定工具契約
- `media`：圖片／媒體交付
- `security-audit`：權限、Supply Chain 和 Web 安全
- `skill-creator`：建立／審查 Skills
- `sql`：PostgreSQL／ZenStack／Kysely
- `superpowers`：**按需**工程閉環入口，不是啟動依賴
- `ui-ux-pro-max`：介面、可用性與無障礙
- `visualization`：視覺化與狀態呈現
- `web`：網頁／瀏覽器應用
- `writing-guidelines`：說明文件與 UX 文字

原始 LOC 技能清單基準（只讀對照）：https://github.com/EsotericVerse/lunacodex/tree/67ea05214b6054d2d2e912093b0287e831318f15/.agents/skills 。完整歷史專題參考（只讀，按需取得）：https://github.com/EsotericVerse/lunacodex/blob/67ea05214b6054d2d2e912093b0287e831318f15/.agents/SKILL-LINKS.md 。

## LAS 額外主 Skill（通道與產品交付導向）

- `mcp-gateway`：Streamable HTTP、JSON-RPC、SSE、Tools／Provider、401/403、Role Grant。<https://modelcontextprotocol.io/specification/2025-11-25>
- `tunnel-mapping`：CMS／跨系統固定欄位 Data Mapping；實作以 `app/las/tunnel/` 為準
- `chrome-extension`：Manifest V3、Chrome Identity、PKCE、Queue、ZIP 產出。<https://developer.chrome.com/docs/extensions/>
- `native-packaging`：iOS IPA／Android APK 工程協調與已驗證 native assets；以 LAS Actions 為準
- `cloudflare-access`：Access SaaS／OIDC、Allow Policy／IdP 和正式 SSO 診斷。<https://developers.cloudflare.com/cloudflare-one/access-controls/>

**能力驗證：** `npm run check:skills` + LAS 現有 `check:auth`、`check:mcp`、`check:extension` 及 Worker dry-run。Skills 文件不代表 Runtime 套件已安裝、正式認證已通過，或 LAS 取得其他 Repo 的管理權。
