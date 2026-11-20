import { describe, expect, it } from 'vitest'
import { loadEnv } from './env.js'

describe('loadEnv', () => {
  it('缺少 LINE 金鑰時列出要設定的變數', () => {
    expect(() => loadEnv({})).toThrow(/LINE_CHANNEL_SECRET[\s\S]*LINE_CHANNEL_ACCESS_TOKEN/)
  })

  it('PORT 未設定時預設 3000', () => {
    const env = loadEnv({ LINE_CHANNEL_SECRET: 's', LINE_CHANNEL_ACCESS_TOKEN: 't' })
    expect(env.PORT).toBe(3000)
  })
})
