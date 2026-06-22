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
import { GameUI, renderHeroSelect } from './ui/render'
import { CARD_MAP, HEROES } from './game/cards'
import * as sfx from './game/audio'

let state: ReturnType<typeof createGame>
let ui: GameUI
const appRoot = document.getElementById('app')!

/** 启动：先渲染英雄选择面板 */
function bootstrap(): void {
  renderHeroSelect(appRoot, (heroId) => {
    startGameWithHero(heroId)
  })
}

/** 玩家选好英雄后，开始游戏。敌方英雄随机指定（不与玩家重复） */
function startGameWithHero(playerHeroId: string): void {
  const enemyPool = HEROES.filter((h) => h.id !== playerHeroId)
  const enemyHero = enemyPool[Math.floor(Math.random() * enemyPool.length)]
  state = createGame(playerHeroId, enemyHero.id)
  sfx.sfxSelect()
  ui = new GameUI(state, appRoot, {
    onBuy,
    onHandClick,
    onBoardClick,
    onPlayToSlot,
    onSell,
    onRefresh,
    onFreeze,
    onUpgrade,
    onCombat,
    onRestart,
    onTripleRewardPick,
    onHeroPick: () => {}, // 选英雄阶段已用独立函数处理，此处留空
  })
  ui.renderRecruit()
}

// ============ 招募阶段交互 ============
function onBuy(uid: string): void {
  const idx = state.player.tavern.findIndex((m) => m.uid === uid)
  if (idx < 0) return
  buyMinion(state.player, idx)
  sfx.sfxBuy()
  ui.selection = null
  ui.renderRecruit()
}

function onHandClick(uid: string): void {
  if (ui.selection?.type === 'hand' && ui.selection.uid === uid) {
    ui.selection = null
  } else {
    ui.selection = { type: 'hand', uid }
    sfx.sfxSelect()
  }
  ui.renderRecruit()
}

function onBoardClick(uid: string): void {
  // 1. 手牌选中态：点击战场随从 = 插到该位置前
  if (ui.selection?.type === 'hand') {
    const boardIdx = state.player.board.findIndex((m) => m.uid === uid)
    if (boardIdx >= 0) {
      onPlayToSlot(boardIdx)
      return
    }
  }
  // 2. 战场选中态 + 同一随从：取消
  if (ui.selection?.type === 'board' && ui.selection.uid === uid) {
    ui.selection = null
    ui.renderRecruit()
    return
  }
  // 3. 战场选中态 + 另一随从：交换站位
  if (ui.selection?.type === 'board') {
    swapMinions(state.player, ui.selection.uid, uid)
    sfx.sfxSelect()
    ui.selection = null
    ui.renderRecruit()
    return
  }
  // 4. 无选中：选中该随从（用于交换/卖出）
  ui.selection = { type: 'board', uid }
  sfx.sfxSelect()
  ui.renderRecruit()
}

function onPlayToSlot(boardIndex: number): void {
  if (ui.selection?.type !== 'hand') return
  const handIdx = state.player.hand.findIndex((m) => m.uid === ui.selection!.uid)
  if (handIdx < 0) {
    ui.selection = null
    ui.renderRecruit()
    return
  }
  // 关键：三连奖励在打出金卡时触发
  const triggerReward = playMinion(state.player, handIdx, boardIndex)
  ui.selection = null
  if (triggerReward) {
    sfx.sfxTriple()
    showTripleReward()
  } else {
    sfx.sfxBuy()
    ui.renderRecruit()
  }
}

// ============ 三连奖励 ============
function showTripleReward(): void {
  const rewards = generateTripleReward(state.player)
  if (rewards.length === 0) {
    ui.renderRecruit()
    return
  }
  ui.renderTripleReward(rewards)
}

function onTripleRewardPick(defId: string): void {
  const def = CARD_MAP[defId]
  if (def) applyTripleReward(state.player, def)
  ui.renderRecruit()
}

function onSell(): void {
  if (ui.selection?.type !== 'board') return
  const idx = state.player.board.findIndex((m) => m.uid === ui.selection!.uid)
  if (idx >= 0) sellMinion(state.player, idx)
  sfx.sfxSell()
  ui.selection = null
  ui.renderRecruit()
}

function onRefresh(): void {
  if (refreshTavern(state.player)) {
    sfx.sfxRefresh()
    ui.renderRecruit()
  }
}

function onFreeze(): void {
  freezeTavern(state.player)
  sfx.sfxFreeze()
  ui.renderRecruit()
}

function onUpgrade(): void {
  if (upgradeTavern(state.player)) {
    sfx.sfxUpgrade()
    ui.renderRecruit()
  }
}

// ============ 战斗流程 ============
async function onCombat(): Promise<void> {
  // 禁用开战按钮防止重复点击
  const btn = document.getElementById('btn-combat') as HTMLButtonElement | null
  if (btn) btn.disabled = true

  // 1. AI 执行招募
  runAITurn(state)

  // 2. 结束招募阶段（触发回合结束 buff）
  endRecruitPhase(state)

  // 3. 保存战斗开始时的 board 快照（深拷贝）
  //    规则：战斗中的死亡不影响我方阵容，下一回合开始时随从应与战斗开始时一致
  const playerBoardSnapshot = cloneBoard(state.player.board)
  const enemyBoardSnapshot = cloneBoard(state.enemy.board)

  // 4. 模拟战斗（在副本上进行，不修改 state）
  const result = simulateCombat(state)

  // 5. 播放战斗动画
  sfx.sfxCombatStart()
  await playCombatAnimation(result)

  // 6. 结算英雄伤害（按战斗胜负）
  if (result.winner === 'player') {
    dealDamageToHero(state, 'enemy', result.damageToLoser)
  } else if (result.winner === 'enemy') {
    dealDamageToHero(state, 'player', result.damageToLoser)
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
  state.player.board = playerBoardSnapshot
  state.enemy.board = enemyBoardSnapshot

  // 8. 检查游戏结束
  checkGameOver(state)
  if (state.phase === 'gameover') {
    if (state.winner === 'player') sfx.sfxVictory()
    else sfx.sfxDefeat()
    ui.state = state
    ui.renderGameOver()
    return
  }

  // 9. 进入下一回合
  startTurn(state)
  ui.state = state
  ui.selection = null
  await delay(700)
  ui.renderRecruit()
}

/** 深拷贝随从数组 */
function cloneBoard(board: import('./game/types').Minion[]): import('./game/types').Minion[] {
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

/** 播放战斗动画：基于每步快照渲染，配合 CSS 动画类 */
async function playCombatAnimation(result: CombatResult): Promise<void> {
  let logHtml = ''
  // 初始渲染：用第一步之前的原始棋盘
  ui.renderCombatStatic(
    state.player.board,
    state.enemy.board,
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
      ui.renderCombatStatic(step.snap.p, step.snap.e, logHtml, title, sub, summonedUid)
    } else {
      ui.updateCombatHp(step.snap.p, step.snap.e)
      ui.updateCombatLogAndTitle(logHtml, title, sub)
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
  ui.renderCombatStatic(result.survivorBoard, result.enemySurvivorBoard, logHtml, winTitle, winSub)
  scrollLog()
  await delay(1300)
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

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function onRestart(): void {
  // 再战一局：回到英雄选择
  bootstrap()
}

// 启动：先选英雄
bootstrap()
