---
name: tunnel-mapping
description: "LAS CMS tunnel data mapping, fixed authenticated transports and contract tests"
---

# tunnel-mapping

主要來源：`app/las/tunnel/loc-mapping.mjs`。LAS 只做系統之間的欄位、身份識別、來源 UID、時間、分頁、語系、媒體與傳輸契約的 Mapping，LOC/LRS 的資料權限及物理模型仍由各自服務負責。

新 CMS 接口需先確認可信目標 host/path、Bearer 交付、Schema 轉換、去重、錯誤回傳、可控重試、限流和診斷遮罩。禁止從客戶端任意指定 SQL、外部 URL、跨站 Session cookie 或私造平行權限資料庫。以純函數和模擬上游回應測成功／拒絕／異常，不為 Tunnel 功能自動引入整份 Galaxy Schema。
