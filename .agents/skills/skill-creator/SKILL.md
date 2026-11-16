---
name: skill-creator
description: "Create, review, consolidate or evaluate LAS agent skill entrypoints"
---

# skill-creator

Skills 是解題能力不是 npm 套件清單。LAS 保留 LOC 的 13 個通用主技能入口，另提供 MCP Gateway、Tunnel/CMS Mapping、Chrome Extension、Native Packaging、Cloudflare Access 五個專用入口。先查相同能力是否已被既有 Skill 覆蓋，再決定新增或只加索引。

每個 Skill 必須有合法 YAML Front Matter 的 `name`／`description`、真實 LAS 程式碼入口、適用邊界、可靠驗收方式；不建立一堆宣告存在卻沒有用的空殼。執行 `npm run check:skills` 檢查數量與對應來源。需要外部 Creator 工具時先檢查版本、授權與輸出，不自動抓整包。
