// 共享协议类型 - 客户端/服务器共用
import type { Minion } from '../game/types'

// ============ 客户端 → 服务器 ============

export type ClientMessage =
  | { type: 'create_room' }
  | { type: 'join_room'; roomId: string }
  | { type: 'pick_hero'; heroId: string }
  | { type: 'board_snapshot'; board: Minion[] }
  | { type: 'surrender' }

// ============ 服务器 → 客户端 ============

export type ServerMessage =
  | { type: 'room_created'; roomId: string }
  | { type: 'room_joined'; roomId: string; enemyHeroId: string }
  | { type: 'player_joined'; enemyHeroId: string }
  | { type: 'hero_picked'; heroId: string }
  | { type: 'countdown_sync'; remaining: number }
  | { type: 'combat_start'; boards: { player: Minion[]; enemy: Minion[] } }
  | { type: 'turn_result'; winner: 'player' | 'enemy' | 'tie'; damageToLoser: number }
  | { type: 'next_turn' }
  | { type: 'opponent_left' }
  | { type: 'error'; msg: string }
