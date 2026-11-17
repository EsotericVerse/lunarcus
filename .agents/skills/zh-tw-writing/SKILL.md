---
name: zh-tw-writing
description: "用台灣繁體中文撰寫對使用者可見的文字時使用，包括日常問答、OAuth／SSO／MCP 工程說明、Debug、進度與驗證、Chrome Extension UI／提示／錯誤訊息、正式文件、校對與翻譯；適用所有使用者可讀文字，不僅限正式文件。"
license: MIT
metadata:
  version: "1.2.0-las"
  upstream: "LCY000/zh-tw-writing@3f1386852688b59ea16b619a89b50b417586e8e4"
---

# zh-tw-writing — 繁體中文顯示與說明文字

此技能是**對使用者顯示的繁體中文文字基本原則**。原始 [zh-tw-writing v1.2.0](guide.md) 聚焦正式文件；本 Repo 依使用者要求擴大觸發範圍，涵蓋日常解說、OAuth／MCP／SSO／Protocol 問題、Debug、變更影響、驗證與交付，以及 Extension／Web UI 上的操作文案、提示與錯誤訊息。**原文中「一般對話不適用」的限制，在本專案由此入口取代**；其餘細節按需參考原文。

- 自然、準確、符合台灣習慣的繁體中文，保持 Protocol、OAuth／OIDC、Authentication／Authorization、Session、Client ID 等技術名詞的語意與中英文混排一致。
- 以完整語意串接前因後果，不把一句事情切成數段碎句，不用空泛 AI 套話、翻譯腔、制式口號或不必要的粗體標籤；有真正的比較或程序需求時可用清單與表格。
- 事實、推測、已驗證、未驗證分清楚；潤稿不添加原文沒有的內容，不改數字、日期、引用、狀態、權限或責任歸屬。
- 適度變化句型，標點以閱讀清晰為準，不拿報告的逗號比例硬套短答、Extension UI 或操作步驟。
- 文體規範不構成工具寫入授權，不自動改程式碼、Commit 訊息、引文、API 契約與錯誤碼。

**載入方式**：基本對話與 UI 文字只需要本檔；正式長文、英翻中、詞語選擇才按需讀取 [guide.md](guide.md) 及 `references/` 個別檔案。對有必要校對的本地 Markdown、HTML、文字檔，才執行 `python3 .agents/skills/zh-tw-writing/scripts/check_zh.py <檔案>`，依實際語境判斷提示；無須每次對話跑腳本。保留現有 LAS Protocol 專業 Skills 與其他文字審校能力，不擴大寫入或部署權限。

來源：<https://github.com/LCY000/zh-tw-writing/tree/3f1386852688b59ea16b619a89b50b417586e8e4/zh-tw-writing>，MIT 授權，著作權與授權條款見 [LICENSE](LICENSE)。
