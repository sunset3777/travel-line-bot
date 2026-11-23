// 開發用：啟動 Cloudflare 快速 Tunnel，並自動把新網址設成 LINE 的 Webhook URL。
// 規格：docs/specs/dev-tunnel.md
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { HTTPFetchError, messagingApi } from '@line/bot-sdk'
import { loadEnv } from '../env.js'
import { extractTunnelUrl, isTunnelConnected, toWebhookUrl } from './tunnelUrl.js'

const ATTEMPTS = 6
const RETRY_INTERVAL_MS = 5000

const env = loadEnv()
const client = new messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
})

const bin = process.env.CLOUDFLARED_BIN || 'cloudflared'
const child = spawn(bin, ['tunnel', '--url', `http://localhost:${env.PORT}`])

child.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'ENOENT') {
    console.error(
      [
        `找不到 cloudflared（${bin}）。`,
        '- 還沒安裝：winget install --id Cloudflare.cloudflared，裝完重開終端機',
        '- 已安裝但找不到：在 .env 加上 CLOUDFLARED_BIN=cloudflared 的完整路徑',
      ].join('\n'),
    )
  } else {
    console.error('cloudflared 啟動失敗', error)
  }
  process.exit(1)
})

let tunnelUrl: string | null = null
let started = false

function onOutput(chunk: Buffer): void {
  const text = chunk.toString()
  process.stderr.write(text)
  if (started) return
  tunnelUrl ??= extractTunnelUrl(text)
  // 網址出現時 Tunnel 還沒連上，要等 Registered tunnel connection 再設定，不然 LINE 會回 400
  if (tunnelUrl && isTunnelConnected(text)) {
    started = true
    void updateWebhook(toWebhookUrl(tunnelUrl))
  }
}

child.stdout.on('data', onOutput)
child.stderr.on('data', onOutput)

/** 把 LINE 回傳的錯誤整理成一行說明 */
function describeError(error: unknown): string {
  if (error instanceof HTTPFetchError) return `${error.status} ${error.body}`
  return String(error)
}

async function updateWebhook(endpoint: string): Promise<void> {
  console.log(`\nTunnel 已連上，設定 LINE Webhook URL：${endpoint}`)

  let lastReason = ''
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      await client.setWebhookEndpoint({ endpoint })
      const result = await client.testWebhookEndpoint({ endpoint })
      if (result.success) {
        console.log(`\n✅ Webhook 已更新並驗證成功：${endpoint}\n`)
        return
      }
      lastReason = `狀態碼 ${result.statusCode}，${result.reason}`
    } catch (error) {
      if (error instanceof HTTPFetchError && error.status === 401) {
        console.error('\n❌ LINE 拒絕這個 token，請確認 .env 的 LINE_CHANNEL_ACCESS_TOKEN')
        return
      }
      lastReason = describeError(error)
    }
    if (attempt < ATTEMPTS) {
      console.log(`第 ${attempt} 次未成功（${lastReason}），${RETRY_INTERVAL_MS / 1000} 秒後重試…`)
      // 新網址的 DNS 要幾秒才生效
      await sleep(RETRY_INTERVAL_MS)
    }
  }
  console.error(
    `\n⚠️ Webhook 設定或驗證失敗（${lastReason}）。請確認另一個視窗的 pnpm dev 有在跑。\n`,
  )
}

// Ctrl+C 時一併關掉 cloudflared
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    child.kill()
    process.exit(0)
  })
}
