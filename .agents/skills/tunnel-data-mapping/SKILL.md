---
name: tunnel-data-mapping
description: "LAS CMS／跨系統 Data Mapping 的契約轉換與兼容檢查；預設不部署 Worker、不要求 LOC 重建。"
---

# LAS Tunnel／CMS Data Mapping

`las:tunnel` 只管理**跨系統資料契約**：來源欄位、schema、nullable、時間／編碼、canonical envelope、固定 API 目的端與版本。入口 `app/las/tunnel/loc-mapping.mjs`；`app/las/mcp/loc-mapping.mjs` 是兼容輸出。不要在 LAS 建立 LOC 的 Galaxy、Z-Model、SQL 方言或 Scope 授權副本。

- 變更 Mapping 預設為 **資料契約／客戶端層**，不應單獨觸發 `lunarcus` Worker 建置，也不直接通知 LOC 部署。只有**已使用於發行服務、確實改變 LOC 依賴的公開介面**時，才走 LAS 部署成功後的 impact 判定。
- 只接受經允許的固定服務／operation，拒絕任意 URL、SQL、資料庫憑證與 ACL 的跨界傳遞。LAS 可驗證 token，LOC 保有最終資料權限與可攜式 SQL 引擎。
- 測試：映射的 round-trip、缺欄、拒絕範圍、UID、版本兼容、冪等與錯誤回覆。必要時再檢查 MCP router 的實際消費方；不要為了「一同修好」擴大 LOC／LRS 變更。
