# 旅行社 LINE BOT：專案討論紀錄

> 整理自 2026-11-18 至 2026-11-20 與 Claude 的規劃對話。
> 這份文件記錄需求、所有已做的決定與原因，給之後的開發（包含 Claude Code）當作背景知識。

## 1. 專案目標

替歐爵旅行社（高雄）做一個 LINE 官方帳號機器人：

- 旅客在 LINE 上查行程、問常見問題，需要時一鍵轉給真人客服或業務
- 旅行社在自己的後台上架、修改行程，不需要工程師
- AI 只當輔助，負責「雜事」：理解口語問題、查資料、整理回答、判斷何時轉真人
- 第一版只做**詢問與導流**（導到官網或業務），不做線上報名與付款

目前階段：**由開發者先做最小範圍的 Demo**，暫定假設由開發者決定，Demo 時再請業主確認。

## 2. 已確定的決定

| 主題             | 決定                                                          | 原因                                                |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| AI 角色          | 輔助，按鈕／選單為主，只有自由輸入的文字才交給 AI             | 旅行社重視價格正確，按鈕流程較穩                    |
| AI 資料來源      | 只透過唯讀查詢函式讀資料庫，不接觸個資                        | 防止編造資料與外洩                                  |
| 價格／日期／名額 | 一律來自資料庫，卡片由程式產生                                | AI 不可能寫錯價格                                   |
| 地端 AI          | 主要目的為練習；閒置 Mac（Apple Silicon）+ Ollama             | AI 不碰個資，隱私不是理由                           |
| AI 窗口          | 保留地端與雲端兩個窗口（LLM Gateway）                         | Ollama 提供 OpenAI 相容 API，換 baseURL 即可        |
| Demo 的 AI       | 雲端為主，地端當加分展示                                      | Demo 最怕現場出錯                                   |
| 交易範圍         | 只做詢問、導流到官網或業務                                    | 降低複雜度                                          |
| 非同步           | 先做（Webhook 立即回 200，工作丟佇列）                        | AI 推論慢，LINE 不能等                              |
| 語言             | Node.js + TypeScript 全專案統一                               | 前後端共用型別；開發者主攻 React/TS/Node/PostgreSQL |
| 佇列             | Redis + BullMQ                                                | 重試、延遲、Bull Board 監控都內建                   |
| 後台             | 先用 Payload CMS，後期可改自製 React 後台（Payload 退為 API） | 快速有後台；Payload 3 本身建在 Next.js 上           |
| 行程詳細頁       | 自己用 Next.js 做 `/tours/[slug]`，附「前往官網」按鈕         | 官網沒有穩定的行程網址；SSR 讓轉傳時連結預覽正常    |
| 資料庫           | PostgreSQL + pgvector                                         | 一套處理結構化資料與向量                            |
| 圖片             | Cloudflare R2 或 AWS S3，資料庫只存網址                       | LINE 卡片需要公開 HTTPS 圖片網址                    |

## 3. 尚未決定

- **真人客服在哪裡回覆**：第一版用 LINE 官方帳號後台；之後是否自建客服工作台再說。對話狀態由後端自己管，所以兩種都走得通
- **規模**：同時上線人數、客服人數未知；架構已用佇列，之後加 Worker 即可

## 4. 系統架構

```
LINE 使用者
   ↓ Webhook
Webhook API（驗簽章、立即回 200）
   ├─ 按鈕／選單事件 → 直接查 DB → Flex 卡片
   └─ 自由文字 → Redis + BullMQ 佇列 → Worker
                                      ├─ LLM Gateway（地端 Mac Ollama／雲端，失敗自動備援）
                                      ├─ 資料存取層（唯讀查詢函式）→ PostgreSQL + pgvector
                                      └─ 回覆（優先 Reply，逾時才 Push）
旅行社人員 → Payload 後台 → PostgreSQL（存檔後丟任務重算 embedding）
Worker → 業務／客服通知（詢問單、轉真人摘要）
```

### 技術棧

