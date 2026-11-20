import type { webhook } from '@line/bot-sdk'
import { describe, expect, it } from 'vitest'
import { buildReply, getReplyToken } from './buildReply.js'

const base = {
  timestamp: 1700000000000,
  mode: 'active',
  webhookEventId: '01TEST',
  deliveryContext: { isRedelivery: false },
  source: { type: 'user', userId: 'U123' },
} as const

describe('buildReply', () => {
  it('文字訊息會原樣回覆', () => {
    const event = {
      ...base,
      type: 'message',
      replyToken: 'token-1',
      message: { type: 'text', id: 'm1', quoteToken: 'q1', text: '有日本團嗎？' },
    } as webhook.Event

    expect(buildReply(event)).toEqual([{ type: 'text', text: '有日本團嗎？' }])
  })

  it('加好友會收到歡迎訊息', () => {
    const event = {
      ...base,
      type: 'follow',
      replyToken: 'token-2',
      follow: { isUnblocked: false },
    } as webhook.Event

    const reply = buildReply(event)
    expect(reply).toHaveLength(1)
    expect(reply?.[0]).toMatchObject({ type: 'text' })
  })

  it('貼圖等其他訊息不回覆', () => {
    const event = {
      ...base,
      type: 'message',
      replyToken: 'token-3',
      message: {
        type: 'sticker',
        id: 'm2',
        quoteToken: 'q2',
        packageId: '1',
        stickerId: '1',
        stickerResourceType: 'STATIC',
      },
    } as webhook.Event

    expect(buildReply(event)).toBeNull()
  })
})

describe('getReplyToken', () => {
  it('取消好友事件沒有 replyToken', () => {
    const event = { ...base, type: 'unfollow' } as webhook.Event
    expect(getReplyToken(event)).toBeUndefined()
  })
})
