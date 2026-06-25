// WebSocket 服务器 - 房间管理 + 消息中继
import { WebSocketServer, WebSocket } from 'ws'
import type { ClientMessage, ServerMessage } from '../src/net/protocol'
import type { Minion } from '../src/game/types'

const PORT = 3001

interface Player {
  ws: WebSocket
  heroId: string | null
  board: Minion[] | null
  boardSent: boolean
}

interface Room {
  id: string
  players: [Player, Player?]
  countdown: ReturnType<typeof setInterval> | null
  countdownRemaining: number
  phase: 'waiting' | 'hero_select' | 'countdown' | 'combat' | 'next_turn'
}

const rooms = new Map<string, Room>()

function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

function broadcast(room: Room, msg: ServerMessage): void {
  for (const p of room.players) {
    if (p) send(p.ws, msg)
  }
}

function removeRoom(room: Room): void {
  if (room.countdown) {
    clearInterval(room.countdown)
    room.countdown = null
  }
  rooms.delete(room.id)
}

function startCountdown(room: Room): void {
  room.phase = 'countdown'
  room.countdownRemaining = 60

  broadcast(room, { type: 'countdown_sync', remaining: room.countdownRemaining })

  room.countdown = setInterval(() => {
    room.countdownRemaining -= 1

    if (room.countdownRemaining <= 0) {
      if (room.countdown) {
        clearInterval(room.countdown)
        room.countdown = null
      }
      onCountdownEnd(room)
      return
    }

    broadcast(room, { type: 'countdown_sync', remaining: room.countdownRemaining })
  }, 1000)
}

function onCountdownEnd(room: Room): void {
  // 检查双方是否都发送了阵容
  const p1 = room.players[0]
  const p2 = room.players[1]
  if (!p1 || !p2) return

  // 如果有一方没发阵容，用空阵容
  if (!p1.board) p1.board = []
  if (!p2.board) p2.board = []

  room.phase = 'combat'

  // 给双方分别发送：己方阵容 + 对方阵容
  send(p1.ws, {
    type: 'combat_start',
    boards: { player: p1.board, enemy: p2.board },
  })
  send(p2.ws, {
    type: 'combat_start',
    boards: { player: p2.board, enemy: p1.board },
  })

  // 3秒后进入下一回合
  setTimeout(() => {
    startNextTurn(room)
  }, 3000)
}

function startNextTurn(room: Room): void {
  room.phase = 'next_turn'
  // 重置状态
  for (const p of room.players) {
    if (p) {
      p.board = null
      p.boardSent = false
    }
  }
  broadcast(room, { type: 'next_turn' })

  // 等短暂延迟后开始新的倒计时
  setTimeout(() => {
    startCountdown(room)
  }, 500)
}

const wss = new WebSocketServer({ port: PORT })
console.log(`服务器启动，监听端口 ${PORT}`)

wss.on('connection', (ws) => {
  let currentRoom: Room | null = null

  ws.on('message', (data) => {
    let msg: ClientMessage
    try {
      msg = JSON.parse(data.toString())
    } catch {
      return
    }

    switch (msg.type) {
      case 'create_room': {
        const roomId = generateRoomId()
        const room: Room = {
          id: roomId,
          players: [{ ws, heroId: null, board: null, boardSent: false }],
          countdown: null,
          countdownRemaining: 60,
          phase: 'waiting',
        }
        rooms.set(roomId, room)
        currentRoom = room
        send(ws, { type: 'room_created', roomId })
        break
      }

      case 'join_room': {
        const room = rooms.get(msg.roomId)
        if (!room) {
          send(ws, { type: 'error', msg: '房间不存在' })
          return
        }
        if (room.players.length >= 2) {
          send(ws, { type: 'error', msg: '房间已满' })
          return
        }

        const player: Player = { ws, heroId: null, board: null, boardSent: false }
        room.players.push(player)
        currentRoom = room

        // 告诉加入者对手英雄（还没有，先发空）
        send(ws, { type: 'room_joined', roomId: room.id, enemyHeroId: '' })

        // 告诉房主对手已加入
        send(room.players[0].ws, { type: 'player_joined', enemyHeroId: '' })

        // 进入英雄选择阶段
        room.phase = 'hero_select'
        break
      }

      case 'pick_hero': {
        if (!currentRoom) return
        const player = currentRoom.players.find((p) => p.ws === ws)
        if (!player) return
        player.heroId = msg.heroId

        // 找到对手
        const opponent = currentRoom.players.find((p) => p.ws !== ws)
        if (opponent && opponent.heroId) {
          // 双方都选了，开始倒计时
          send(ws, { type: 'hero_picked', heroId: opponent.heroId })
          send(opponent.ws, { type: 'hero_picked', heroId: player.heroId })
          startCountdown(currentRoom)
        } else if (opponent) {
          // 告诉对手你选了什么
          send(opponent.ws, { type: 'hero_picked', heroId: player.heroId })
        }
        break
      }

      case 'board_snapshot': {
        if (!currentRoom) return
        const player = currentRoom.players.find((p) => p.ws === ws)
        if (!player || player.boardSent) return
        player.board = msg.board
        player.boardSent = true

        // 如果双方都发了，提前结束倒计时
        const allSent = currentRoom.players.every((p) => p && p.boardSent)
        if (allSent && currentRoom.countdown) {
          clearInterval(currentRoom.countdown)
          currentRoom.countdown = null
          onCountdownEnd(currentRoom)
        }
        break
      }

      case 'surrender': {
        if (!currentRoom) return
        const opponent = currentRoom.players.find((p) => p.ws !== ws)
        if (opponent) {
          send(opponent.ws, { type: 'opponent_left' })
        }
        removeRoom(currentRoom)
        currentRoom = null
        break
      }
    }
  })

  ws.on('close', () => {
    if (!currentRoom) return
    const opponent = currentRoom.players.find((p) => p && p.ws !== ws)
    if (opponent) {
      send(opponent.ws, { type: 'opponent_left' })
    }
    removeRoom(currentRoom)
    currentRoom = null
  })
})
