// AI 对手 - 招募阶段决策
import type { GameState, PlayerState, Minion, CardDef } from './types'
import { TRIBE_SYNERGY_LEVELS, CLASS_SYNERGY_LEVELS } from './types'
import {
  buyMinion,
  sellMinion,
  playMinion,
  refreshTavern,
  upgradeTavern,
  generateTripleReward,
  applyTripleReward,
} from './game'

/** 随从价值评估（用于 AI 决策） */
function minionValue(m: Minion): number {
  let v = m.attack + m.health
  if (m.keywords.includes('taunt')) v += 2
  if (m.keywords.includes('divineShield')) v += 3
  if (m.keywords.includes('reborn')) v += 3
  if (m.effects.length > 0) v += 3
  if (m.golden) v += 10
  return v
}

/** 卡牌定义价值（用于 AI 选三连奖励，考虑阵容需要） */
function cardDefValue(def: CardDef, ai: PlayerState): number {
  let v = def.attack + def.health
  if (def.keywords?.includes('taunt')) v += 2
  if (def.keywords?.includes('divineShield')) v += 3
  if (def.keywords?.includes('reborn')) v += 3
  if (def.effects && def.effects.length > 0) v += 3
  v += def.tier // 高星卡更值钱

  // 羁绊协同加成
  const tribeCount = countTribes(ai.board)
  const classCount = countClasses(ai.board)
  v += (tribeCount[def.tribe] ?? 0) * 2
  v += (classCount[def.class] ?? 0) * 2

  // 缺嘲讽时优先嘲讽卡
  if (
    def.keywords?.includes('taunt') &&
    ai.board.filter((b) => b.keywords.includes('taunt')).length === 0
  ) {
    v += 4
  }

  return v
}

/** 执行 AI 一整个招募回合 */
export function runAITurn(state: GameState): void {
  const ai = state.enemy
  const uidGen = state.uidGen
  let actions = 0
  const maxActions = 30 // 防止死循环

  while (actions < maxActions) {
    actions++

    // 1. 优先升级酒馆（前期且有钱）
    if (shouldUpgrade(ai)) {
      if (upgradeTavern(ai)) {
        continue
      }
    }

    // 2. 尝试凑三连：买酒馆里能凑三连的
    const buyForTriple = findTripleBuy(ai)
    if (buyForTriple >= 0 && ai.gold >= 3) {
      buyMinion(ai, buyForTriple, uidGen)
      // 买完直接尝试打出
      tryPlayHand(ai, uidGen)
      continue
    }

    // 3. 买价值高的同族随从
    const buyIdx = findBestBuy(ai)
    if (buyIdx >= 0 && ai.gold >= 3 && ai.hand.length < 10) {
      buyMinion(ai, buyIdx, uidGen)
      continue
    }

    // 4. 打出手牌
    if (ai.hand.length > 0 && ai.board.length < 7) {
      tryPlayHand(ai, uidGen)
      continue
    }

    // 5. 战场满了且有弱随从，卖掉换更强的
    if (ai.board.length >= 7 && ai.hand.length > 0) {
      const weakest = findWeakest(ai.board)
      const strongest = findStrongest(ai.hand)
      if (
        weakest >= 0 &&
        strongest >= 0 &&
        minionValue(ai.hand[strongest]) > minionValue(ai.board[weakest]) + 2
      ) {
        sellMinion(ai, weakest)
        continue
      }
    }

    // 6. 还有钱且酒馆没好货，刷新一次（前期不浪费钱刷新）
    if (
      ai.gold >= 2 &&
      state.turn > 3 &&
      ai.tavern.every((m) => minionValue(m) < 5) &&
      ai.tavernTier < 6
    ) {
      refreshTavern(ai, uidGen)
      continue
    }

    // 7. 没事做了，结束
    break
  }

  // 确保手牌尽量打出
  while (ai.hand.length > 0 && ai.board.length < 7) {
    tryPlayHand(ai, uidGen)
  }
}

/** 是否应该升级酒馆 */
function shouldUpgrade(ai: PlayerState): boolean {
  if (ai.tavernTier >= 6) return false
  // 前 3 回合优先升级，且金币够
  if (ai.upgradeCost <= ai.gold && ai.tavernTier <= 2) return true
  if (ai.upgradeCost <= 2 && ai.gold >= ai.upgradeCost) return true
  return false
}

/** 找酒馆里能凑三连的随从索引 */
function findTripleBuy(ai: PlayerState): number {
  const owned = [...ai.board, ...ai.hand]
  for (let i = 0; i < ai.tavern.length; i++) {
    const m = ai.tavern[i]
    const count = owned.filter((o) => o.defId === m.defId && !o.golden).length
    if (count >= 2) return i // 已有2张，再买第3张即可三连
  }
  return -1
}

