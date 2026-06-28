import type { GameState, Minion, Phase } from './types'
import {
  buyMinion,
  sellMinion,
  swapMinions,
  playMinion,
  refreshTavern,
  freezeTavern,
  upgradeTavern,
  applyTripleReward,
} from './game'
import { CARD_MAP } from './cards'
import { simulateCombat } from './combat'
import { cloneBoard } from './shared'

export interface Command {
  type: string
  execute(state: GameState): void
  undo(state: GameState): void
  describe(): string
  succeeded(): boolean
}

export class BuyCommand implements Command {
  type = 'buy'
  private removedCard: Minion | null = null
  private success = false

  constructor(
    private uid: string,
    private tavernIdx: number,
    private uidGen?: () => string,
  ) {}

  execute(state: GameState): void {
    const goldBefore = state.player.gold
    this.removedCard = state.player.tavern[this.tavernIdx] ?? null
    buyMinion(state.player, this.tavernIdx, this.uidGen)
    this.success = state.player.gold < goldBefore
  }

  undo(state: GameState): void {
    if (!this.success) return
    const handIdx = state.player.hand.findIndex((m) => m.uid === this.uid)
    if (handIdx >= 0) state.player.hand.splice(handIdx, 1)
    if (this.removedCard) state.player.tavern.splice(this.tavernIdx, 0, this.removedCard)
    state.player.gold += 3
  }

  succeeded(): boolean {
    return this.success
  }
  describe(): string {
    return `购买 ${this.uid}`
  }
}

export class SellCommand implements Command {
  type = 'sell'
  private removedMinion: Minion | null = null
  private boardIdx: number = -1
  private success = false

  constructor(private uid: string) {}

  execute(state: GameState): void {
    this.boardIdx = state.player.board.findIndex((m) => m.uid === this.uid)
    if (this.boardIdx < 0) return
    this.removedMinion = state.player.board[this.boardIdx]
    this.success = sellMinion(state.player, this.boardIdx)
  }

  undo(state: GameState): void {
    if (!this.success || !this.removedMinion || this.boardIdx < 0) return
    state.player.board.splice(this.boardIdx, 0, this.removedMinion)
    state.player.gold -= 1
  }

  succeeded(): boolean {
    return this.success
  }
  describe(): string {
    return `卖出 ${this.uid}`
  }
}

export class PlayToBoardCommand implements Command {
  type = 'play'
  private handIdx: number = -1
  private triggerReward: boolean = false
  private success = false

  constructor(
    private handUid: string,
    private boardIndex: number,
    private uidGen?: () => string,
  ) {}

  execute(state: GameState): void {
    this.handIdx = state.player.hand.findIndex((m) => m.uid === this.handUid)
    if (this.handIdx < 0) return
    this.triggerReward = playMinion(state.player, this.handIdx, this.boardIndex, this.uidGen)
    this.success = true
  }

  undo(state: GameState): void {
    if (!this.success) return
    const boardIdx = state.player.board.findIndex((m) => m.uid === this.handUid)
    if (boardIdx < 0) return
    const [minion] = state.player.board.splice(boardIdx, 1)
    state.player.hand.splice(this.handIdx, 0, minion)
  }

  succeeded(): boolean {
    return this.success
  }
  describe(): string {
    return `上场 ${this.handUid} → ${this.boardIndex}`
  }
  didTriggerReward(): boolean {
    return this.triggerReward
  }
}

export class SwapBoardCommand implements Command {
  type = 'swap'
  private success = false
  constructor(
    private uidA: string,
    private uidB: string,
  ) {}

  execute(state: GameState): void {
    this.success = swapMinions(state.player, this.uidA, this.uidB)
  }

  undo(state: GameState): void {
    if (!this.success) return
    swapMinions(state.player, this.uidA, this.uidB)
  }

  succeeded(): boolean {
    return this.success
  }
  describe(): string {
    return `交换 ${this.uidA} ↔ ${this.uidB}`
  }
}

export class MoveBoardCommand implements Command {
  type = 'move'
  private fromIdx: number = -1
  private success = false

  constructor(
    private uid: string,
    private toIdx: number,
  ) {}

  execute(state: GameState): void {
    this.fromIdx = state.player.board.findIndex((m) => m.uid === this.uid)
    if (this.fromIdx < 0 || this.fromIdx === this.toIdx) return
    const [minion] = state.player.board.splice(this.fromIdx, 1)
    const insertAt = Math.min(this.toIdx, state.player.board.length)
    state.player.board.splice(insertAt, 0, minion)
    this.success = true
  }

  undo(state: GameState): void {
    if (!this.success) return
    const currentIdx = state.player.board.findIndex((m) => m.uid === this.uid)
    if (currentIdx < 0) return
    const [minion] = state.player.board.splice(currentIdx, 1)
    state.player.board.splice(this.fromIdx, 0, minion)
  }

  succeeded(): boolean {
    return this.success
  }
  describe(): string {
    return `移动 ${this.uid} → ${this.toIdx}`
  }
}

export class RefreshCommand implements Command {
  type = 'refresh'
  private oldTavern: Minion[] = []
  private goldSpent: number = 0
  private wasFreeRefresh: boolean = false
  private success = false

  constructor(private uidGen?: () => string) {}

