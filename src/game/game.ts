// 游戏核心逻辑 - 招募阶段 / 状态管理 / 回合流程
import type {
  GameState,
  PlayerState,
  Minion,
  CardDef,
  Tribe,
} from './types';
import {
  CARDS,
  CARD_MAP,
  HEROES,
  getSummonDef,
} from './cards';
import {
  TIER_MAX_BY_TAVERN,
  UPGRADE_BASE_COST,
  TAVERN_OFFER_COUNT,
  goldForTurn,
} from './types';

let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `m${uidCounter}`;
}

/** 从卡牌定义创建随从实例 */
export function createMinion(def: CardDef, golden = false): Minion {
  const mult = golden ? 2 : 1;
  const atk = def.attack * mult;
  const hp = def.health * mult;
  return {
    uid: nextUid(),
    defId: def.id,
    name: def.name,
    tribe: def.tribe,
    tier: def.tier,
    attack: atk,
    health: hp,
    maxHealth: hp,
    keywords: golden ? [...(def.keywords ?? [])] : [...(def.keywords ?? [])],
    effects: golden ? goldenizeEffects(def.effects ?? []) : [...(def.effects ?? [])],
    golden,
    divineShield: def.keywords?.includes('divineShield') ?? false,
    hasAttacked: false,
  };
}

/** 金卡效果强化：召唤物属性翻倍、buff 翻倍、伤害翻倍 */
function goldenizeEffects(
  effects: { trigger: any; target: any; tribe?: Tribe; buffAttack?: number; buffHealth?: number; summon?: any; damage?: number; divineShield?: boolean }[],
) {
  return effects.map((e) => ({
    ...e,
    buffAttack: e.buffAttack ? e.buffAttack * 2 : e.buffAttack,
    buffHealth: e.buffHealth ? e.buffHealth * 2 : e.buffHealth,
    damage: e.damage ? e.damage * 2 : e.damage,
    summon: e.summon
      ? { ...e.summon, attack: e.summon.attack * 2, health: e.summon.health * 2 }
      : e.summon,
  }));
}

/** 从衍生物定义创建随从 */
export function createSummonMinion(
  summon: { name: string; attack: number; health: number; tribe: Tribe },
): Minion {
  return createMinion(getSummonDef(summon));
}

/** 创建初始玩家 */
export function createPlayer(heroId: string, isAI: boolean): PlayerState {
  const hero = HEROES.find((h) => h.id === heroId) ?? HEROES[0];
  // 应用开局类英雄技能
  let tavernTier = 1;
  let upgradeCost = UPGRADE_BASE_COST[1];
  if (hero.power === 'startTier2') {
    // 麒麟：开局酒馆 2 级
    tavernTier = 2;
    upgradeCost = UPGRADE_BASE_COST[2];
  }
  return {
    hero: { ...hero },
    tavernTier,
    gold: goldForTurn(1),
    maxGold: goldForTurn(1),
    board: [],
    hand: [],
    tavern: [],
    frozen: false,
    isAI,
    upgradeCost,
  };
}

/** 创建新游戏 */
export function createGame(playerHeroId: string, enemyHeroId: string): GameState {
  const player = createPlayer(playerHeroId, false);
  const enemy = createPlayer(enemyHeroId, true);
  rollTavern(player);
  rollTavern(enemy);
  return {
    turn: 1,
    phase: 'recruit',
    player,
    enemy,
    log: [{ text: '第 1 回合 · 招募阶段', type: 'info' }],
    winner: null,
  };
}

/** 按酒馆等级过滤可购买的卡 */
function availableCards(tavernTier: number): CardDef[] {
  const maxTier = TIER_MAX_BY_TAVERN[tavernTier] ?? 1;
  return CARDS.filter((c) => c.tier <= maxTier);
}

/** 随机刷新酒馆 */
export function rollTavern(player: PlayerState): void {
  if (player.frozen && player.tavern.length > 0) {
    player.frozen = false;
    return;
  }
  const pool = availableCards(player.tavernTier);
  const count = TAVERN_OFFER_COUNT[player.tavernTier] ?? 3;
  player.tavern = [];
  for (let i = 0; i < count; i++) {
    const def = pool[Math.floor(Math.random() * pool.length)];
    player.tavern.push(createMinion(def));
  }
  player.frozen = false;
}

/** 购买随从（花 3 金币，加入手牌） */
export function buyMinion(player: PlayerState, tavernIndex: number): void {
  if (player.gold < 3) return;
  if (tavernIndex < 0 || tavernIndex >= player.tavern.length) return;
  if (player.hand.length >= 10) return;
  const minion = player.tavern.splice(tavernIndex, 1)[0];
  player.hand.push(minion);
  player.gold -= 3;
  checkTriple(player);
}

/** 卖出随从（+1 金币，上限 maxGold） */
export function sellMinion(player: PlayerState, boardIndex: number): boolean {
  if (boardIndex < 0 || boardIndex >= player.board.length) return false;
  player.board.splice(boardIndex, 1)[0];
  player.gold = Math.min(player.maxGold, player.gold + 1);
  return true;
}

