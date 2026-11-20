# 旅行社 LINE BOT

歐爵旅行社的 LINE 官方帳號機器人：旅客查行程、問 FAQ、轉真人客服；旅行社用 Payload 後台上架行程。目前在做**最小範圍 Demo**。

完整背景、所有決定與原因：`docs/project-context.md`（開始任何功能前先讀相關章節）。

## 指令

```bash
pnpm install
pnpm db:up          # 啟動 Postgres（pgvector）與 Redis
pnpm dev            # 開發模式
pnpm lint           # Biome
pnpm typecheck
pnpm test           # Vitest
pnpm build
```

提交前 `pnpm lint && pnpm typecheck && pnpm test` 都要通過（CI 會跑同樣的檢查）。

## 結構

- `apps/bot`：Express Webhook（`src/server.ts`）。之後加 `src/worker.ts`（BullMQ Worker）
- `apps/cms`：Payload + Next.js（尚未建立，M2）
- `packages/*`：shared、core（資料存取層）、llm（LLM Gateway）、line（Flex 卡片）— 依需要建立

## 規則

- **價格、日期、名額一律來自資料庫**；Flex 卡片由程式產生，不由 AI 生成
- AI 只能透過唯讀查詢函式取資料，不寫 SQL、不讀詢問單等個資
- 模型回傳的函式參數、環境變數、Webhook 內容都用 zod 驗證
- Bot 與 Worker 只透過 `packages/core` 讀資料，不直接依賴 Payload 的資料表結構；Payload hook 只呼叫自己的模組
- Webhook 立即回 200，慢的工作丟 BullMQ；用 `webhookEventId` 當 jobId 去重；同一使用者依序處理
- 優先 Reply，replyToken 失效才 Push
- Webhook 路由前面不能加 `express.json()`（簽章驗證需要原始 body）
- ESM + `NodeNext`：相對 import 要寫 `.js` 副檔名
- 純邏輯寫成純函式並附測試（參考 `apps/bot/src/handlers/buildReply.ts`）
- 金鑰只放 `.env`，不提交；開發與正式用不同 LINE Channel
- 程式註解與使用者看到的訊息用繁體中文
