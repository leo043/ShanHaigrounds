// AI 对手 - 招募阶段决策
import type { GameState, PlayerState, Minion, CardDef } from './types';
import {
  buyMinion,
  sellMinion,
  playMinion,
  refreshTavern,
  upgradeTavern,
  generateTripleReward,
  applyTripleReward,
} from './game';

/** 随从价值评估（用于 AI 决策） */
function minionValue(m: Minion): number {
  let v = m.attack + m.health;
  if (m.keywords.includes('taunt')) v += 2;
  if (m.keywords.includes('divineShield')) v += 3;
  if (m.keywords.includes('reborn')) v += 3;
  if (m.effects.length > 0) v += 3;
  if (m.golden) v += 10;
  return v;
}

/** 卡牌定义价值（用于 AI 选三连奖励） */
function cardDefValue(def: CardDef): number {
  let v = def.attack + def.health;
  if (def.keywords?.includes('taunt')) v += 2;
  if (def.keywords?.includes('divineShield')) v += 3;
  if (def.keywords?.includes('reborn')) v += 3;
  if (def.effects && def.effects.length > 0) v += 3;
  v += def.tier; // 高星卡更值钱
  return v;
}

/** 执行 AI 一整个招募回合 */
export function runAITurn(state: GameState): void {
  const ai = state.enemy;
  let actions = 0;
  const maxActions = 30; // 防止死循环

  while (actions < maxActions) {
    actions++;

    // 1. 优先升级酒馆（前期且有钱）
    if (shouldUpgrade(ai)) {
      if (upgradeTavern(ai)) {
        continue;
      }
    }

    // 2. 尝试凑三连：买酒馆里能凑三连的
    const buyForTriple = findTripleBuy(ai);
    if (buyForTriple >= 0 && ai.gold >= 3) {
      buyMinion(ai, buyForTriple);
      // 买完直接尝试打出
      tryPlayHand(ai);
      continue;
    }

    // 3. 买价值高的同族随从
    const buyIdx = findBestBuy(ai);
    if (buyIdx >= 0 && ai.gold >= 3 && ai.hand.length < 10) {
      buyMinion(ai, buyIdx);
      continue;
    }

    // 4. 打出手牌
    if (ai.hand.length > 0 && ai.board.length < 7) {
      tryPlayHand(ai);
      continue;
    }

    // 5. 战场满了且有弱随从，卖掉换更强的
    if (ai.board.length >= 7 && ai.hand.length > 0) {
      const weakest = findWeakest(ai.board);
      const strongest = findStrongest(ai.hand);
      if (weakest >= 0 && strongest >= 0 && minionValue(ai.hand[strongest]) > minionValue(ai.board[weakest]) + 2) {
        sellMinion(ai, weakest);
        continue;
      }
    }

    // 6. 还有钱且酒馆没好货，刷新一次
    if (ai.gold >= 2 && ai.tavern.every((m) => minionValue(m) < 5) && ai.tavernTier < 6) {
      refreshTavern(ai);
      continue;
    }

    // 7. 没事做了，结束
    break;
  }

  // 确保手牌尽量打出
  while (ai.hand.length > 0 && ai.board.length < 7) {
    tryPlayHand(ai);
  }
}

/** 是否应该升级酒馆 */
function shouldUpgrade(ai: PlayerState): boolean {
  if (ai.tavernTier >= 6) return false;
  // 前 3 回合优先升级，且金币够
  if (ai.upgradeCost <= ai.gold && ai.tavernTier <= 2) return true;
  if (ai.upgradeCost <= 2 && ai.gold >= ai.upgradeCost) return true;
  return false;
}

/** 找酒馆里能凑三连的随从索引 */
function findTripleBuy(ai: PlayerState): number {
  const owned = [...ai.board, ...ai.hand];
  for (let i = 0; i < ai.tavern.length; i++) {
    const m = ai.tavern[i];
    const count = owned.filter((o) => o.defId === m.defId && !o.golden).length;
    if (count >= 2) return i; // 已有2张，再买第3张即可三连
  }
  return -1;
}

