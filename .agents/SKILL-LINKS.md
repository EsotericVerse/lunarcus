# LAS 專用技能參考索引（不取代本地安裝）

主技能全部安裝在本 Repo 的 `.agents/skills/`；**以下為按需閱讀的官方參考**，不是部署腳本或開機預載清單。先看 LAS 現行主線原始碼、版本與本地 Skill，只有針對具體 API 認知不足才開一份參考，不跟隨連結批次載入全部。

| LAS 技能 | 官方補充來源 | 使用時機 |
| --- | --- | --- |
| `mcp-builder`、`mcp-transport` | https://modelcontextprotocol.io/specification | JSON-RPC、Streamable HTTP、SSE、version negotiation |
| `oauth-oidc` | https://www.rfc-editor.org/rfc/rfc7636 | PKCE S256 和授權碼流程 |
| `oauth-oidc` | https://www.rfc-editor.org/rfc/rfc8414 | OAuth 授權服務 metadata/discovery |
| `better-auth` | https://www.better-auth.com/docs/plugins/oauth-provider | LAS 公開 OAuth Provider 與 Client |
| `better-auth`、`auth` | https://www.better-auth.com/docs/plugins/sso | 上游 OIDC/SSO Provider |
| `cloudflare-workers` | https://developers.cloudflare.com/workers/ci-cd/builds/ | 原生 Workers Builds、Preview、部署 |
| `cloudflare-workers` | https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/ | 按變更路徑控制建置 |
| `observability` | https://developers.cloudflare.com/workers/observability/ | Worker errors、logs、trace |
| `chrome-extensions` | https://developer.chrome.com/docs/extensions/reference/api/identity | Chrome Extension identity OAuth |
| `chrome-extensions` | https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/ | Manifest V3 service worker 生命周期 |
| `native-packaging` | https://capacitorjs.com/docs | iOS／Android 原生打包 |
| `native-packaging` | https://developer.android.com/build | Android build（未啟用的未來工作） |
| `impeccable` | https://github.com/pbakaus/impeccable | LAS 品牌視覺精修 |
| `superpowers` | https://github.com/obra/superpowers | 偵錯到驗收流程方法 |
| `writing-guidelines` | https://github.com/vercel-labs/writing-guidelines | 說明文字與技術文件審校 |

**不要**把這份索引當成需要安裝外部插件的依賴清單。也不要從 LOC／LRS 的檔案路徑讀取 LAS 技能；本 Repo 的本地技能是單一基準。
