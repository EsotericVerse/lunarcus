---
name: media
description: "LAS Chrome imagery and native platform assets without LRS renderer dependency"
---

# media

媒體工作以 LAS Extension 的 Hero/Icon 和 iOS/Android 實體打包檔案為主。讀 `plugins/chrome/assets/` 與 `scripts/consume-lrs-ios-artifacts.mjs`，確認來源與 license、checksum、輸出路徑、target web/native，並測封裝後檔案存在。

LRS 擁有 Rune 的圖像、Effekseer、動態美術；LAS 只依版本固定交接的 Native 輸出組裝，不為此在 MCP/Auth 安裝 Three.js、Effekseer 或重跑整個動畫引擎。只有實際媒體製作時才採用相關外部技能。