  execute(state: GameState): void {
    this.oldTavern = state.player.tavern.map((m) => ({ ...m }))
    const goldBefore = state.player.gold
    const freeUsedBefore = state.player.hero.freeRefreshUsed ?? false
    this.success = refreshTavern(state.player, this.uidGen)
    this.goldSpent = goldBefore - state.player.gold
    this.wasFreeRefresh = !freeUsedBefore && state.player.hero.freeRefreshUsed === true
  }

  undo(state: GameState): void {
    if (!this.success) return
    state.player.tavern = this.oldTavern
    state.player.gold += this.goldSpent
    if (this.wasFreeRefresh) state.player.hero.freeRefreshUsed = false
  }

  succeeded(): boolean {
    return this.success
  }
  describe(): string {
    return '刷新酒馆'
  }
}

export class FreezeCommand implements Command {
  type = 'freeze'
  private success = true

  execute(state: GameState): void {
    freezeTavern(state.player)
  }

  undo(state: GameState): void {
    freezeTavern(state.player)
  }

  succeeded(): boolean {
    return this.success
  }
  describe(): string {
    return '冻结酒馆'
  }
}

export class UpgradeCommand implements Command {
  type = 'upgrade'
  private goldSpent: number = 0
  private oldTier: number = 0
  private oldCost: number = 0
  private success = false

  constructor() {}

  execute(state: GameState): void {
    this.oldTier = state.player.tavernTier
    this.oldCost = state.player.upgradeCost
    const goldBefore = state.player.gold
    this.success = upgradeTavern(state.player)
    this.goldSpent = goldBefore - state.player.gold
  }

  undo(state: GameState): void {
    if (!this.success) return
    state.player.tavernTier = this.oldTier
    state.player.upgradeCost = this.oldCost
    state.player.gold += this.goldSpent
  }

  succeeded(): boolean {
    return this.success
  }
  describe(): string {
    return `升级酒馆 → ${this.oldTier + 1}`
  }
}

export class TripleRewardPickCommand implements Command {
  type = 'triple_reward_pick'
  private addedMinion: Minion | null = null
  private success = false

  constructor(
    private defId: string,
    private uidGen?: () => string,
  ) {}

  execute(state: GameState): void {
    const def = CARD_MAP[this.defId]
    if (!def) return
    const handBefore = state.player.hand.length
    applyTripleReward(state.player, def, this.uidGen)
    if (state.player.hand.length > handBefore) {
      this.addedMinion = state.player.hand[state.player.hand.length - 1]
      this.success = true
    }
  }

  undo(state: GameState): void {
    if (!this.success || !this.addedMinion) return
    const idx = state.player.hand.findIndex((m) => m.uid === this.addedMinion!.uid)
    if (idx >= 0) state.player.hand.splice(idx, 1)
  }

  succeeded(): boolean {
    return this.success
  }
  describe(): string {
    return `三连奖励选择 ${this.defId}`
  }
}

export class CombatCommand implements Command {
  type = 'combat'
  private playerSnapshot: Minion[] = []
  private enemySnapshot: Minion[] = []
  private result: ReturnType<typeof simulateCombat> | null = null
  private success = false

  execute(state: GameState): void {
    this.playerSnapshot = cloneBoard(state.player.board)
    this.enemySnapshot = cloneBoard(state.enemy.board)
    this.result = simulateCombat(state)
    this.success = true
  }

  undo(state: GameState): void {
    if (!this.success) return
    state.player.board = this.playerSnapshot
    state.enemy.board = this.enemySnapshot
  }

  succeeded(): boolean {
    return this.success
  }
  getResult() {
    return this.result
  }
  getPlayerSnapshot() {
    return this.playerSnapshot
  }
  getEnemySnapshot() {
    return this.enemySnapshot
  }

  describe(): string {
    return '战斗'
  }
}

export class StartTurnCommand implements Command {
  type = 'start_turn'
  private prevTurn: number = 0
  private prevPhase: Phase = 'recruit'
  private prevPlayerGold: number = 0
  private prevEnemyGold: number = 0
  private prevPlayerUpgradeCost: number = 0
  private prevEnemyUpgradeCost: number = 0
  private prevPlayerTavernTier: number = 0
  private prevEnemyTavernTier: number = 0

  execute(state: GameState): void {
    this.prevTurn = state.turn
    this.prevPhase = state.phase
    this.prevPlayerGold = state.player.gold
    this.prevEnemyGold = state.enemy.gold
    this.prevPlayerUpgradeCost = state.player.upgradeCost
    this.prevEnemyUpgradeCost = state.enemy.upgradeCost
    this.prevPlayerTavernTier = state.player.tavernTier
    this.prevEnemyTavernTier = state.enemy.tavernTier
  }

  undo(state: GameState): void {
    state.turn = this.prevTurn
    state.phase = this.prevPhase
    state.player.gold = this.prevPlayerGold
    state.enemy.gold = this.prevEnemyGold
    state.player.upgradeCost = this.prevPlayerUpgradeCost
    state.enemy.upgradeCost = this.prevEnemyUpgradeCost
    state.player.tavernTier = this.prevPlayerTavernTier
    state.enemy.tavernTier = this.prevEnemyTavernTier
  }

  succeeded(): boolean {
    return true
  }
  describe(): string {
    return `开始第 ${this.prevTurn + 1} 回合`
  }
}
