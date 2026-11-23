// 開發用：啟動 Cloudflare 快速 Tunnel，並自動把新網址設成 LINE 的 Webhook URL。
// 規格：docs/specs/dev-tunnel.md
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { messagingApi } from '@line/bot-sdk'
import { loadEnv } from '../env.js'
import { extractTunnelUrl, toWebhookUrl } from './tunnelUrl.js'

const VERIFY_ATTEMPTS = 6
const VERIFY_INTERVAL_MS = 5000

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

let handled = false

function onOutput(chunk: Buffer): void {
  const text = chunk.toString()
  process.stderr.write(text)
  if (handled) return
  const tunnelUrl = extractTunnelUrl(text)
  if (!tunnelUrl) return
  handled = true
  void updateWebhook(toWebhookUrl(tunnelUrl))
}

child.stdout.on('data', onOutput)
child.stderr.on('data', onOutput)

async function updateWebhook(endpoint: string): Promise<void> {
  try {
    await client.setWebhookEndpoint({ endpoint })
    console.log(`\n已把 LINE Webhook URL 設為 ${endpoint}，驗證中…`)
  } catch (error) {
    console.error('\n設定 Webhook URL 失敗，請確認 .env 的 LINE_CHANNEL_ACCESS_TOKEN', error)
    return
  }

  let lastReason = ''
  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
    // 新網址的 DNS 要幾秒才生效，先等一下再驗證
    await sleep(VERIFY_INTERVAL_MS)
    try {
      const result = await client.testWebhookEndpoint({ endpoint })
      if (result.success) {
        console.log(`\n✅ Webhook 已更新並驗證成功：${endpoint}\n`)
        return
      }
      lastReason = `狀態碼 ${result.statusCode}，${result.reason}`
    } catch (error) {
      lastReason = String(error)
    }
  }
  console.error(
    `\n⚠️ Webhook 已設定，但驗證失敗（${lastReason}）。請確認另一個視窗的 pnpm dev 有在跑。\n`,
  )
}

// Ctrl+C 時一併關掉 cloudflared
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    child.kill()
    process.exit(0)
  })
}
