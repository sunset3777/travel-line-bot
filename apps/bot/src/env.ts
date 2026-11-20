import { z } from 'zod'

const requiredString = (name: string) => {
  const message = `請在 .env 設定 ${name}`
  return z.string({ error: message }).min(1, message)
}

// 啟動時檢查環境變數：缺少就直接報錯，不要等到執行一半才壞掉
const envSchema = z.object({
  LINE_CHANNEL_SECRET: requiredString('LINE_CHANNEL_SECRET'),
  LINE_CHANNEL_ACCESS_TOKEN: requiredString('LINE_CHANNEL_ACCESS_TOKEN'),
  PORT: z.coerce.number().int().positive().default(3000),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const messages = result.error.issues.map((issue) => `- ${issue.message}`).join('\n')
    throw new Error(`環境變數設定有誤：\n${messages}`)
  }
  return result.data
}
