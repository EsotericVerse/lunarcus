---
name: native-packaging
description: "LAS 原生打包權責邊界：LOC 與 LRS 各自打包自己的 App／IPA；LAS 不打包 App。"
---

# Native Packaging — LAS 僅維護協定邊界

- **LOC** 自行建置 LOC App／IPA；現有手動流程在 `EsotericVerse/lunacodex/.github/workflows/ios-device-build.yml`。
- **LRS** 自行建置 LRS App／IPA；以 LRS 已合併的原生 Workflow、實際產物與裝置測試為準。尚在 PR 的流程不可宣稱正式可用。
- **LAS** 只負責 Auth、MCP、Plugins 與跨系統介面，不新增 IPA／APK 工作流。
- 跨 Repo 需要組合 App 時，另按明確版本、原始素材、SHA／checksum 契約整合，不讓例行部署彼此觸發；iOS 必須帶實體檔案，不能用 Web URL 代替。
- Signing 憑證不進原始碼；Syntax、Worker CI 與 IPA 實際裝置驗收分開判定。
