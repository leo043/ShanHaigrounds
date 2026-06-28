import type { EventBus } from './event-bus'
import type { GameUI } from '../ui/render'
import * as sfx from './audio'
import { playRecruitBgm, playCombatBgm, stopBgm } from './audio'

export function setupListeners(bus: EventBus, ui: GameUI): void {
  // 音效
  bus.on('buy', () => sfx.sfxBuy())
  bus.on('sell', () => {
    sfx.sfxSell()
    sfx.sfxGoldCoin()
  })
  bus.on('play', () => sfx.sfxBuy())
  bus.on('refresh', () => sfx.sfxRefresh())
  bus.on('freeze', () => sfx.sfxFreeze())
  bus.on('upgrade', () => sfx.sfxUpgrade())
  bus.on('triple_reward_pick', () => sfx.sfxTriple())
  bus.on('combat', () => {
    sfx.sfxCombatStart()
    playCombatBgm()
  })
  bus.on('start_turn', () => {
    sfx.sfxTurnStart()
    playRecruitBgm()
  })
  bus.on('game_over', (winner) => {
    stopBgm()
    if (winner === 'player') sfx.sfxVictory()
    else if (winner === 'enemy') sfx.sfxDefeat()
    else sfx.sfxDraw()
  })

  // 招募阶段渲染
  const recruitActions = [
    'buy',
    'sell',
    'play',
    'swap',
    'move',
    'refresh',
    'freeze',
    'upgrade',
    'triple_reward_pick',
  ]
  for (const act of recruitActions) {
    bus.on(act, () => ui.renderRecruit())
  }
  bus.on('undo', () => ui.renderRecruit())
  bus.on('redo', () => ui.renderRecruit())
}
