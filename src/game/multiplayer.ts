// 多人模式 GameController
import {
  createGame,
  endRecruitPhase,
  startTurn,
  dealDamageToHero,
  checkGameOver,
  generateTripleReward,
} from './game'
import { simulateCombat } from './combat'
import { GameUI } from '../ui/render'
import { HEROES } from './cards'
import type { Minion } from './types'
import type { MultiplayerClient } from '../net/client'
import type { ServerMessage } from '../net/protocol'
import { cloneBoard, delay } from './shared'
import { playCombatAnimation } from './combat-anim'
import { EventBus } from './event-bus'
import { CommandInvoker } from './command-invoker'
import { setupListeners } from './listeners'
import {
  BuyCommand,
  SellCommand,
  PlayToBoardCommand,
  SwapBoardCommand,
  MoveBoardCommand,
  RefreshCommand,
  FreezeCommand,
  UpgradeCommand,
  TripleRewardPickCommand,
} from './commands'
import * as sfx from './audio'
import { playRecruitBgm } from './audio'

export class MultiplayerGameController {
  private state: ReturnType<typeof createGame>
  private ui: GameUI
  private client: MultiplayerClient
  private bus: EventBus
  private invoker: CommandInvoker
  private countdownInterval: ReturnType<typeof setInterval> | null = null

  constructor(
    playerHeroId: string,
    enemyHeroId: string,
    root: HTMLElement,
    client: MultiplayerClient,
  ) {
    this.client = client
    this.state = createGame(playerHeroId, enemyHeroId || HEROES[0].id)
    this.bus = new EventBus()
    this.invoker = new CommandInvoker(this.bus)

    this.ui = new GameUI(this.state, root, {
      onBuy: (uid) => this.onBuy(uid),
      onDropHandToBoard: (handUid, boardIdx) => this.onDropHandToBoard(handUid, boardIdx),
      onSwapBoard: (uidA, uidB) => this.onSwapBoard(uidA, uidB),
      onMoveBoardToSlot: (uid, boardIdx) => this.onMoveBoardToSlot(uid, boardIdx),
      onSell: (uid) => this.onSell(uid),
      onRefresh: () => this.onRefresh(),
      onFreeze: () => this.onFreeze(),
      onUpgrade: () => this.onUpgrade(),
      onCombat: () => {},
      onRestart: () => {},
      onTripleRewardPick: (defId) => this.onTripleRewardPick(defId),
      onHeroPick: () => {},
      onSurrender: () => this.onSurrender(),
    })

    setupListeners(this.bus, this.ui)
    sfx.sfxSelect()
    playRecruitBgm()
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
          break
      }
    })
  }

  private startLocalCountdown(seconds: number): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval)
    let remaining = seconds
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
    endRecruitPhase(this.state)
    this.client.sendBoard(cloneBoard(this.state.player.board))
    this.ui.showWaitingForOpponent()
  }

  private async onCombatStart(boards: { player: Minion[]; enemy: Minion[] }): Promise<void> {
    this.state.enemy.board = boards.enemy
    this.state.player.board = boards.player
    for (const m of this.state.player.board) {
      m.health = m.maxHealth
      m.rebornUsed = false
      m.divineShield = m.keywords.includes('divineShield')
      m.hasAttacked = false
    }
    this.state.phase = 'combat'

    const result = simulateCombat(this.state)
    this.bus.emit('combat')
    await playCombatAnimation(this.ui, result, this.state.player.board, this.state.enemy.board)

    if (result.winner === 'player') {
      dealDamageToHero(this.state, 'enemy', result.damageToLoser)
    } else if (result.winner === 'enemy') {
      dealDamageToHero(this.state, 'player', result.damageToLoser)
    }

    this.ui.renderCombatStatic(
      result.damagedSnap.p,
      result.damagedSnap.e,
      '',
      result.winner === 'player' ? '胜利' : result.winner === 'enemy' ? '失败' : '平局',
      `对英雄造成 ${result.damageToLoser} 点伤害`,
    )
    await delay(1500)

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

    checkGameOver(this.state)
    if ((this.state.phase as string) === 'gameover') {
      this.bus.emit('game_over', this.state.winner)
      this.ui.state = this.state
      this.ui.renderGameOver()
      return
    }
  }

  private onNextTurn(): void {
    startTurn(this.state)
    this.bus.emit('start_turn')
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
    this.state.phase = 'gameover'
    this.state.winner = 'player'
    this.bus.emit('game_over', 'player')
    this.ui.state = this.state
    this.ui.renderGameOver()
  }

  // ============ 招募阶段交互 ============

  private onBuy(uid: string): void {
    const idx = this.state.player.tavern.findIndex((m) => m.uid === uid)
    if (idx < 0) return
    this.invoker.execute(new BuyCommand(uid, idx, this.state.uidGen), this.state)
  }

  private onDropHandToBoard(handUid: string, boardIndex: number): void {
    const cmd = new PlayToBoardCommand(handUid, boardIndex, this.state.uidGen)
    this.invoker.execute(cmd, this.state)
    if (cmd.didTriggerReward()) {
      this.showTripleReward()
    }
  }

  private onSwapBoard(uidA: string, uidB: string): void {
    this.invoker.execute(new SwapBoardCommand(uidA, uidB), this.state)
  }

  private onMoveBoardToSlot(uid: string, boardIndex: number): void {
    this.invoker.execute(new MoveBoardCommand(uid, boardIndex), this.state)
  }

  private showTripleReward(): void {
    const rewards = generateTripleReward(this.state.player)
    if (rewards.length === 0) {
      this.ui.renderRecruit()
      return
    }
    sfx.sfxTripleReveal()
    this.ui.renderTripleReward(rewards)
  }

  private onTripleRewardPick(defId: string): void {
    this.invoker.execute(new TripleRewardPickCommand(defId, this.state.uidGen), this.state)
  }

  private onSell(uid: string): void {
    this.invoker.execute(new SellCommand(uid), this.state)
  }

  private onRefresh(): void {
    this.invoker.execute(new RefreshCommand(this.state.uidGen), this.state)
  }

  private onFreeze(): void {
    this.invoker.execute(new FreezeCommand(), this.state)
  }

  private onUpgrade(): void {
    this.invoker.execute(new UpgradeCommand(), this.state)
  }

  private onSurrender(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }
    this.client.surrender()
  }
}
