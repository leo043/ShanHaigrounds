// 山海战棋 · 入口
import './styles/main.css'
import {
  createGame,
  endRecruitPhase,
  startTurn,
  dealDamageToHero,
  checkGameOver,
  generateTripleReward,
} from './game/game'
import { runAITurn } from './game/ai'
import { GameUI, renderHeroSelect, renderMainMenu, renderCodex } from './ui/render'
import { HEROES } from './game/cards'
import { delay } from './game/shared'
import { playCombatAnimation } from './game/combat-anim'
import { EventBus } from './game/event-bus'
import { CommandInvoker } from './game/command-invoker'
import { setupListeners } from './game/listeners'
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
  CombatCommand,
} from './game/commands'
import * as sfx from './game/audio'
import { playRecruitBgm, stopBgm } from './game/audio'

// ============ 游戏控制器：封装 state 和 ui，消除全局可变状态 ============

class GameController {
  private state: ReturnType<typeof createGame>
  private ui: GameUI
  private bus: EventBus
  private invoker: CommandInvoker

  constructor(playerHeroId: string, root: HTMLElement) {
    const enemyPool = HEROES.filter((h) => h.id !== playerHeroId)
    const enemyHero = enemyPool[Math.floor(Math.random() * enemyPool.length)]
    this.state = createGame(playerHeroId, enemyHero.id)
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
      onCombat: () => this.onCombat(),
      onRestart: () => this.onRestart(),
      onTripleRewardPick: (defId) => this.onTripleRewardPick(defId),
      onHeroPick: () => {},
      onSurrender: () => this.onSurrender(),
    })
    setupListeners(this.bus, this.ui)
    sfx.sfxSelect()
    playRecruitBgm()
    this.ui.renderRecruit()
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

  // ============ 三连奖励 ============

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

  // ============ 战斗流程 ============

  private async onCombat(): Promise<void> {
    const btn = document.getElementById('btn-combat') as HTMLButtonElement | null
    if (btn) btn.disabled = true

    runAITurn(this.state)
    endRecruitPhase(this.state)

    const cmd = new CombatCommand()
    this.invoker.execute(cmd, this.state)

    const result = cmd.getResult()
    const playerSnapshot = cmd.getPlayerSnapshot()
    const enemySnapshot = cmd.getEnemySnapshot()
    if (!result) return

    await playCombatAnimation(this.ui, result, this.state.player.board, this.state.enemy.board)

    if (result.winner === 'player') {
      dealDamageToHero(this.state, 'enemy', result.damageToLoser)
    } else if (result.winner === 'enemy') {
      dealDamageToHero(this.state, 'player', result.damageToLoser)
    }

    // 展示战斗结果状态（剩余随从带伤害）
    this.ui.renderCombatStatic(
      result.damagedSnap.p,
      result.damagedSnap.e,
      '',
      result.winner === 'player' ? '胜利' : result.winner === 'enemy' ? '失败' : '平局',
      `对英雄造成 ${result.damageToLoser} 点伤害`,
    )
    await delay(1500)

    // 恢复到回合开始时的阵容
    for (const m of playerSnapshot) {
      m.health = m.maxHealth
      m.rebornUsed = false
      m.divineShield = m.keywords.includes('divineShield')
      m.hasAttacked = false
    }
    for (const m of enemySnapshot) {
      m.health = m.maxHealth
      m.rebornUsed = false
      m.divineShield = m.keywords.includes('divineShield')
      m.hasAttacked = false
    }
    this.state.player.board = playerSnapshot
    this.state.enemy.board = enemySnapshot

    checkGameOver(this.state)
    if (this.state.phase === 'gameover') {
      this.bus.emit('game_over', this.state.winner)
      this.ui.state = this.state
      this.ui.renderGameOver()
      return
    }

    startTurn(this.state)
    this.bus.emit('start_turn')
    this.ui.state = this.state
    this.ui.selection = null
    await delay(700)
    this.ui.renderRecruit()
  }

  private onRestart(): void {
    stopBgm()
    showMainMenu()
  }

  private onSurrender(): void {
    stopBgm()
    showMainMenu()
  }
}

// ============ 启动入口 ============

const appRoot = document.getElementById('app')!

function showMainMenu(): void {
  renderMainMenu(
    appRoot,
    () => showHeroSelect(),
    () => showCodex(),
  )
}

function showHeroSelect(): void {
  renderHeroSelect(
    appRoot,
    (heroId) => {
      new GameController(heroId, appRoot)
    },
    () => showMainMenu(),
  )
}

function showCodex(): void {
  renderCodex(appRoot, () => showMainMenu())
}

// 启动：显示主菜单
showMainMenu()
