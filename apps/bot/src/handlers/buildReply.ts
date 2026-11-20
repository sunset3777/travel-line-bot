import type { messagingApi, webhook } from '@line/bot-sdk'

/**
 * 決定要怎麼回覆一個 LINE 事件。
 * 這是純函式（不呼叫任何 API），所以很好寫測試。
 * 回傳 null 代表這個事件不需要回覆。
 */
export function buildReply(event: webhook.Event): messagingApi.Message[] | null {
  // 加好友：歡迎訊息
  if (event.type === 'follow') {
    return [
      {
        type: 'text',
        text: '歡迎加入！目前是測試版，傳任何文字給我，我會原樣回覆。',
      },
    ]
  }

  // 文字訊息：echo（之後會換成查行程、FAQ、AI）
  if (event.type === 'message' && event.message.type === 'text') {
    return [{ type: 'text', text: event.message.text }]
  }

  // 其他事件（貼圖、圖片、postback…）先不處理
  return null
}

/** 取出事件的 replyToken；沒有 replyToken 的事件（例如 unfollow）回傳 undefined */
export function getReplyToken(event: webhook.Event): string | undefined {
  return 'replyToken' in event ? event.replyToken : undefined
}