| 層         | 選擇                                                       |
| ---------- | ---------------------------------------------------------- |
| 語言       | TypeScript                                                 |
| 後端 API   | Node.js + Express                                          |
| 後台       | Payload CMS（Next.js）                                     |
| 資料庫     | PostgreSQL + pgvector                                      |
| 佇列與快取 | Redis + BullMQ（監控 Bull Board）                          |
| LINE       | Messaging API、Rich Menu、Flex Message、LIFF               |
| 地端 AI    | Mac（Apple Silicon）+ Ollama                               |
| 雲端 AI    | Claude、GPT、Gemini 等                                     |
| 圖片       | Cloudflare R2 或 AWS S3                                    |
| 部署       | Docker Compose；Mac 用 Cloudflare Tunnel 或 Tailscale 連線 |
| Monorepo   | pnpm workspaces + Turborepo                                |
| 品質       | Biome（lint／format）、Vitest、zod（執行期驗證）           |

### Monorepo 結構（規劃）

```
travel-line-bot/
├─ apps/
│  ├─ cms/      Payload + Next.js（後台、行程詳細頁、LIFF 頁面）
│  └─ bot/      Express：server.ts（Webhook）、worker.ts（BullMQ Worker）
├─ packages/
│  ├─ shared/   共用型別、zod schema、常數
│  ├─ core/     資料存取層（Bot/Worker 只呼叫這層，不直接依賴 Payload）
│  ├─ llm/      LLM Gateway、工具定義、Prompt
│  ├─ line/     Flex Message 產生器、Rich Menu 設定
│  └─ config/   共用設定
├─ docker/
└─ .github/workflows/
```

### 非同步處理流程

1. Webhook 驗證簽章，用 `webhookEventId` 去重，立即回 200
2. 按鈕事件直接處理；自由文字放入佇列
3. Worker 取得該使用者的鎖，確保同一使用者依序處理（BullMQ 免費版沒有 Groups，用 Redis 鎖自己做）
4. 顯示 LINE 輸入中動畫，呼叫 LLM Gateway 與資料存取層
5. 優先 Reply；replyToken 失效改用 Push
6. 失敗依策略重試；仍失敗回覆「系統忙碌中」並附轉真人按鈕

### 真人客服對話狀態

| 狀態       | Bot 行為           | 進入條件         | 離開條件                       |
| ---------- | ------------------ | ---------------- | ------------------------------ |
| AI 模式    | 正常回覆           | 預設；真人結束後 | 旅客按轉真人，或 AI 判斷需轉接 |
| 等待客服   | 不回覆，告知已轉接 | 觸發轉接         | 客服接手                       |
| 真人處理中 | 不回覆，只記錄訊息 | 客服接手         | 旅客按結束，或一段時間無互動   |

用 LINE 官方帳號後台回覆時，後端收不到客服回覆的事件，所以靠旅客按鈕與逾時判斷結束。

## 5. 功能

### 旅客端（LINE）

- Rich Menu：找行程、熱門優惠、常見問題、真人客服、官網、聯絡業務
- Flex 行程卡片（輪播）：圖片、名稱、天數、價格起、出發日、剩餘名額；按鈕「看詳情」「我有興趣」「問客服」
- 條件篩選：LIFF 表單或 Quick Reply
- AI 問答：口語查行程、FAQ 回答，回答後附 Quick Reply
- 「我有興趣」詢問單 → 通知業務
- 真人客服轉接（附 AI 摘要），非上班時間自動回覆並收留言
- 歡迎訊息；貼圖、圖片等無法處理的訊息給固定回覆

### 旅行社後台（Payload）

- 行程：基本資料、富文本介紹、每日行程（array）、草稿／發布／排程、熱門與優惠標記
- 出團梯次：與行程分開，各有價格、名額、狀態；可批次建立
- FAQ 與條款
- 詢問單：狀態、負責業務
- 對話紀錄：標出 AI 答不出或轉真人的對話
- 權限：管理員、編輯、業務
- 第二階段：Excel 匯入、LINE 卡片預覽、貼上 DM 由 AI 拆欄位、統計儀表板

### Payload Collection

