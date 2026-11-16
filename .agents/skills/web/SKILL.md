---
name: web
description: "LAS Plugins/Chrome、Auth Worker HTTP、MCP Web transport 與前端行為開發入口。"
---

# web — LunArcus / LAS

Web/App 工作先判斷是否屬於 LAS Plugin UI、Auth HTTP 或 MCP transport。只查看相關檔案和 API 契約；LOC Next.js/PWA 及 LRS Web 不在 LAS 的直接修改範圍內。

- Chrome Extension：Manifest V3、Service Worker lifecycle、`chrome.identity.launchWebAuthFlow`、本機 OAuth bundle、IndexedDB Queue。
- Auth：Worker HTTP Response/CORS、well-known discovery、Cookie／Session。
- MCP：JSON-RPC／Streamable HTTP，按 negotiated protocol version 維持既有相容行為。
- 先跑 `npm run check:extension`、`npm run check:auth` 或 `npm run check:mcp` 中與變更對應的一項。
- 特定協定再用 `chrome-extensions`、`cloudflare-workers` 或 `mcp-transport`，不一次載入全部。
