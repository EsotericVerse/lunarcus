---
name: skill-creator
description: "LAS 專用 Skills 建立、安裝、更新及驗證；保留 LOC 同等基礎能力並深化 LAS。"
---

# skill-creator — LunArcus / LAS

LAS 應保留與 LOC 同名的 13 個通用頂層工作入口，同時具備 LAS 自己的 MCP、Auth、Plugin、Tunnel、Cloudflare 與 Native 專題。**不可只放 LOC 連結而假稱 LAS 已安裝**。

- 每份 Skill 都是 `.agents/skills/<slug>/SKILL.md`，包含有效 frontmatter `name`、`description` 和能落地的操作／驗證。
- 不因 npm 有十個依賴就做十個套件 Skill；專業領域、故障邊界、所需證據與測試確實不同才有獨立 Skill。
- `AGENTS.md` 是 LAS Agent 守則，不是搬運 LOC 的版面或 LRS 的規格。
- 版本化引用必須標明是「按需補充」，不允許假稱外部工具已安裝或技能有自動執行。
- 跑 `node scripts/check-las-agent-skills.mjs` 檢查每個入口，遇到缺漏先補齊。
