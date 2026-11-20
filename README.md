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

2. 到 [LINE Developers Console](https://developers.line.biz/console/) 建立一個**測試用**的 Messaging API channel，取得：
   - Basic settings → **Channel secret**
   - Messaging API → **Channel access token**（按 Issue 產生）

3. 建立環境變數檔

   ```bash
   cp .env.example .env
   ```

   填入上一步的兩個值。

4. 啟動本機資料庫（M1 的 echo bot 還用不到，M2 開始需要）

   ```bash
   pnpm db:up
   ```

## 跑起 echo bot

```bash
pnpm dev
```

Bot 會在 `http://localhost:3000` 啟動。LINE 需要公開的 HTTPS 網址，另開一個終端機：

```bash
# 需先安裝 cloudflared
cloudflared tunnel --url http://localhost:3000
```

把它給的 `https://xxxx.trycloudflare.com` 加上 `/webhook`，填到 LINE Developers Console 的 **Webhook URL**，按 Verify，並開啟 **Use webhook**。

另外在 LINE Official Account Manager 把「自動回應訊息」關掉，不然會跟 Bot 的回覆重複。

用手機加這個官方帳號好友，傳任何文字，Bot 會原樣回覆。

## 檢查

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions（`.github/workflows/ci.yml`）在每個 PR 和 main 都會跑這四項。

## 健康檢查

`GET /health` 回傳 `{"ok":true}`。
