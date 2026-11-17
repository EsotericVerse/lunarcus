---
name: native-packaging
description: "LAS 與 LOC 所有權分工：LOC 負責 IPA／App 打包，LRS 提供原生素材；LAS 只維護 Auth／Plugins 與跨系統契約。"
---

# Native Packaging — LAS boundary, LOC-owned builds

**完整 App、IPA 打包、版本管理與裝置驗收歸 LOC（LunaCodex），不是 LAS。** 目前唯一手動 iOS 工作流在 `EsotericVerse/lunacodex/.github/workflows/ios-device-build.yml`。不要在 LAS 重新建立 IPA／APK workflow，不要因舊交接文件稱 `las:ipa` 而反轉分工。Android APK 尚未正式實作。

- LOC 打包時以固定 LRS SHA／校驗碼取得實體 Rune 圖像、Effekseer、WASM 與所需 UI 素材；Web URL-only 不能取代 IPA 檔案。
- LRS 擁有素材與遊戲引擎；LAS 擁有 Auth、SSO、OAuth、MCP、Plugins、Tunnel。三個 Repo 不互相覆寫檔案。
- LAS 只核對與自家 Extension、OAuth 和服務契約相關的 App 整合需求，不在此 Repository 生成、簽署或發布 App。
- Apple signing、憑證、裝置識別及發布權限不寫入程式碼或測試。
- 不得把 `npm run check:auth`、Worker dry-run 或 MCP CI 當成 IPA／APK 實機驗收。

若未來再次調整 App 所有權，需明確的跨 Repo 決策及對應的 LOC/LRS CI 與裝置測試，不能單憑 Agent Skill 或舊歷史快照推定改動。
