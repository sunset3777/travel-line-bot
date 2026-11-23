# AGENTS.md

給 Codex（與其他 AI 代理）看的專案說明。專案背景、指令與開發規則以 `CLAUDE.md` 和 `docs/project-context.md` 為準，這裡不重複，只補 Code Review 的規則。

- 回覆、review 留言一律用**繁體中文**。
- 開發方式：規格驅動（規格放 `docs/specs/`）＋ TDD（先寫會失敗的測試再實作）。
- 分支：GitLab Flow，`main` 受保護，所有改動走 PR＋CI（format:check、lint、typecheck、test、build）。

## Code Review Rules

格式、排版、import 順序交給 Prettier＋ESLint 與 CI，**不要**為這些留言。只標出會造成錯誤、資安、資料錯誤或違反下列規則的問題，每則留言說明「為什麼有問題」與「安全的改法」。

### 資料正確性（最高優先）

- 價格、日期、名額必須來自資料庫查詢結果；出現寫死的數值、或由 LLM 產生這些值，就標出來。
  安全改法：透過 `packages/core` 的唯讀查詢函式取值。
- Flex 卡片必須由程式組出；把 LLM 輸出直接塞進 Flex 訊息內容就標出來。

### AI 與資料存取

- LLM 只能呼叫唯讀查詢函式；給模型的工具若能寫入、能執行任意 SQL、或能讀到詢問單等個資，就標出來。
- 模型回傳的函式參數、環境變數、Webhook 內容都要先用 zod 驗證才使用；沒驗證就直接用的地方要標出來。
- Bot 與 Worker 只能透過 `packages/core` 讀資料，不可直接依賴 Payload 的資料表結構。

### LINE Webhook

- Webhook 路由之前不能套用 `express.json()`（簽章驗證需要原始 body）；簽章驗證被移除、繞過或順序錯誤要標出來。
- Webhook 要立即回 200，耗時工作丟 BullMQ；用 `webhookEventId` 當 jobId 去重；同一使用者的事件要依序處理。
- 優先用 Reply，replyToken 失效才改用 Push。

### 金鑰與設定

- 任何 Channel secret、access token、API key、資料庫密碼寫進程式碼、測試、文件或提交了 `.env`，一律標為最高嚴重度。
- 開發與正式環境不可共用同一個 LINE Channel 的設定。

### 測試與規格

- 新增或修改的純邏輯沒有對應的 Vitest 測試要標出來。
- 行為改變但 `docs/specs/` 的規格沒有同步更新要標出來。

### TypeScript／ESM

- 專案是 ESM＋`NodeNext`：相對 import 漏寫 `.js` 副檔名會在執行時壞掉，要標出來。
- 用 `any`、`as` 強制轉型或 `@ts-ignore` 繞過型別檢查、卻沒有說明原因的，要標出來。
