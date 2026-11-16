---
name: superpowers
description: "Optional LAS engineering debug test delivery checklist, not mandatory plugin"
---

# superpowers

不必安裝 Superpowers Plugin 也能完成 LAS 工程；如果用戶移除 Superpowers，這個入口不是執行或交付依賴。只在任務需要流程指引時讀，不在每個回合／每次工具呼叫自動載入。

每次修復都循：查 LAS main → 真實復現 → 小修正 → 自己執行針對性測試 → 完整 CI → 合併 main → 比對正式部署 SHA／受影響功能。不能因測試或部署成功就說真實 SSO/Chrome/MCP 已成功；也不能反覆把同一測試丟給使用者。
