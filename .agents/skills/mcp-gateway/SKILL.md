---
name: mcp-gateway
description: "LAS MCP Gateway tools/resources/prompts、OAuth protected resources、QoS、Provider 連線和授權。"
---

# mcp-gateway — LAS 專用能力

LAS Gateway 入口 `app/las/mcp/{router,tool-contracts,gateway-qos,upstream-policy,upstream-providers,upstream-tools}.mjs`。服務側擁有**協定、認證與受約束的轉送**，LOC 擁有文章、資料庫、Scope 與業務規則。

1. 核對 tools/list、tools/call、resources、prompts、MCP protected-resource metadata，保留原有工具名稱與契約，不用 UI 文案作 API 版本識別。
2. OAuth 先驗證 issuer/audience/token，後續 LOC 自己決定業務授權；拒絕不能發生隱性 grant。
3. 只准固定 LOC API，避免 arbitrary URL、SQL、database selection 和 generic proxy。
4. Provider OAuth／儲存 token 限 LAS 的既有 vault，Extension 不保存上游 credentials；API Key/SSO 的用途不能互相替換。
5. 每個請求限制 body size、操作白名單、QoS、timeout、錯誤遮罩和 UID idempotency；不需新 KV/Queue 作 Auth Session。
6. MCP 正式域名尚未批准切換時，不能以干擾 LOC 的方式驗證 Gateway；採協定測試與可用的安全 staging。

測試：`npm run check:mcp`、`npm run mcp:dry-run`；測真實 SSE、token 和 LOC 回執才可宣稱端到端成功。