/** 找酒馆里最值得买的（优先同族、高价值） */
function findBestBuy(ai: PlayerState): number {
  const tribeCount = countTribes(ai.board);
  let bestIdx = -1;
  let bestScore = -1;
  for (let i = 0; i < ai.tavern.length; i++) {
    const m = ai.tavern[i];
    let score = minionValue(m);
    // 同族加成
    score += (tribeCount[m.tribe] ?? 0) * 2;
    // 嘲讽优先（前期缺肉盾）
    if (m.keywords.includes('taunt') && ai.board.filter((b) => b.keywords.includes('taunt')).length === 0) {
      score += 3;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore >= 4 ? bestIdx : -1;
}

/** 统计战场上各族数量 */
function countTribes(board: Minion[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const m of board) c[m.tribe] = (c[m.tribe] ?? 0) + 1;
  return c;
}

/** 尝试打出手牌（优先高价值的，按 AI 站位策略放置） */
function tryPlayHand(ai: PlayerState): void {
  if (ai.hand.length === 0 || ai.board.length >= 7) return;
  // 选价值最高的手牌
  let bestIdx = 0;
  let bestVal = -1;
  for (let i = 0; i < ai.hand.length; i++) {
    const v = minionValue(ai.hand[i]);
    if (v > bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  }
  const m = ai.hand[bestIdx];
  const pos = pickAiPosition(ai.board, m);
  const triggered = playMinion(ai, bestIdx, pos);
  // AI 打出金卡触发三连奖励：自动选价值最高的奖励卡
  if (triggered) {
    const rewards = generateTripleReward(ai);
    if (rewards.length > 0) {
      let pick = rewards[0];
      let pickVal = -1;
      for (const r of rewards) {
        const v = cardDefValue(r);
        if (v > pickVal) {
          pickVal = v;
          pick = r;
        }
      }
      applyTripleReward(ai, pick);
    }
  }
}

/**
 * AI 站位策略（替代原"嘲讽永远最左"）：
 * 1. 嘲讽：分散放置。第一个嘲讽放最左（0），第二个放右侧 1/3 处，第三个放右侧 2/3 处
 * 2. 亡语相邻 buff 卡：放中间位置（影响更多相邻随从）
 * 3. 高输出低血（attack > health * 1.5 且无嘲讽）：放右侧末尾，避免先被解
 * 4. 其他：放末尾
 */
function pickAiPosition(board: Minion[], m: Minion): number {
  // 嘲讽分散
  if (m.keywords.includes('taunt')) {
    const tauntCount = board.filter((b) => b.keywords.includes('taunt')).length;
    if (tauntCount === 0) return 0;
    if (tauntCount === 1) return Math.max(1, Math.floor(board.length / 3));
    return Math.min(board.length, Math.floor((board.length * 2) / 3));
  }
  // 亡语相邻 buff 卡放中间
  const hasAdjacentBuff = m.effects.some(
    (e) => e.trigger === 'deathrattle' && e.target === 'adjacent',
  );
  if (hasAdjacentBuff) {
    return Math.floor(board.length / 2);
  }
  // 高输出低血放末尾（右后方）
  if (m.attack > m.health * 1.5 && m.health <= 3) {
    return board.length;
  }
  // 默认末尾
  return board.length;
}

function findWeakest(board: Minion[]): number {
  let idx = 0;
  let min = Infinity;
  for (let i = 0; i < board.length; i++) {
    const v = minionValue(board[i]);
    if (v < min) {
      min = v;
      idx = i;
    }
  }
  return idx;
}

function findStrongest(hand: Minion[]): number {
  let idx = 0;
  let max = -1;
  for (let i = 0; i < hand.length; i++) {
    const v = minionValue(hand[i]);
    if (v > max) {
      max = v;
      idx = i;
    }
  }
  return idx;
}
