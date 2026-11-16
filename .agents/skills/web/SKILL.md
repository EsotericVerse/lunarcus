---
name: web
description: "LAS Cloudflare Workers HTTP, browser APIs and Manifest V3 Extension integration"
---

# web

LAS Web 主要是 `plugins/chrome/` 的 Manifest V3 和 Cloudflare Workers，與 LOC Next.js 網站不同。檢查 `chrome.runtime`、`chrome.identity.launchWebAuthFlow`、`chrome.contextMenus`、`chrome.storage`、IndexedDB、service_worker、CORS/host permissions、PKCE callback、OAuth Discovery、Token Refresh 和 HTML Options 頁。

優先現有 web runtime 與專屬 `chrome-extension` Skill，不自動引入 Next.js/PWA/React、LRS 3D 或遊戲引擎。若牽涉 Auth Token 或 MCP Tool 的實際執行，分別使用 `auth`、`mcp-builder`。