/** 交换战场上两个随从的位置（用于站位策略） */
export function swapMinions(player: PlayerState, uidA: string, uidB: string): boolean {
  const ia = player.board.findIndex((m) => m.uid === uidA);
  const ib = player.board.findIndex((m) => m.uid === uidB);
  if (ia < 0 || ib < 0 || ia === ib) return false;
  const tmp = player.board[ia];
  player.board[ia] = player.board[ib];
  player.board[ib] = tmp;
  return true;
}

/** 打出随从到手牌指定战场位置。返回 true 表示该卡为三连金卡，需触发三选一奖励 */
export function playMinion(
  player: PlayerState,
  handIndex: number,
  boardIndex: number,
): boolean {
  if (handIndex < 0 || handIndex >= player.hand.length) return false;
  if (player.board.length >= 7) return false;
  const minion = player.hand.splice(handIndex, 1)[0];
  const insertAt = Math.min(boardIndex, player.board.length);
  player.board.splice(insertAt, 0, minion);
  // 触发战吼
  triggerBattlecry(player, minion);
  // 检查三连合成（打出过程中可能触发新的三连，合成后的金卡加入手牌）
  checkTriple(player);
  // 关键：三连奖励在打出金卡时触发（而不是合成瞬间）
  const triggerReward = !!minion.tripleRewardPending;
  minion.tripleRewardPending = false;
  return triggerReward;
}

/** 触发战吼 */
function triggerBattlecry(player: PlayerState, minion: Minion): void {
  const battles = minion.effects.filter((e) => e.trigger === 'battlecry');
  for (const e of battles) {
    applyEffect(player, minion, e, null);
  }
}

/**
 * 应用一个效果。enemy 可为 null（招募阶段无对手）。
 */
export function applyEffect(
  player: PlayerState,
  source: Minion,
  effect: {
    target: string;
    tribe?: Tribe;
    buffAttack?: number;
    buffHealth?: number;
    summon?: { name: string; attack: number; health: number; tribe: Tribe };
    damage?: number;
    divineShield?: boolean;
  },
  enemy: PlayerState | null,
): void {
  const idx = player.board.indexOf(source);
  switch (effect.target) {
    case 'self':
      buffMinion(source, effect.buffAttack, effect.buffHealth);
      break;
    case 'adjacent':
      if (idx > 0) buffMinion(player.board[idx - 1], effect.buffAttack, effect.buffHealth);
      if (idx >= 0 && idx < player.board.length - 1)
        buffMinion(player.board[idx + 1], effect.buffAttack, effect.buffHealth);
      break;
    case 'allAllies':
      for (const m of player.board) buffMinion(m, effect.buffAttack, effect.buffHealth);
      break;
    case 'allAlliesOfTribe':
      if (effect.tribe) {
        for (const m of player.board) {
          if (m.tribe === effect.tribe) buffMinion(m, effect.buffAttack, effect.buffHealth);
        }
      }
      break;
    case 'summonMinion':
      if (effect.summon && player.board.length < 7) {
        player.board.push(createSummonMinion(effect.summon));
      }
      break;
    case 'damageRandomEnemy':
      if (enemy && effect.damage && enemy.board.length > 0) {
        const target = enemy.board[Math.floor(Math.random() * enemy.board.length)];
        damageMinion(target, effect.damage);
      }
      break;
    default:
      break;
  }
}

function buffMinion(m: Minion, atk?: number, hp?: number): void {
  if (atk) m.attack += atk;
  if (hp) {
    m.health += hp;
    m.maxHealth += hp;
  }
}

/** 造成伤害（处理圣盾） */
export function damageMinion(m: Minion, dmg: number): void {
  if (m.divineShield && dmg > 0) {
    m.divineShield = false;
    return;
  }
  m.health -= dmg;
}

/** 检查并执行三连合成。合成出的金卡标记 tripleRewardPending，待打出时触发奖励 */
export function checkTriple(player: PlayerState): void {
  // 按 defId 分组，找手牌+战场中同名（金卡算2份）达到3的
  const all = [...player.hand, ...player.board];
  const groups: Record<string, Minion[]> = {};
  for (const m of all) {
    if (m.golden) continue;
    (groups[m.defId] ??= []).push(m);
  }
  for (const defId of Object.keys(groups)) {
    const group = groups[defId];
    if (group.length >= 3) {
      const [a, b, c] = group;
      removeFromPlayer(player, a.uid);
      removeFromPlayer(player, b.uid);
      removeFromPlayer(player, c.uid);
      const def = CARD_MAP[defId];
      const golden = createMinion(def, true);
      golden.tripleRewardPending = true; // 标记：打出时触发三选一奖励
      player.hand.push(golden);
      return;
    }
  }
}

/** 生成三连奖励三选一：从比当前酒馆等级 +1 星级的随从池中随机选 3 张 */
export function generateTripleReward(player: PlayerState): CardDef[] {
  const rewardTier = Math.min(6, player.tavernTier + 1);
  const pool = CARDS.filter((c) => c.tier === rewardTier);
  const rewards: CardDef[] = [];
  const used = new Set<number>();
  while (rewards.length < 3 && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    if (used.has(i)) {
      if (used.size >= pool.length) break;
      continue;
    }
    used.add(i);
    rewards.push(pool[i]);
  }
  return rewards;
}

