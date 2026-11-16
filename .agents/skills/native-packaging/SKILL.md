---
name: native-packaging
description: "LAS Apple IPA and Android APK delivery, pinned LOC and LRS native inputs"
---

# native-packaging

由 LAS `.github/workflows/ios-device-build.yml` 統一協調現有 iOS 打包；`las:apk` 是未來 Android 打包責任。LOC App 與 LRS 符文實體素材使用各自可核對的 Commit SHA、來源 manifest 與 checksum，LAS 不移交其主程式、Hero 或遊戲引擎所有權。

Web 只需外部連結時不能把圖片誤打包；Native iOS/Android 則必須包含真實圖片、WASM 等平台需要的檔案，不能只存 URL。驗證工作流 JSON/YAML、輸入 pinning、artifact integrity、簽名／未簽名與平台編譯／真機結果。不得新增第二條 IPA 流程或宣稱未實作的 APK 已可發行。
