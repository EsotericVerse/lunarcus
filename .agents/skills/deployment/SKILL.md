---
name: deployment
description: "LAS 單一 lunarcus Worker、Auth/MCP 合併部署與成功後選擇性通知 LOC GitHub Workflow。"
---

# LAS Deployment — 先部署、再選擇通知

**LAS 的正式目標只有 `lunarcus` Worker。** Root `wrangler.jsonc` 同時持有 `auth.lo3rwang.cc` 與 `mcp.lo3rwang.cc`；MCP 為同一 Worker 的模組，不存在第二條 LAS MCP Worker 發布管線。Cloudflare Workers Builds 依 Production／Preview watch paths 發布 Auth 或 MCP 真正有變更的版本，`plugins/chrome/**`、`app/las/tunnel/**`、Skills／文件不應無條件觸發 Worker。

## LAS → LOC 是部署成功後的可選決策
1. LAS 先完成自己的正式部署，核對 Worker version、網域與必要 Health／MCP contract。
2. LAS 分類變更：`skip`、`review`、`notify`。Plugins-only、CMS Data Mapping、Auth/MCP 內部調整原則上 `skip`；不向 LOC 發出請求。`review` 不自動發布 LOC。
3. 只有已發布且**真的影響 LOC 已引用契約**、經驗證符合條件的 `notify`，才由已驗證 GitHub OIDC 身分的 LAS Workflow 呼叫 `app/las/auth/loc-notification.mjs`，由 Cloudflare Worker 使用既有 `LOC_WORKFLOW_KEY` 通知 **LOC GitHub Workflow**；LOC 自己負責驗證與是否部署。相同發布版本不得重複通知。**不是**每次 LAS 變更都 POST LOC Pages Deploy Hook，更不是 LAS 直接發布 LOC。
4. 這條跨 Repo 通知與冪等鏈在尚未經正式驗收之前保持「未完成」，不得用成功的 LAS Build 冒充 LOC 已通知或已部署。

## 安全與成本
- 先讀 Cloudflare、GitHub 真實設定。Dry-run 只確認 bundle，與 Production／SSO／MCP 實機皆不同。
- 不為 Plugins／Skill／docs 修改觸發不必要的 Worker、LOC 或 LRS 編譯；不複製昂貴素材。
- 外部 Secret、Access、Binding、路由、Workers Builds 設定需列明差異、影響、復原方式與本次授權，不能自行改動。
- ISR 仍是關閉狀態、留在 `loc-isr`，未驗證前不合併進 Auth bundle，也不影響目前部署。

## ISR (separate, not a deployed LAS source directory)

The LAS ISR ownership plan is deferred and **off by default**. On 2026-11-16 the existing Cloudflare Worker was `loc-isr` at `isr.lo3rwang.cc` (`nodejs_compat`, compatibility date `2026-10-24`, bindings `ASSETS` and `WORKER_SELF_REFERENCE`). Its live OpenNext/Next.js script was a compiled artifact; the trusted original source was not available in the inspected LOC Git tree. Never infer source from a minified deployment or place the large Next bundle in the `lunarcus` Auth/MCP Worker. No Auth/SSO/LOC publication operation may require ISR. If original source is recovered later, do a separately approved and reversible deployment-ownership handoff without recreating keys, assets, or domains.
