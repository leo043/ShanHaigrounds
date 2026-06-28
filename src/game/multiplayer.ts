// 多人模式 GameController
import {
  createGame,
  buyMinion,
  sellMinion,
  playMinion,
  swapMinions,
  refreshTavern,
  freezeTavern,
  upgradeTavern,
  endRecruitPhase,
  startTurn,
  dealDamageToHero,
  checkGameOver,
  generateTripleReward,
  applyTripleReward,
} from './game'
import { simulateCombat } from './combat'
import { GameUI } from '../ui/render'
import { CARD_MAP, HEROES } from './cards'
import type { Minion } from './types'
import type { MultiplayerClient } from '../net/client'
import type { ServerMessage } from '../net/protocol'
import { cloneBoard } from './shared'
import { playCombatAnimation } from './combat-anim'
import * as sfx from './audio'

export class MultiplayerGameController {
  private state: ReturnType<typeof createGame>
  private ui: GameUI
  private client: MultiplayerClient
  private countdownInterval: ReturnType<typeof setInterval> | null = null

  constructor(
    playerHeroId: string,
    enemyHeroId: string,
    root: HTMLElement,
    client: MultiplayerClient,
  ) {
    this.client = client

    // 创建游戏状态（敌人英雄先随便填，收到阵容后替换）
    this.state = createGame(playerHeroId, enemyHeroId || HEROES[0].id)
    sfx.sfxSelect()

    this.ui = new GameUI(this.state, root, {
      onBuy: (uid) => this.onBuy(uid),
      onDropHandToBoard: (handUid, boardIdx) => this.onDropHandToBoard(handUid, boardIdx),
      onSwapBoard: (uidA, uidB) => this.onSwapBoard(uidA, uidB),
      onMoveBoardToSlot: (uid, boardIdx) => this.onMoveBoardToSlot(uid, boardIdx),
      onSell: (uid) => this.onSell(uid),
      onRefresh: () => this.onRefresh(),
      onFreeze: () => this.onFreeze(),
      onUpgrade: () => this.onUpgrade(),
      onCombat: () => {}, // 多人模式无手动开战
      onRestart: () => {},
      onTripleRewardPick: (defId) => this.onTripleRewardPick(defId),
      onHeroPick: () => {},
      onSurrender: () => this.onSurrender(),
    })

    this.listenToServer()
    this.ui.renderRecruit()
    this.startLocalCountdown(60)
  }

