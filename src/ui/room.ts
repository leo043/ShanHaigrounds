// 房间创建/加入界面
import { MultiplayerClient } from '../net/client'
import type { ServerMessage } from '../net/protocol'

export interface RoomLobbyCallbacks {
  onConnected: (roomId: string) => void
  onEnemyJoined: (enemyHeroId: string) => void
  onEnemyPicked: (heroId: string) => void
  onCountdown: (remaining: number) => void
  onCombatStart: (boards: {
    player: import('../game/types').Minion[]
    enemy: import('../game/types').Minion[]
  }) => void
  onNextTurn: () => void
  onOpponentLeft: () => void
  onError: (msg: string) => void
  onBack: () => void
}

export function renderRoomLobby(
  root: HTMLElement,
  mode: 'create' | 'join',
  callbacks: RoomLobbyCallbacks,
): void {
  const client = new MultiplayerClient(`ws://${window.location.hostname}:3001`)

  root.innerHTML = `
    <div class="room-lobby-overlay">
      <div class="room-lobby-card">
        <div class="room-lobby-back" id="room-back">← 返回</div>
        <div class="room-lobby-title">${mode === 'create' ? '创建房间' : '加入房间'}</div>
        <div class="room-lobby-status" id="room-status">正在连接服务器...</div>
        ${
          mode === 'create'
            ? `
          <div class="room-lobby-code" id="room-code" style="display:none">
            <div class="room-code-label">房间号</div>
            <div class="room-code-value" id="room-code-value"></div>
            <button class="room-copy-btn" id="room-copy">复制房间号</button>
          </div>
        `
            : `
          <div class="room-lobby-join" id="room-join-form" style="display:none">
            <input class="room-input" id="room-input" placeholder="输入6位房间号" maxlength="6" autocomplete="off" />
            <button class="room-join-btn" id="room-join-btn">加入</button>
          </div>
        `
        }
        <div class="room-lobby-waiting" id="room-waiting" style="display:none">
          <div class="room-waiting-spinner"></div>
          <div class="room-waiting-text">等待对手加入...</div>
        </div>
        <div class="room-lobby-countdown" id="room-countdown" style="display:none">
          <div class="countdown-number" id="countdown-number">60</div>
          <div class="countdown-label">备战倒计时</div>
        </div>
      </div>
    </div>
  `

  // 连接服务器
  client
    .connect()
    .then(() => {
      updateStatus('已连接服务器')

      if (mode === 'create') {
        client.createRoom()
      } else {
        const joinForm = document.getElementById('room-join-form')
        if (joinForm) joinForm.style.display = 'block'
      }
    })
    .catch(() => {
      updateStatus('连接服务器失败，请重试')
    })

  // 监听消息
  client.onMessage((msg: ServerMessage) => {
    switch (msg.type) {
      case 'room_created': {
        const codeEl = document.getElementById('room-code')
        const codeValue = document.getElementById('room-code-value')
        if (codeEl) codeEl.style.display = 'block'
        if (codeValue) codeValue.textContent = msg.roomId
        updateStatus('等待对手加入...')
        const waitingEl = document.getElementById('room-waiting')
        if (waitingEl) waitingEl.style.display = 'flex'
        callbacks.onConnected(msg.roomId)
        break
      }
      case 'room_joined': {
        updateStatus('已加入房间，等待对手选择英雄...')
        callbacks.onConnected(msg.roomId)
        break
      }
      case 'player_joined': {
        updateStatus('对手已加入！请选择英雄')
        const waitingEl = document.getElementById('room-waiting')
        if (waitingEl) waitingEl.style.display = 'none'
        callbacks.onEnemyJoined(msg.enemyHeroId)
        break
      }
      case 'hero_picked': {
        callbacks.onEnemyPicked(msg.heroId)
        break
      }
      case 'countdown_sync': {
        const numEl = document.getElementById('countdown-number')
        const countdownEl = document.getElementById('room-countdown')
        if (numEl) numEl.textContent = String(msg.remaining)
        if (countdownEl) countdownEl.style.display = 'flex'
        updateStatus(`备战倒计时 ${msg.remaining}s`)
        callbacks.onCountdown(msg.remaining)
        break
      }
      case 'combat_start': {
        callbacks.onCombatStart(msg.boards)
        break
      }
      case 'next_turn': {
        callbacks.onNextTurn()
        break
      }
      case 'opponent_left': {
        updateStatus('对手已离开')
        callbacks.onOpponentLeft()
        break
      }
      case 'error': {
        updateStatus(`错误: ${msg.msg}`)
        callbacks.onError(msg.msg)
        break
      }
    }
  })

  // 返回按钮
  document.getElementById('room-back')?.addEventListener('click', () => {
    client.disconnect()
    callbacks.onBack()
  })

  // 复制按钮
  document.getElementById('room-copy')?.addEventListener('click', () => {
    const codeValue = document.getElementById('room-code-value')
    if (codeValue) {
      navigator.clipboard.writeText(codeValue.textContent ?? '').then(() => {
        const btn = document.getElementById('room-copy')
        if (btn) {
          btn.textContent = '已复制!'
          setTimeout(() => {
            btn.textContent = '复制房间号'
          }, 1500)
        }
      })
    }
  })

  // 加入按钮
  document.getElementById('room-join-btn')?.addEventListener('click', () => {
    const input = document.getElementById('room-input') as HTMLInputElement | null
    if (input && input.value.trim()) {
      client.joinRoom(input.value.trim().toUpperCase())
    }
  })

  // 输入框回车
  document.getElementById('room-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('room-join-btn')?.click()
    }
  })

  function updateStatus(text: string): void {
    const el = document.getElementById('room-status')
    if (el) el.textContent = text
  }

  // 暴露 client 给外部使用
  interface RootWithMP {
    __mpClient?: MultiplayerClient
    __mpCallbacks?: RoomLobbyCallbacks
  }
  ;(root as RootWithMP).__mpClient = client
  ;(root as RootWithMP).__mpCallbacks = callbacks
}

export function getMultiplayerClient(root: HTMLElement): MultiplayerClient | null {
  return (root as { __mpClient?: MultiplayerClient }).__mpClient ?? null
}

export function getMultiplayerCallbacks(root: HTMLElement): RoomLobbyCallbacks | null {
  return (root as { __mpCallbacks?: RoomLobbyCallbacks }).__mpCallbacks ?? null
}
