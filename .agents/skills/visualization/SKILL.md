---
name: visualization
description: "LAS 管道、MCP/SSO 狀態、Provider 連線與匯入回執的視覺化。"
---

# visualization — LunArcus / LAS

LAS 的視覺化用途是**連線/管道狀態與操作可觀測性**，不是 LOC 時間長河、Galaxy 統計或 LRS 符文 3D。

- 依真實診斷資料呈現發生於 Access、Auth、Gateway、Tunnel、LOC API 哪個邊界，避免偽造即時連線或寫入成功。
- 介面狀態需區分 pending、成功、失敗、重試及授權過期；不把 Secret、token、完整私人日誌暴露在圖表。
- 新增圖型之前先確認 LAS 已有簡易狀態文字是否足夠，不為圖表引入不必要的重型相依。
