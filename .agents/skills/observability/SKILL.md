---
name: observability
description: "LAS Cloudflare Worker/SSO/MCP/Extension 診斷、Log、Tracing、Queue 與安全事件定位。"
---

# observability — LAS 專用能力

觀測分界：Chrome 啟動 → LAS OAuth discovery → Google OAuth → LAS Session → OAuth token → Gateway/Tunnel → LOC API；發生錯誤時找**第一個異常狀態**。（2026-11-17：原本中間還多一段 upstream Cloudflare Access，已移除。）

- Cloudflare Workers Logs/Traces 先看服務名稱、版本、時間窗、路由、HTTP status、可安全揭露的 error code；不可回傳 code、state、Token、完整 Cookie、Secret。
- Extension 的診斷紀錄與 pending Queue 數量是本機資料；不能把未取得 Chrome 實機證據的狀態宣稱已證實。
- 登入問題不重跑無限次登入。相同錯誤無差異時，回到 issuer、callback、Better Auth 與 token 的區別——LAS 登入只剩 Google OAuth 一條路，不用再分 Cloudflare Access 那一段。
- 針對效能與費用：只查必要的 Workers Builds、log sampling 與實際部署，不能為診斷新增全量輪詢或背景健康檢查。
- 參考：https://developers.cloudflare.com/workers/observability/ ，不擅自調整 Cloudflare 外部觀測設定。
