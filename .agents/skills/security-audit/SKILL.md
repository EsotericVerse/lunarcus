---
name: security-audit
description: "LAS scoped security review for Auth, MCP, Tunnel, Extension, supply chain"
---

# security-audit

工作前定義受信任邊界：Cloudflare Access SaaS/OIDC、Better Auth、JWT resource server、MCP tools/list/call、CMS Tunnel、Chrome Manifest V3 content scripts、OAuth PKCE、Queue token storage、native artifact signing。核對輸入驗證、最小授權、CORS、redirect、Server-only secrets、rate-limit、敏感日誌、第三方授權與 GitHub Actions token 權限。

不能因 OAuth 登入成功就賦予 MCP/DB 權限，不能為 SSO debug 刪掉 Access 保護或長期公開狀態探針。掃描結果需列可重現的攻擊邊界與改動前後的測試。只做被委託的檢查和局部修復，外部策略、DB、Secrets 寫入需要明確授權。