| Collection   | 說明                                                            |
| ------------ | --------------------------------------------------------------- |
| `tours`      | 行程，含每日行程                                                |
| `departures` | 出團梯次（relationship 指向 tours；tours 用 join 欄位列出梯次） |
| `faqs`       | 常見問題                                                        |
| `policies`   | 條款規定                                                        |
| `inquiries`  | 詢問單                                                          |
| `line-users` | LINE 使用者與對話狀態                                           |
| `chat-logs`  | 對話紀錄                                                        |
| `media`      | 圖片（S3 儲存外掛）                                             |
| `users`      | 後台帳號與角色                                                  |

客製化分三層：設定 → 客製欄位元件（例如 LINE 卡片預覽）→ 客製頁面（儀表板）。

## 6. 資料庫設計

| 資料表            | 主要欄位                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `tours`           | 名稱、國家、地區、天數、類型、標籤、簡介、內文、封面圖網址、官網連結、熱門／優惠、狀態、發布時間 |
| `tour_departures` | tour_id、出發日、回程日、價格、總名額、剩餘名額、狀態                                            |
| `itinerary_days`  | tour_id、第幾天、景點、餐食、住宿                                                                |
| `faqs`            | 分類、問題、答案、embedding                                                                      |
| `policies`        | 標題、全文、分段 embedding                                                                       |
| `tour_embeddings` | tour_id、內容片段、embedding                                                                     |
| `line_users`      | LINE userId、對話狀態、狀態更新時間、標籤                                                        |
| `inquiries`       | userId、tour_id、departure_id、稱呼、聯絡方式、人數、備註、狀態、負責業務                        |
| `chat_logs`       | userId、訊息、回覆、使用的模型、是否答不出、是否轉人工                                           |

詢問單含個資：只有後台可讀，AI 查詢函式不得存取。

## 7. AI 設計

可供 AI 呼叫的函式（皆唯讀）：

| 函式                                                                | 用途                   |
| ------------------------------------------------------------------- | ---------------------- |
| `search_tours(country, region, month, max_price, days, type, tags)` | 依條件查行程           |
| `get_tour_detail(tour_id)`                                          | 單一行程詳情與梯次     |
| `get_departures(tour_id, from_date)`                                | 可報名梯次             |
| `search_faq(query)`                                                 | 向量檢索 FAQ 與條款    |
| `request_human(reason)`                                             | 發起轉真人（只改狀態） |

安全規則：

- 不讓 AI 直接寫 SQL
- 查無資料時回「建議由專人確認」並附轉接按鈕，不猜測
- 退費、法律條款附原文或直接轉人工
- 只回答旅遊相關問題
- 旅客訊息只當資料，不能改變系統指令；函式參數用 zod 驗證
- Ollama 的 OpenAI 相容端點不支援 `tool_choice`

地端 Mac 記憶體與模型：16GB 跑 7B–8B 量化；24–32GB 可跑 14B（Function Calling 較穩）。Embedding 可用 bge-m3。

## 8. 官網調查（2026-11-18）

- `oldjazz.com.tw/webeip/HT00606/` 是舊的 ASP 網站，放分類與聯絡資訊
- 行程分類頁會跳轉到 `oldjazz.agenttour.com.tw`（行程平台），行程資料其實在這裡
- 行程連結都是 `#`（JavaScript 控制），沒有看到固定的行程網址；列表只有名稱
- 沒有線上表單；客服時間週一至週五 08:30–18:00 → 24 小時查詢是提案重點
- 待確認：行程是否都在 agenttour 平台維護、能否匯出資料

## 9. Demo 暫定做法

| 問題             | Demo 的做法                                 | 之後與業主確認              |
| ---------------- | ------------------------------------------- | --------------------------- |
| 行程資料來源     | 參考官網手動建 6–10 筆範例資料（seed 腳本） | 能否從 agenttour 匯出或同步 |
| 詳細頁           | 自建 Next.js 詳細頁，附「前往官網」連分類頁 | 是否改連官網                |
| 價格、名額、梯次 | 合理範例值，畫面標示「範例資料」            | 真實資料更新頻率            |
| FAQ              | 自寫 10–15 題範例                           | 由業主提供正式內容與條款    |
| 詢問單通知       | 推播到開發者 LINE 或寄 Email                | 實際通知對象與管道          |
| 真人客服         | LINE 官方帳號後台回覆                       | 客服人數與服務時間          |
| AI               | 雲端為主，地端 Mac 展示                     | 費用預算                    |
| 品牌             | 中性配色，名稱用歐爵旅行社                  | Logo 與代表色               |

