// 客户端 WebSocket 封装
import type { ClientMessage, ServerMessage } from './protocol'

export type MessageHandler = (msg: ServerMessage) => void

export class MultiplayerClient {
  private ws: WebSocket | null = null
  private handlers: MessageHandler[] = []
  private url: string
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false

  constructor(serverUrl: string) {
    this.url = serverUrl
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)
        this.intentionalClose = false

        this.ws.onopen = () => {
          console.log('[WS] 已连接')
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const msg: ServerMessage = JSON.parse(event.data)
            for (const h of this.handlers) h(msg)
          } catch {
            console.error('[WS] 解析消息失败')
          }
        }

        this.ws.onclose = () => {
          console.log('[WS] 连接断开')
          if (!this.intentionalClose) {
            this.scheduleReconnect()
          }
        }

        this.ws.onerror = (err) => {
          console.error('[WS] 连接错误', err)
          reject(err)
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect().catch(() => {})
    }, 2000)
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler)
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  createRoom(): void {
    this.send({ type: 'create_room' })
  }

  joinRoom(roomId: string): void {
    this.send({ type: 'join_room', roomId })
  }

  pickHero(heroId: string): void {
    this.send({ type: 'pick_hero', heroId })
  }

  sendBoard(board: import('../game/types').Minion[]): void {
    this.send({ type: 'board_snapshot', board })
  }

  surrender(): void {
    this.send({ type: 'surrender' })
  }

  disconnect(): void {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
