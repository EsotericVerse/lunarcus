---
name: sql
description: "LAS Auth 使用 PostgreSQL／Kysely／ZenStack 模型查詢；不擅改資料表或 LOC SQL Portable。"
---

# sql — LunArcus / LAS

LAS 擁有 `LAS_DATABASE_URL` 與既有 `las_*` Auth Table 的**應用存取**，資料庫規則由使用者管理。檢查 `app/las/auth/{pg-driver,rainbow-tables,rainbow-zmodel,auth}.mjs` 的實際 mapping。

- 先確認 modelName、實體表、主鍵、Session／OAuth 連結與查詢失敗點；RLS 已由使用者設定，不直接調整。
- ZenStack、Kysely、Zod 是程式實作工具；LAS 不因名稱相同就另建 LOC Galaxy model 或 MySQL/MSSQL dialect。
- `las:tunnel` 只做資料 mapping；不執行 CMS 任意 SQL，也不保管其資料庫帳密。
- 模型與查詢測試優先 `npm run check:auth`；任何 migration 或改庫須單獨授權。
