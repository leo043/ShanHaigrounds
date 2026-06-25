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
import type { CombatResult, CombatStep } from './combat'
import { GameUI } from '../ui/render'
import { CARD_MAP, HEROES } from './cards'
import type { Minion } from './types'
import type { MultiplayerClient } from '../net/client'
import type { ServerMessage } from '../net/protocol'
import * as sfx from './audio'

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function cloneBoard(board: Minion[]): Minion[] {
  return board.map((m) => ({
    ...m,
    keywords: [...m.keywords],
    effects: m.effects.map((e) => ({ ...e })),
  }))
}

function getCardEl(uid: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`#app .card[data-uid="${uid}"]`)
}

function logClass(type: CombatStep['type']): string {
  if (type === 'hit' || type === 'attackStart') return 'attack'
  if (type === 'death') return 'death'
  if (type === 'shield') return 'shield'
  if (type === 'heroDamage') return 'heroDamage'
  if (type === 'summon') return 'summon'
  if (type === 'reborn') return 'reborn'
  return 'info'
}

function titleFor(step: CombatStep, result: CombatResult): string {
  if (step.type === 'heroDamage') {
    return step.side === 'player' ? '大获全胜' : '不敌败北'
  }
  if (step.type === 'end' && step.text === '战斗结束') {
    return result.winner === 'player'
      ? '大获全胜'
      : result.winner === 'enemy'
        ? '不敌败北'
        : '势均力敌'
  }
  if (step.type === 'info') return '两军交锋'
  return '交锋中'
}

function subFor(step: CombatStep): string {
  if (step.type === 'heroDamage') return step.text
  if (step.type === 'info') return step.text
  return ''
}

function scrollLog(): void {
  const el = document.getElementById('combat-log')
  if (el) el.scrollTop = el.scrollHeight
}

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
      onHandClick: (uid) => this.onHandClick(uid),
      onBoardClick: (uid) => this.onBoardClick(uid),
      onPlayToSlot: (idx) => this.onPlayToSlot(idx),
      onSell: () => this.onSell(),
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
    await this.playCombatAnimation(result)

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
    buyMinion(this.state.player, idx)
    sfx.sfxBuy()
    this.ui.selection = null
    this.ui.renderRecruit()
  }

  private onHandClick(uid: string): void {
    if (this.ui.selection?.type === 'hand' && this.ui.selection.uid === uid) {
      this.ui.selection = null
    } else {
      this.ui.selection = { type: 'hand', uid }
      sfx.sfxSelect()
    }
    this.ui.renderRecruit()
  }

  private onBoardClick(uid: string): void {
    if (this.ui.selection?.type === 'hand') {
      const boardIdx = this.state.player.board.findIndex((m) => m.uid === uid)
      if (boardIdx >= 0) {
        this.onPlayToSlot(boardIdx)
        return
      }
    }
    if (this.ui.selection?.type === 'board' && this.ui.selection.uid === uid) {
      this.ui.selection = null
      this.ui.renderRecruit()
      return
    }
    if (this.ui.selection?.type === 'board') {
      swapMinions(this.state.player, this.ui.selection.uid, uid)
      sfx.sfxSelect()
      this.ui.selection = null
      this.ui.renderRecruit()
      return
    }
    this.ui.selection = { type: 'board', uid }
    sfx.sfxSelect()
    this.ui.renderRecruit()
  }

  private onPlayToSlot(boardIndex: number): void {
    if (this.ui.selection?.type !== 'hand') return
    const handIdx = this.state.player.hand.findIndex((m) => m.uid === this.ui.selection!.uid)
    if (handIdx < 0) {
      this.ui.selection = null
      this.ui.renderRecruit()
      return
    }
    const triggerReward = playMinion(this.state.player, handIdx, boardIndex)
    this.ui.selection = null
    if (triggerReward) {
      sfx.sfxTriple()
      this.showTripleReward()
    } else {
      sfx.sfxBuy()
      this.ui.renderRecruit()
    }
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
    if (def) applyTripleReward(this.state.player, def)
    this.ui.renderRecruit()
  }

  private onSell(): void {
    if (this.ui.selection?.type !== 'board') return
    const idx = this.state.player.board.findIndex((m) => m.uid === this.ui.selection!.uid)
    if (idx >= 0) sellMinion(this.state.player, idx)
    sfx.sfxSell()
    this.ui.selection = null
    this.ui.renderRecruit()
  }

  private onRefresh(): void {
    if (refreshTavern(this.state.player)) {
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

  /** 播放战斗动画 */
  private async playCombatAnimation(result: CombatResult): Promise<void> {
    let logHtml = ''
    this.ui.renderCombatStatic(
      this.state.player.board,
      this.state.enemy.board,
      '',
      '两军交锋',
      '战鼓擂动，胜负将分……',
    )
    await delay(500)

    const needsFullRender = (type: CombatStep['type']) =>
      type === 'death' || type === 'reborn' || type === 'summon'

    for (const step of result.steps) {
      logHtml += `<div class="log-entry ${logClass(step.type)}">${step.text}</div>`

      if (step.type === 'attackStart') {
        const atkEl = getCardEl(step.attackerUid!)
        const defEl = getCardEl(step.defenderUid!)
        atkEl?.classList.add(step.side === 'player' ? 'atk-up' : 'atk-down')
        sfx.sfxAttack()
        await delay(180)
        defEl?.classList.add('hit')
        await delay(220)
      } else if (step.type === 'hit') {
        const defEl = getCardEl(step.defenderUid!)
        defEl?.classList.add('hit')
        sfx.sfxHit()
        await delay(220)
      } else if (step.type === 'shield') {
        const defEl = getCardEl(step.defenderUid!)
        defEl?.classList.add('shield-break')
        sfx.sfxShield()
        await delay(320)
      } else if (step.type === 'death') {
        for (const uid of step.killedUids ?? []) {
          getCardEl(uid)?.classList.add('dying')
        }
        sfx.sfxDeath()
        await delay(420)
      } else if (step.type === 'reborn') {
        sfx.sfxReborn()
        await delay(120)
      } else if (step.type === 'summon') {
        sfx.sfxSummon()
        await delay(120)
      } else if (step.type === 'heroDamage') {
        sfx.sfxHeroDamage()
        await delay(350)
      } else {
        await delay(140)
      }

      const title = titleFor(step, result)
      const sub = subFor(step)
      if (needsFullRender(step.type)) {
        const summonedUid =
          step.type === 'summon'
            ? step.summonedUid
            : step.type === 'reborn'
              ? step.rebornUid
              : undefined
        this.ui.renderCombatStatic(step.snap.p, step.snap.e, logHtml, title, sub, summonedUid)
      } else {
        this.ui.updateCombatHp(step.snap.p, step.snap.e)
        this.ui.updateCombatLogAndTitle(logHtml, title, sub)
      }
      scrollLog()
    }

    const winTitle =
      result.winner === 'player' ? '大获全胜' : result.winner === 'enemy' ? '不敌败北' : '势均力敌'
    const winSub =
      result.winner === 'player'
        ? `对敌方英雄造成 ${result.damageToLoser} 点伤害！`
        : result.winner === 'enemy'
          ? `我方英雄承受 ${result.damageToLoser} 点伤害`
          : '双方旗鼓相当，各自退兵'
    this.ui.renderCombatStatic(
      result.survivorBoard,
      result.enemySurvivorBoard,
      logHtml,
      winTitle,
      winSub,
    )
    scrollLog()
    await delay(1300)
  }
}
