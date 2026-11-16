---
name: superpowers
description: "LAS 開發偵錯、最小實作、主線驗收、協同作業與可追查的交付。"
---

# superpowers — LunArcus / LAS

先從 LAS 的 `main`、當前任務所屬模組、實際原始碼開始，**不能拿 LOC 記憶或舊摘要替代 LAS 現況**。用一個主 Skill，真的遇到協定細節再按需打開一份專用 Skill。

## 閉環
1. 先證明故障在哪一層，再修那個邊界；不以主觀猜測替換設定。
2. 自行執行必要的 syntax、contract、HTTP 與 artifact check；不把 CI 成功誤稱 UI/SSO 真實成功。
3. 只修改 LAS 及本次授權範圍；保留其他 Agent 的最新主線、版本與工作。
4. 可核對的 PR、commit、主線狀態和實機限制逐項交代；不能把需要使用者幫忙當成常態。
5. 遇到三次相同失敗停止原假設，改用不同觀察證據；不可無限部署或要求使用者重填 Secret。

參考流程原理：https://github.com/obra/superpowers；參考不代表已安裝插件執行環境。
