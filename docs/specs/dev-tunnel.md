# 規格：`pnpm tunnel` 自動更新 Webhook 網址

## 背景

開發時用 Cloudflare 快速 Tunnel（`trycloudflare.com`）讓 LINE 連到本機 Bot。
快速 Tunnel 每次啟動都會拿到新的隨機網址，原本要手動到 LINE Developers Console 改 Webhook URL 再按 Verify。

## 目標

執行 `pnpm tunnel` 就自動完成：啟動 Tunnel → 取得網址 → 設定 Webhook URL → 驗證。開發者不用進 LINE 後台。

## 行為

1. 啟動 `cloudflared tunnel --url http://localhost:<PORT>`（`PORT` 來自 `.env`，預設 3000）。
   - 執行檔預設 `cloudflared`；可用環境變數 `CLOUDFLARED_BIN` 指定完整路徑。
   - 找不到執行檔時，用繁體中文提示怎麼安裝或設定 `CLOUDFLARED_BIN`，並結束。
2. 從 cloudflared 的輸出找出第一個 `https://<子網域>.trycloudflare.com` 網址。
   - 不可把 `https://api.trycloudflare.com`（cloudflared 內部 API）當成 Tunnel 網址。
   - 同一次執行只處理第一個找到的網址。
3. 等到 cloudflared 輸出 `Registered tunnel connection`（Tunnel 真正連上）才進行下一步。
   太早送出時 LINE 連不到新網址，會回 `400 Invalid webhook endpoint URL`（2026-11-23 實測）。
4. Webhook URL = Tunnel 網址 + `/webhook`（網址結尾若有 `/` 先去掉）。
5. 用 `.env` 的 `LINE_CHANNEL_ACCESS_TOKEN` 呼叫 Messaging API「Set webhook endpoint URL」，
   再呼叫「Test webhook endpoint」驗證。新網址的 DNS 可能要幾秒才生效，所以兩步驟任一失敗時，
   每 5 秒從設定重新來過，最多 6 次。
   - 成功：印出 `✅ Webhook 已更新並驗證成功：<網址>`
   - 401：token 錯誤，不重試，提示檢查 `LINE_CHANNEL_ACCESS_TOKEN`。
   - 全部失敗：印出最後一次的原因（LINE 回傳的訊息），並提醒確認 `pnpm dev` 有在跑。Tunnel 不關閉。
6. cloudflared 的輸出照常顯示在終端機。按 Ctrl+C 時一併關閉 cloudflared。

## 不做

- 不處理具名 Tunnel／固定網域（M5 部署時另做）。
- 不修改 OA Manager 的回應設定（Webhook 開關、聊天等仍需第一次手動設定）。

## 測試

純函式 `extractTunnelUrl`、`isTunnelConnected`、`toWebhookUrl` 用 Vitest 測試（`apps/bot/src/devtools/tunnelUrl.test.ts`）。
呼叫 LINE API 與啟動子程序的部分不寫自動測試，以手動執行 `pnpm tunnel` 驗收。
