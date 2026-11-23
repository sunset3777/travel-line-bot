# 旅行社 LINE BOT

歐爵旅行社 LINE 智慧客服（Demo 階段）。專案背景與設計決定見 [docs/project-context.md](docs/project-context.md)。

## 需求

- Node.js 22（見 `.nvmrc`）
- pnpm 10（`corepack enable` 後會自動使用 `package.json` 指定的版本）
- Docker（本機資料庫）

## 第一次設定

1. 安裝套件

   ```bash
   pnpm install
   ```

2. 建立**測試用**的 LINE 官方帳號並啟用 Messaging API
   1. 到 [LINE Official Account Manager](https://manager.line.biz/) 登入，按「建立新帳號」，名稱例如「歐爵旅行社（測試）」。
   2. 進入帳號 → 右上「設定」→ 左邊「Messaging API」→「啟用 Messaging API」，選或新建一個提供者（Provider）。
      綁定後無法更換提供者；之後的 LIFF channel 也要建在同一個提供者底下，旅客的 userId 才會一致。
   3. 取得兩個值：
      - **Channel secret**：OA Manager 的「Messaging API」頁面就有，或 [LINE Developers Console](https://developers.line.biz/console/) → Basic settings
      - **Channel access token**：LINE Developers Console → 該 channel →「Messaging API」分頁最下面，按 Issue 產生

3. 建立環境變數檔（注意是 `.env`，不是 `.env.example`；`.env.example` 會被提交到 Git）

   ```bash
   cp .env.example .env                      # macOS / Linux / Git Bash
   Copy-Item .env.example .env               # Windows PowerShell
   ```

   在 `.env` 填入上一步的兩個值。

4. 啟動本機資料庫（M1 的 echo bot 還用不到，M2 開始需要；需先安裝並開啟 Docker Desktop）

   ```bash
   pnpm db:up
   ```

## 跑起 echo bot

```bash
pnpm dev
```

看到 `Bot 啟動：http://localhost:3000（Webhook 路徑：/webhook）` 就是成功。LINE 需要公開的 HTTPS 網址，另開一個終端機：

```bash
# 需先安裝 cloudflared（Windows：winget install --id Cloudflare.cloudflared）
pnpm tunnel
```

`pnpm tunnel` 會啟動 Cloudflare 快速 Tunnel，並用 `.env` 的 token 自動把新網址（加上 `/webhook`）設成 LINE 的 Webhook URL、完成驗證。看到 `✅ Webhook 已更新並驗證成功` 就可以用了。快速 Tunnel 每次重開網址都會變，所以每次開發都跑這個指令就好，不用進 LINE 後台改網址。詳見 [docs/specs/dev-tunnel.md](docs/specs/dev-tunnel.md)。

> Windows 剛裝完 pnpm 或 cloudflared 出現「無法辨識」或「找不到 cloudflared」：把 VS Code / 終端機整個關掉重開，
> 或在目前視窗執行
> `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")`；
> 也可以在 `.env` 設定 `CLOUDFLARED_BIN` 為 cloudflared 的完整路徑。

第一次設定時，還要到 LINE Developers Console 的 Messaging API 分頁開啟 **Use webhook**。

接著在 LINE Official Account Manager →「設定」→「回應設定」：

| 項目               | 設定     | 原因                                                      |
| ------------------ | -------- | --------------------------------------------------------- |
| 聊天               | 開       | 之後轉真人客服要用（可與 Webhook 同時開）                 |
| 加入好友的歡迎訊息 | 關       | Bot 自己會送歡迎訊息，開著會重複                          |
| Webhook            | 開       | 訊息才會送到 Bot                                          |
| 回應時間           | 關       | 上下班由 Bot 判斷；開著的話非回應時間會跑 LINE 的自動回應 |
| 回應方式           | 手動聊天 | 不要選「＋自動回應訊息」，不然會跟 Bot 重複回覆           |

用手機掃 LINE Developers Console「Messaging API」分頁上的 QR code 加好友，會收到 Bot 的歡迎訊息；傳任何文字，Bot 會原樣回覆。

## 檢查

```bash
pnpm format:check   # Prettier（pnpm format 自動修正）
pnpm lint           # ESLint（pnpm lint:fix 自動修正）
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions（`.github/workflows/ci.yml`）在每個 PR 和 main 都會跑這些檢查（另含 `pnpm audit` 安全檢查）。

本機 commit 時 Husky 會跑 lint-staged（ESLint + Prettier），並用 commitlint 檢查訊息格式（Conventional Commits，例如 `feat: 新增行程查詢`）。

## 健康檢查

`GET /health` 回傳 `{"ok":true}`。
