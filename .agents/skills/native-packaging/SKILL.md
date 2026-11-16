---
name: native-packaging
description: "LAS las:ipa/las:apk 原生 App 打包、簽章、RLS 無關、LRS 實體素材輸入與裝置驗收。"
---

# native-packaging — LAS 專用能力

LAS 是唯一的 App Packaging 主體。現有 `.github/workflows/ios-device-build.yml` 是**既有 iOS/Capacitor 工作流**，`las:apk` 目前是規劃；不能因有 Android Skill 就聲稱 APK 已實作。

- iOS 打包要用實體 LRS 原創卡圖、Effekseer、WASM 與必要 UI 樣式，從固定版本 LRS artifact 取檔並核 SHA；不可用 Web 圖片 URL 代替 IPA 內容。
- LOC Web、LRS build 和 LAS IPA 是三條獨立責任鏈；LAS 在 native build 消費版本化輸出，不能去改它們的原始 Repo。
- 先執行 `node --test scripts/test-ipa-workflow-metadata.mjs scripts/test-las-ipa-runes.mjs`，再執行已授權的實際裝置建置。
- native signing、憑證、Apple/Android 發布權限不得寫進 Repo；未有實機 IPA/APK 就標記「尚未驗證」。
- 後續 Android APK 工作須獨立列出 Capacitor/Gradle、ABI、manifest、實體素材、簽署與 Smoke test 契約，不附帶修改既有 iOS 流程。

參考：https://capacitorjs.com/docs 及 https://developer.android.com/build 。