/** 找酒馆里最值得买的（羁绊意识 + 同族 + 高价值） */
function findBestBuy(ai: PlayerState): number {
  const tribeCount = countTribes(ai.board)
  const classCount = countClasses(ai.board)
  let bestIdx = -1
  let bestScore = -1
  for (let i = 0; i < ai.tavern.length; i++) {
    const m = ai.tavern[i]
    let score = minionValue(m)

    // 羁绊推进加成：接近下一个阈值时加分
    const tribeThresholds = TRIBE_SYNERGY_LEVELS[m.tribe]
    const currentTribe = tribeCount[m.tribe] ?? 0
    for (const t of tribeThresholds) {
      if (currentTribe + 1 === t) {
        score += 5
        break
      } // 差 1 个激活
      if (currentTribe + 1 >= t) {
        score += 2
        break
      } // 已激活，继续叠
    }
    const classThresholds = CLASS_SYNERGY_LEVELS[m.class]
    const currentClass = classCount[m.class] ?? 0
    for (const t of classThresholds) {
      if (currentClass + 1 === t) {
        score += 4
        break
      }
      if (currentClass + 1 >= t) {
        score += 1
        break
      }
    }

    // 同族加成
    score += currentTribe * 1

    // 嘲讽优先（前期缺肉盾）
    if (
      m.keywords.includes('taunt') &&
      ai.board.filter((b) => b.keywords.includes('taunt')).length === 0
    ) {
      score += 3
    }
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return bestScore >= 4 ? bestIdx : -1
}

/** 统计战场上各族数量 */
function countTribes(board: Minion[]): Record<string, number> {
  const c: Record<string, number> = {}
  for (const m of board) c[m.tribe] = (c[m.tribe] ?? 0) + 1
  return c
}

/** 统计战场上各职业数量 */
function countClasses(board: Minion[]): Record<string, number> {
  const c: Record<string, number> = {}
  for (const m of board) c[m.class] = (c[m.class] ?? 0) + 1
  return c
}

/** 尝试打出手牌（优先高价值的，按 AI 站位策略放置） */
function tryPlayHand(ai: PlayerState, uidGen?: () => string): void {
  if (ai.hand.length === 0 || ai.board.length >= 7) return
  // 选价值最高的手牌
  let bestIdx = 0
  let bestVal = -1
  for (let i = 0; i < ai.hand.length; i++) {
    const v = minionValue(ai.hand[i])
    if (v > bestVal) {
      bestVal = v
      bestIdx = i
    }
  }
  const m = ai.hand[bestIdx]
  const pos = pickAiPosition(ai.board, m)
  const triggered = playMinion(ai, bestIdx, pos, uidGen)
  // AI 打出金卡触发三连奖励：自动选价值最高的奖励卡
  if (triggered) {
    const rewards = generateTripleReward(ai)
    if (rewards.length > 0) {
      let pick = rewards[0]
      let pickVal = -1
      for (const r of rewards) {
        const v = cardDefValue(r, ai)
        if (v > pickVal) {
          pickVal = v
          pick = r
        }
      }
      applyTripleReward(ai, pick, uidGen)
    }
  }
}

/**
 * AI 站位策略：
 * 1. 嘲讽：最左侧保护核心随从
 * 2. 亡语相邻 buff 卡：放中间位置（影响更多相邻随从）
 * 3. 高输出低血刺客/射手：放最右侧（先手位，战棋右侧先行动）
 * 4. 圣盾随从：放左侧嘲讽之后（能多扛一轮）
 * 5. 其他：放末尾
 */
function pickAiPosition(board: Minion[], m: Minion): number {
  // 嘲讽最左
  if (m.keywords.includes('taunt')) {
    return 0
  }
  // 亡语相邻 buff 卡放中间
  const hasAdjacentBuff = m.effects.some(
    (e) => e.trigger === 'deathrattle' && e.target === 'adjacent',
  )
  if (hasAdjacentBuff) {
    return Math.floor(board.length / 2)
  }
  // 圣盾随从放嘲讽之后（第 1-2 位）
  if (m.divineShield) {
    const tauntIdx = board.findIndex((b) => b.keywords.includes('taunt'))
    return tauntIdx >= 0 ? 1 : 0
  }
  // 高输出低血（刺客/射手型）放最右侧先手位
  if (m.attack > m.health * 1.2 && m.health <= 4) {
    return board.length
  }
  // 默认末尾
  return board.length
}

function findWeakest(board: Minion[]): number {
  let idx = 0
  let min = Infinity
  for (let i = 0; i < board.length; i++) {
    const v = minionValue(board[i])
    if (v < min) {
      min = v
      idx = i
    }
  }
  return idx
}

function findStrongest(hand: Minion[]): number {
  let idx = 0
  let max = -1
  for (let i = 0; i < hand.length; i++) {
    const v = minionValue(hand[i])
    if (v > max) {
      max = v
      idx = i
    }
  }
  return idx
}