/** 应用三连奖励：将选中的卡加入手牌 */
export function applyTripleReward(player: PlayerState, def: CardDef): void {
  if (player.hand.length >= 10) return;
  player.hand.push(createMinion(def));
  checkTriple(player);
}

function removeFromPlayer(player: PlayerState, uid: string): void {
  let i = player.hand.findIndex((m) => m.uid === uid);
  if (i >= 0) {
    player.hand.splice(i, 1);
    return;
  }
  i = player.board.findIndex((m) => m.uid === uid);
  if (i >= 0) player.board.splice(i, 1);
}

/** 刷新酒馆（白虎英雄每回合首次免费） */
export function refreshTavern(player: PlayerState): boolean {
  if (player.hero.power === 'freeRefreshOnce' && !player.hero.freeRefreshUsed) {
    player.hero.freeRefreshUsed = true;
    player.frozen = false;
    rollTavern(player);
    return true;
  }
  if (player.gold < 1) return false;
  player.gold -= 1;
  player.frozen = false;
  rollTavern(player);
  return true;
}

/** 冻结酒馆 */
export function freezeTavern(player: PlayerState): void {
  player.frozen = !player.frozen;
}

/** 升级酒馆 */
export function upgradeTavern(player: PlayerState): boolean {
  if (player.tavernTier >= 6) return false;
  if (player.gold < player.upgradeCost) return false;
  player.gold -= player.upgradeCost;
  player.tavernTier += 1;
  player.upgradeCost = UPGRADE_BASE_COST[player.tavernTier] ?? 99;
  return true;
}

/** 回合开始：发金币、重置攻击标记、触发回合开始效果、升级费递减 */
export function startTurn(state: GameState): void {
  state.turn += 1;
  const baseGold = goldForTurn(state.turn);
  for (const p of [state.player, state.enemy]) {
    let gold = baseGold;
    // 青龙技能：每回合开始 +1 金（不超过上限）
    if (p.hero.power === 'goldPlusOne') {
      gold = Math.min(10, gold + 1);
    }
    p.gold = gold;
    p.maxGold = Math.max(p.maxGold, gold);
    // 白虎技能：每回合重置免费刷新
    if (p.hero.power === 'freeRefreshOnce') {
      p.hero.freeRefreshUsed = false;
    }
    for (const m of p.board) m.hasAttacked = false;
    // 升级费每回合 -1
    if (p.tavernTier < 6) {
      p.upgradeCost = Math.max(0, p.upgradeCost - 1);
    }
    // 触发回合开始效果
    triggerStartOfTurn(p);
    // 刷新酒馆
    rollTavern(p);
  }
  state.phase = 'recruit';
  state.log.push({ text: `第 ${state.turn} 回合 · 招募阶段`, type: 'info' });
}

function triggerStartOfTurn(player: PlayerState): void {
  for (const m of player.board) {
    for (const e of m.effects) {
      if (e.trigger === 'startOfTurn') {
        applyEffect(player, m, e, null);
      }
    }
  }
}

/** 结束招募阶段：触发回合结束效果 */
export function endRecruitPhase(state: GameState): void {
  for (const p of [state.player, state.enemy]) {
    triggerEndOfTurn(p);
  }
  state.phase = 'combat';
}

function triggerEndOfTurn(player: PlayerState): void {
  for (const m of [...player.board]) {
    for (const e of m.effects) {
      if (e.trigger === 'endOfTurn') {
        applyEffect(player, m, e, null);
      }
    }
  }
}

/** 判断游戏是否结束 */
export function checkGameOver(state: GameState): void {
  if (state.player.hero.health <= 0 && state.enemy.hero.health <= 0) {
    state.phase = 'gameover';
    state.winner = null; // 平局
    return;
  }
  if (state.player.hero.health <= 0) {
    state.phase = 'gameover';
    state.winner = 'enemy';
    return;
  }
  if (state.enemy.hero.health <= 0) {
    state.phase = 'gameover';
    state.winner = 'player';
  }
}

/** 玩家受到战斗伤害（朱雀英雄：每局首次战败少受 5 伤） */
export function dealDamageToHero(state: GameState, who: 'player' | 'enemy', dmg: number): void {
  const target = who === 'player' ? state.player : state.enemy;
  let remaining = dmg;
  // 朱雀技能：首次承受伤害时减 5（只在血量会因此扣到 0 以下时触发，更有"保命"体验）
  if (target.hero.power === 'saveOnce' && !target.hero.saveUsed && remaining > 0) {
    remaining = Math.max(0, remaining - 5);
    target.hero.saveUsed = true;
  }
  if (target.hero.armor > 0) {
    const absorbed = Math.min(target.hero.armor, remaining);
    target.hero.armor -= absorbed;
    target.hero.health -= remaining - absorbed;
  } else {
    target.hero.health -= remaining;
  }
}
