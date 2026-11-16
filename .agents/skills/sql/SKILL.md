---
name: sql
description: "LAS PostgreSQL ZenStack Kysely and pinned loc-dialect SQL contract"
---

# sql

先讀 LAS 自己的 `services/workers/lunarcus/rainbow-zmodel.mjs`、`pg-driver.mjs`、`auth.mjs`、`vendor/loc-dialect/`。`loc:dialect` 僅提供驅動與 Kysely Dialect／連線生命周期；不提供其他 Repo 的表、SQL、Scope 或權限。LAS `LAS_DATABASE_URL`、TLS、模型、RLS、Session、OAuth Grant 各有獨立責任。

SQL 與 ORM 需用真實編譯結果、型別、連線關閉、錯誤重試測試，不因匯入 ZenStack/Kysely 就同時加裝 5 個技能和驅動。真正 migration／grant／DB reset 必須先得到針對資料變更的批准。現階段沒有安裝 MySQL/MSSQL 的實際 DB driver 就不得稱這些能連線。
