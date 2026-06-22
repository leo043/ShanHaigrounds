// 山海战棋 · 入口
import './styles/main.css'
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
} from './game/game'
import { simulateCombat } from './game/combat'
import type { CombatResult, CombatStep } from './game/combat'
import { runAITurn } from './game/ai'
import { GameUI, renderHeroSelect, renderMainMenu, renderCodex } from './ui/render'
import { CARD_MAP, HEROES } from './game/cards'
import type { Minion } from './game/types'
import * as sfx from './game/audio'

// ============ 纯工具函数（不依赖游戏状态）============

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** 深拷贝随从数组 */
function cloneBoard(board: Minion[]): Minion[] {
  return board.map((m) => ({
    ...m,
    keywords: [...m.keywords],
    effects: m.effects.map((e) => ({ ...e })),
  }))
}

/** 根据 uid 查找战场上的卡牌 DOM */
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

// ============ 游戏控制器：封装 state 和 ui，消除全局可变状态 ============

class GameController {
  private state: ReturnType<typeof createGame>
  private ui: GameUI

  constructor(playerHeroId: string, root: HTMLElement) {
    const enemyPool = HEROES.filter((h) => h.id !== playerHeroId)
    const enemyHero = enemyPool[Math.floor(Math.random() * enemyPool.length)]
    this.state = createGame(playerHeroId, enemyHero.id)
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
      onCombat: () => this.onCombat(),
      onRestart: () => this.onRestart(),
      onTripleRewardPick: (defId) => this.onTripleRewardPick(defId),
      onHeroPick: () => {},
    })
    this.ui.renderRecruit()
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
    // 1. 手牌选中态：点击战场随从 = 插到该位置前
    if (this.ui.selection?.type === 'hand') {
      const boardIdx = this.state.player.board.findIndex((m) => m.uid === uid)
      if (boardIdx >= 0) {
        this.onPlayToSlot(boardIdx)
        return
      }
    }
    // 2. 战场选中态 + 同一随从：取消
    if (this.ui.selection?.type === 'board' && this.ui.selection.uid === uid) {
      this.ui.selection = null
      this.ui.renderRecruit()
      return
    }
    // 3. 战场选中态 + 另一随从：交换站位
    if (this.ui.selection?.type === 'board') {
      swapMinions(this.state.player, this.ui.selection.uid, uid)
      sfx.sfxSelect()
      this.ui.selection = null
      this.ui.renderRecruit()
      return
    }
    // 4. 无选中：选中该随从（用于交换/卖出）
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
    // 关键：三连奖励在打出金卡时触发
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

  // ============ 三连奖励 ============

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

  // ============ 战斗流程 ============

  private async onCombat(): Promise<void> {
    // 禁用开战按钮防止重复点击
    const btn = document.getElementById('btn-combat') as HTMLButtonElement | null
    if (btn) btn.disabled = true

    // 1. AI 执行招募
    runAITurn(this.state)

    // 2. 结束招募阶段（触发回合结束 buff）
    endRecruitPhase(this.state)

    // 3. 保存战斗开始时的 board 快照（深拷贝）
    //    规则：战斗中的死亡不影响我方阵容，下一回合开始时随从应与战斗开始时一致
    const playerBoardSnapshot = cloneBoard(this.state.player.board)
    const enemyBoardSnapshot = cloneBoard(this.state.enemy.board)

    // 4. 模拟战斗（在副本上进行，不修改 state）
    const result = simulateCombat(this.state)

    // 5. 播放战斗动画
    sfx.sfxCombatStart()
    await this.playCombatAnimation(result)

    // 6. 结算英雄伤害（按战斗胜负）
    if (result.winner === 'player') {
      dealDamageToHero(this.state, 'enemy', result.damageToLoser)
    } else if (result.winner === 'enemy') {
      dealDamageToHero(this.state, 'player', result.damageToLoser)
    }

    // 7. 关键：恢复战斗开始时的阵容（所有随从都在，回满血，复生/圣盾重置）
    //    战斗中死亡的随从不消失，只有主动出售才会消失
    for (const m of playerBoardSnapshot) {
      m.health = m.maxHealth
      m.rebornUsed = false
      m.divineShield = m.keywords.includes('divineShield')
      m.hasAttacked = false
    }
    for (const m of enemyBoardSnapshot) {
      m.health = m.maxHealth
      m.rebornUsed = false
      m.divineShield = m.keywords.includes('divineShield')
      m.hasAttacked = false
    }
    this.state.player.board = playerBoardSnapshot
    this.state.enemy.board = enemyBoardSnapshot

    // 8. 检查游戏结束
    checkGameOver(this.state)
    if (this.state.phase === 'gameover') {
      if (this.state.winner === 'player') sfx.sfxVictory()
      else sfx.sfxDefeat()
      this.ui.state = this.state
      this.ui.renderGameOver()
      return
    }

    // 9. 进入下一回合
    startTurn(this.state)
    this.ui.state = this.state
    this.ui.selection = null
    await delay(700)
    this.ui.renderRecruit()
  }

  /** 播放战斗动画：基于每步快照渲染，配合 CSS 动画类 */
  private async playCombatAnimation(result: CombatResult): Promise<void> {
    let logHtml = ''
    // 初始渲染：用第一步之前的原始棋盘
    this.ui.renderCombatStatic(
      this.state.player.board,
      this.state.enemy.board,
      '',
      '两军交锋',
      '战鼓擂动，胜负将分……',
    )
    await delay(500)

    // 判断是否需要全量重建棋盘
    const needsFullRender = (type: CombatStep['type']) =>
      type === 'death' || type === 'reborn' || type === 'summon'

    for (const step of result.steps) {
      // 追加日志
      logHtml += `<div class="log-entry ${logClass(step.type)}">${step.text}</div>`

      // 先播放本步动画（基于上一次渲染的 DOM）
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

      // 渲染：棋盘结构不变时只更新 HP，变化时全量重建
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

    // 最终停留帧（存活随从回满血后的状态）
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

  private onRestart(): void {
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
    () => {},
  )
}

function showHeroSelect(): void {
  renderHeroSelect(appRoot, (heroId) => {
    new GameController(heroId, appRoot)
  })
}

function showCodex(): void {
  renderCodex(appRoot, () => showMainMenu())
}

// 启动：显示主菜单
showMainMenu()