  private listenToServer(): void {
    this.client.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'combat_start':
          this.onCombatStart(msg.boards)
          break
        case 'next_turn':
          this.onNextTurn()
          break
        case 'opponent_left':
          this.onOpponentLeft()
          break
        case 'countdown_sync':
          // 房间大厅已处理，这里不需要
          break
      }
    })
  }

  private startLocalCountdown(seconds: number): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval)
    let remaining = seconds

    // 显示倒计时 UI
    this.ui.showCountdown(remaining)

    this.countdownInterval = setInterval(() => {
      remaining -= 1
      this.ui.updateCountdown(remaining)

      if (remaining <= 0) {
        clearInterval(this.countdownInterval!)
        this.countdownInterval = null
        this.onCountdownEnd()
      }
    }, 1000)
  }

  private onCountdownEnd(): void {
    // 倒计时结束，发送阵容快照到服务器
    endRecruitPhase(this.state)
    this.client.sendBoard(cloneBoard(this.state.player.board))
    this.ui.showWaitingForOpponent()
  }

  private async onCombatStart(boards: { player: Minion[]; enemy: Minion[] }): Promise<void> {
    // 用对手的阵容替换敌方
    this.state.enemy.board = boards.enemy
    // 恢复己方阵容（战斗前状态）
    this.state.player.board = boards.player
    for (const m of this.state.player.board) {
      m.health = m.maxHealth
      m.rebornUsed = false
      m.divineShield = m.keywords.includes('divineShield')
      m.hasAttacked = false
    }

    this.state.phase = 'combat'

    // 模拟战斗
    const result = simulateCombat(this.state)

    // 播放战斗动画
    sfx.sfxCombatStart()
    await playCombatAnimation(this.ui, result, this.state.player.board, this.state.enemy.board)

    // 结算英雄伤害
    if (result.winner === 'player') {
      dealDamageToHero(this.state, 'enemy', result.damageToLoser)
    } else if (result.winner === 'enemy') {
      dealDamageToHero(this.state, 'player', result.damageToLoser)
    }

    // 恢复战斗开始时的阵容
    for (const m of boards.player) {
      m.health = m.maxHealth
      m.rebornUsed = false
      m.divineShield = m.keywords.includes('divineShield')
      m.hasAttacked = false
    }
    for (const m of boards.enemy) {
      m.health = m.maxHealth
      m.rebornUsed = false
      m.divineShield = m.keywords.includes('divineShield')
      m.hasAttacked = false
    }
    this.state.player.board = boards.player
    this.state.enemy.board = boards.enemy

    // 检查游戏结束
    checkGameOver(this.state)
    if ((this.state.phase as string) === 'gameover') {
      if (this.state.winner === 'player') sfx.sfxVictory()
      else sfx.sfxDefeat()
      this.ui.state = this.state
      this.ui.renderGameOver()
      return
    }

    // 等待服务器发 next_turn
  }

  private onNextTurn(): void {
    startTurn(this.state)
    this.ui.state = this.state
    this.ui.selection = null
    this.ui.renderRecruit()
    this.startLocalCountdown(60)
  }

  private onOpponentLeft(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }
    // 对手离开，直接判定胜利
    this.state.phase = 'gameover'
    this.state.winner = 'player'
    sfx.sfxVictory()
    this.ui.state = this.state
    this.ui.renderGameOver()
  }

  // ============ 招募阶段交互 ============

  private onBuy(uid: string): void {
    const idx = this.state.player.tavern.findIndex((m) => m.uid === uid)
    if (idx < 0) return
    buyMinion(this.state.player, idx, this.state.uidGen)
    sfx.sfxBuy()
    this.ui.selection = null
    this.ui.renderRecruit()
  }

  private onDropHandToBoard(handUid: string, boardIndex: number): void {
    const handIdx = this.state.player.hand.findIndex((m) => m.uid === handUid)
    if (handIdx < 0) return
    const triggerReward = playMinion(this.state.player, handIdx, boardIndex, this.state.uidGen)
    if (triggerReward) {
      sfx.sfxTriple()
      this.showTripleReward()
    } else {
      sfx.sfxBuy()
      this.ui.renderRecruit()
    }
  }

  private onSwapBoard(uidA: string, uidB: string): void {
    swapMinions(this.state.player, uidA, uidB)
    this.ui.renderRecruit()
  }

  private onMoveBoardToSlot(uid: string, boardIndex: number): void {
    const board = this.state.player.board
    const fromIdx = board.findIndex((m) => m.uid === uid)
    if (fromIdx < 0 || fromIdx === boardIndex) return
    const [minion] = board.splice(fromIdx, 1)
    const insertAt = Math.min(boardIndex, board.length)
    board.splice(insertAt, 0, minion)
    this.ui.renderRecruit()
  }

  private showTripleReward(): void {
    const rewards = generateTripleReward(this.state.player)
    if (rewards.length === 0) {
      this.ui.renderRecruit()
      return
    }
    this.ui.renderTripleReward(rewards)
  }

  private onTripleRewardPick(defId: string): void {
    const def = CARD_MAP[defId]
    if (def) applyTripleReward(this.state.player, def, this.state.uidGen)
    this.ui.renderRecruit()
  }

  private onSell(uid: string): void {
    const idx = this.state.player.board.findIndex((m) => m.uid === uid)
    if (idx < 0) return
    sellMinion(this.state.player, idx)
    sfx.sfxSell()
    this.ui.renderRecruit()
  }

  private onRefresh(): void {
    if (refreshTavern(this.state.player, this.state.uidGen)) {
      sfx.sfxRefresh()
      this.ui.renderRecruit()
    }
  }

  private onFreeze(): void {
    freezeTavern(this.state.player)
    sfx.sfxFreeze()
    this.ui.renderRecruit()
  }

  private onUpgrade(): void {
    if (upgradeTavern(this.state.player)) {
      sfx.sfxUpgrade()
      this.ui.renderRecruit()
    }
  }

  private onSurrender(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }
    this.client.surrender()
  }
}
