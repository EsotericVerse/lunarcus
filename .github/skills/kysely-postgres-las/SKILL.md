---
name: kysely-postgres-las
description: "Review LAS Better Auth PostgreSQL/Kysely mapping and SQL contract without claiming LOC SQL Portable ownership."
---

# Kysely PostgreSQL / LAS

此 LAS 專用技能與 LOC 的 SQL Portable 主體**不是同一職責**。LAS 使用既有 PostgreSQL 連線、Kysely transport 與 ZenStack Auth mapping；不得因 Kysely 能連其他 dialect 就擅自引入 MySQL/MSSQL 或複製 LOC 的 SQL 轉換層。

1. 核對 `services/workers/lunarcus/pg-driver.mjs` 的連線生命週期、SSL、錯誤分類與原有 Data Mapper，嚴禁寫出 DB 連線字串。
2. 對照 `rainbow-tables.mjs`、`rainbow-zmodel.mjs` 中**現有實體 `las_*` Table** 與 Better Auth modelName；禁止用 generator 修改表格或 RLS。
3. Auth 登入、LAS OAuth Client 與 Session 走 Better Auth 原生插件，不能偷偷自創平行 SQL Session 讀寫。
4. `las:tunnel` 不借此取得 LOC 資料庫 driver 或跨 CMS 的任意 SQL 能力；Tunnel 僅映射固定已核准的資料欄位。
5. 執行 `npm run check:auth` 與對應的 Auth 模型測試；未實際 DB 讀寫就不得報資料庫驗收通過。