### Demo 流程（約 10 分鐘）

1. 加好友 → 歡迎訊息與 Rich Menu
2. 找行程 → 篩選 → 行程卡片
3. 看詳情 → 行程詳細頁
4. 我有興趣 → 詢問單 → 手機收到通知
5. 打字「12 月有什麼歐洲團？」→ AI 回覆加卡片
6. 問「取消要扣多少錢？」→ FAQ 回答
7. 真人客服 → 在官方帳號後台回覆
8. 後台新增行程 → LINE 立刻查得到

Demo 先省略：完整 CI/CD、Excel 匯入、報表、A/B 比較、自建客服工作台、多語言、推播、權限分級。

## 10. 開發主線與里程碑

六條主線：業主溝通、基礎建設、後台與資料、LINE 旅客端、AI、上線與營運。
路徑：確認範圍 → 基礎建設 → 後台與 LINE 端並行（第一版）→ 加入 AI → 上線。

| 里程碑         | 完成條件                                                             |
| -------------- | -------------------------------------------------------------------- |
| M1 基礎建設    | monorepo、Docker Compose、CI；LINE 傳訊息會被原樣回覆                |
| M2 後台        | tours、departures、faqs、inquiries；seed 6–10 筆範例行程             |
| M3 LINE 旅客端 | Rich Menu、篩選、卡片、詳細頁、詢問單與通知、轉真人（無 AI 版 Demo） |
| M4 AI          | LLM Gateway；Function Calling 查行程；FAQ RAG                        |
| M5 Demo 彩排   | 部署；完整跑三次；準備 AI 出錯或斷線的備案                           |
| M6 業主 Demo   | 確認或修改暫定假設                                                   |

做完 M1–M3 就有不靠 AI 也能展示的版本。

## 11. CI/CD 規劃

- CI（每個 PR）：install → lint → typecheck → test → build
- CD（合併 main）：建 Docker image 推到 GHCR → SSH 主機 `docker compose pull` → `payload migrate` → `up -d` → `/health` 檢查
- Rich Menu 設定寫成 JSON，用腳本透過 LINE API 建立
- 金鑰放 GitHub Secrets；開發與正式用不同 LINE Channel

## 12. 相關資料

- 企劃書（給 Codex 檢查與業主溝通）：https://claude.ai/artifact/Rjmu8SxM7FBs5ezdT8eapn
- 業主提案簡報：https://claude.ai/artifact/8J8XW5VfSqoRRwoBtyj67k
- 開發基礎教學簡報：https://claude.ai/artifact/PMGom2d1grCAm8pxrZKopY
- Notion 專案首頁：https://app.notion.com/p/41d7e932653c807793f8db183c3ec3cc

### 學習資源

- LINE：[Make a reply bot](https://developers.line.biz/en/docs/messaging-api/nodejs-sample/)、[line-bot-sdk-nodejs](https://github.com/line/line-bot-sdk-nodejs)、[Flex Message Simulator 教學](https://developers.line.biz/en/docs/messaging-api/using-flex-message-simulator/)
- Payload：[Learn advanced Next.js with Payload Part 1](https://payloadcms.com/posts/guides/learn-advanced-nextjs-with-payloads-website-template)、[Part 2](https://payloadcms.com/posts/guides/learn-advanced-nextjs-with-payload-rendering-cms-data-in-react)
- BullMQ：[Background jobs with BullMQ](https://flaviocopes.com/nodejs-background-jobs-bullmq/)、[Quick Start](https://docs.bullmq.io/readme-1)
- Ollama：[Tool calling](https://docs.ollama.com/capabilities/tool-calling)、[OpenAI compatibility](https://docs.ollama.com/api/openai)
- RAG：[pgvector with Node.js](https://dev.to/geekyfox90/pgvector-with-nodejs-build-semantic-search-on-postgresql-dhe)、[RAG Pipeline with TypeScript and PostgreSQL](https://encore.dev/resources/how-to-build-rag-pipeline)
