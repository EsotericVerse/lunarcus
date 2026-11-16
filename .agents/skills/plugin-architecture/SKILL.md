---
name: plugin-architecture
description: "LAS plugins 模組設計，Chrome Extension 與未來獨立 Plugin 的契約及交付。"
---

# plugin-architecture — LAS 專用能力

LAS 的 Chrome Extension 固定歸 `las:plugins`，原始碼路徑 `plugins/chrome/`；不存在另一個產品模組。插件對外顯示 **LunArcus**，目前公開 OAuth Client `lunarcus`；既有 Chromium Extension ID 是不同的技術識別。

- 每個 Plugin 必須明確定義入口、manifest/metadata、權限、可使用的 LAS API、打包方式、資料回執和實機測試。
- 不把 MCP 服務端、Auth Session、LOC 數據模型和 Browser Queue 合成同一個模組。
- Chrome 擷取資料經 LOC 既有 `/api/loc-native`；Provider OAuth 流程與短匯入分離。
- 其他插件僅在真正有使用情境時新增，不能為「插件」概念自動造任意 Script 執行框架。
- 先按 `chrome-extensions` 與 `oauth-oidc` 判斷瀏覽器限制，依 `protocol-testing` 做回歸測試。
