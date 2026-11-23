import { describe, expect, it } from 'vitest'
import { extractTunnelUrl, isTunnelConnected, toWebhookUrl } from './tunnelUrl.js'

describe('extractTunnelUrl', () => {
  it('從 cloudflared 的輸出框找出 Tunnel 網址', () => {
    const line =
      '2026-11-23T00:00:00Z INF |  https://ink-apartment-doctor-sharing.trycloudflare.com                 |'
    expect(extractTunnelUrl(line)).toBe('https://ink-apartment-doctor-sharing.trycloudflare.com')
  })

  it('不把 cloudflared 內部的 api 網址當成 Tunnel 網址', () => {
    expect(
      extractTunnelUrl('INF Requesting new quick Tunnel on https://api.trycloudflare.com...'),
    ).toBeNull()
  })

  it('沒有網址的輸出回傳 null', () => {
    expect(extractTunnelUrl('INF Starting tunnel tunnelID=abc')).toBeNull()
  })
})

describe('toWebhookUrl', () => {
  it('在網址後面加上 /webhook', () => {
    expect(toWebhookUrl('https://a-b.trycloudflare.com')).toBe(
      'https://a-b.trycloudflare.com/webhook',
    )
  })

  it('網址結尾有 / 時不會變成 //webhook', () => {
    expect(toWebhookUrl('https://a-b.trycloudflare.com/')).toBe(
      'https://a-b.trycloudflare.com/webhook',
    )
  })
})

describe('isTunnelConnected', () => {
  it('看到 Registered tunnel connection 代表 Tunnel 已連上', () => {
    expect(
      isTunnelConnected(
        '2026-11-23T02:26:49Z INF Registered tunnel connection connIndex=0 location=tpe01',
      ),
    ).toBe(true)
  })

  it('建立網址的訊息還不算連上', () => {
    expect(isTunnelConnected('INF |  Your quick Tunnel has been created! Visit it at')).toBe(false)
  })
})
