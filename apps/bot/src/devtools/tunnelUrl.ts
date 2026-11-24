// 快速 Tunnel 的網址格式：https://<隨機單字>.trycloudflare.com
// api.trycloudflare.com 是 cloudflared 內部用的 API，不是 Tunnel 網址
const TUNNEL_URL = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/

/** 從 cloudflared 的一段輸出找出 Tunnel 網址，找不到回傳 null */
export function extractTunnelUrl(output: string): string | null {
  return output.match(TUNNEL_URL)?.[0] ?? null
}

/** cloudflared 印出這行代表 Tunnel 已真正連上，外部才連得到新網址 */
export function isTunnelConnected(output: string): boolean {
  return output.includes('Registered tunnel connection')
}

/** Tunnel 網址加上 Bot 的 Webhook 路徑 */
export function toWebhookUrl(tunnelUrl: string): string {
  return `${tunnelUrl.replace(/\/+$/, '')}/webhook`
}
