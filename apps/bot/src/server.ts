import { messagingApi, middleware, SignatureValidationFailed, type webhook } from '@line/bot-sdk'
import express, { type NextFunction, type Request, type Response } from 'express'
import { loadEnv } from './env.js'
import { buildReply, getReplyToken } from './handlers/buildReply.js'

const env = loadEnv()

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
})

const app = express()

// 健康檢查：部署後 CD 會打這個網址確認服務正常
app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

// LINE Webhook
// middleware 會用 Channel Secret 驗證簽章，驗證失敗直接拒絕。
// 注意：這條路由前面不能加 express.json()，簽章驗證需要原始 body。
app.post('/webhook', middleware({ channelSecret: env.LINE_CHANNEL_SECRET }), (req, res) => {
  const { events } = req.body as webhook.CallbackRequest

  // 先回 200 給 LINE，再處理事件（之後這裡會改成丟進 BullMQ 佇列）
  res.sendStatus(200)

  for (const event of events) {
    void handleEvent(event)
  }
})

async function handleEvent(event: webhook.Event): Promise<void> {
  const replyToken = getReplyToken(event)
  const messages = buildReply(event)
  if (!replyToken || !messages) return

  try {
    await client.replyMessage({ replyToken, messages })
  } catch (error) {
    console.error('回覆失敗', { webhookEventId: event.webhookEventId, error })
  }
}

// 簽章錯誤回 401（不是 LINE 送來的請求），其他錯誤回 500
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof SignatureValidationFailed) {
    res.status(401).send('Invalid signature')
    return
  }
  console.error(error)
  res.status(500).send('Internal Server Error')
})

app.listen(env.PORT, () => {
  console.log(`Bot 啟動：http://localhost:${env.PORT}（Webhook 路徑：/webhook）`)
})
