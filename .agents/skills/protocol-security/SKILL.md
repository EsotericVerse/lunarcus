---
name: protocol-security
description: "LAS MCP/OAuth/OIDC/HTTP/CORS/SSO security boundaries 與 token、錯誤遮罩。"
---

# protocol-security — LAS 專用能力

只處理 LAS 的入口與傳輸安全。

- OIDC：比對簽章／issuer／audience／nonce／state／PKCE、固定 redirect_uri，限制回傳錯誤資訊。Google OAuth 登入成功只代表 LAS Session，不是 LOC 的寫入 grant。
- MCP：Origin 驗證、JSON-RPC 錯誤、trusted resource、OAuth token binding、scope、tool input restrictions、GET/POST/SSE 版本行為。
- Plugin：Chrome Manifest 權限、content script 隔離、host permissions、OAuth token browser storage、錯誤診斷遮罩。
- Tunnel：無 arbitrary URL、database switch、SQL execution、混淆跨主體的認證與授權。
- Worker：不在 `/health` 或 `/admin` 公開 Secret、認證碼、SSO state；不要為快速偵錯打開匿名 admin。
- 使用負向測試證明拒絕請求，對外設定變更先取得明確同意。

參考：https://modelcontextprotocol.io/specification 、https://www.rfc-editor.org/rfc/rfc9700 。
