---
name: media
description: "LAS Chrome Extension 介面圖像、ICON、動畫及 App 封裝所需媒體工作。"
---

# media — LunArcus / LAS

LAS 自有媒體包含 `plugins/chrome/assets` 與 icon；特效與符文原始素材歸 LRS，不在 LAS 編輯來源作品。

- 擷取、快取與打包時檢查格式、MIME、大小、授權、相對路徑，確保 Extensions Manifest V3 合規。
- Web 使用 LRS 已發布連結；iOS／Android 則由 LAS 消費 LRS **檔案輸出**，不可以 Web URL 取代 Native 的實體素材。
- 不自動安裝或預載音樂、Remotion、影片編碼器；按具體製作需求選工具。
