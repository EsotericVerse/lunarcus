---
name: tunnel-data-mapping
description: "LAS 與其他 CMS/API 的 schema/field mapping、data transport、版本相容與拒絕任意 SQL。"
---

# tunnel-data-mapping — LAS 專用能力

`las:tunnel` 屬於 **跨主體的資料映射與傳輸契約**，不是 LOC 的 `loc:galaxy`、ZModel、SQL Dialect 或資料庫權限系統。從 `app/las/tunnel/loc-mapping.mjs` 與 `app/las/mcp/loc-mapping.mjs` 的兼容匯出開始。

- 建立輸入 schema → 欄位對映 → canonical envelope → 固定目的端的版本化 contract，不在 LAS 複製 CMS 的資料業務模型。
- 外部 CMS mapping 要有來源型別、nullable、欄位缺失、ID/UID、日期時區、編碼和錯誤語義的明確決策。
- 認證由 LAS `auth` 或正規服務 token 承擔，寫入權限仍由各目的服務判斷；傳輸成功不代表授權成功。
- 禁止把任意來源 URL、SQL 語句、資料庫帳密做成通用使用者參數；僅 allowlisted provider/operation。
- 確認 mapping round-trip、缺欄、拒絕範圍、冪等與版本變更；只測 `check:mcp` 相關檔案，不碰 LOC/LRS。
