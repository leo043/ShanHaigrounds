// 类型定义 - 山海战棋

/** 三族：人 / 妖 / 仙 */
export type Tribe = 'human' | 'demon' | 'spirit'

/** 六职业 */
export type Class = 'warrior' | 'assassin' | 'mage' | 'archer' | 'priest' | 'shaman'

/** 关键词效果 */
export type Keyword = 'taunt' | 'divineShield' | 'poison' | 'windfury' | 'reborn'

/** 羁绊激活信息 */
export interface SynergyInfo {
  tag: string
  tagType: 'tribe' | 'class'
  count: number
  activeLevel: number
  maxLevel: number
  levelThresholds: number[]
  description: string
}

/** 种族羁绊激活阈值 */
export const TRIBE_SYNERGY_LEVELS: Record<Tribe, number[]> = {
  human: [2, 4, 6],
  demon: [2, 4, 6],
  spirit: [2, 4, 6],
}

/** 职业羁绊激活阈值 */
export const CLASS_SYNERGY_LEVELS: Record<Class, number[]> = {
  warrior: [2, 4],
  assassin: [2, 4],
  mage: [2, 4],
  archer: [2, 4],
  priest: [2, 4],
  shaman: [2, 4],
}

/** 种族羁绊效果描述 */
export const TRIBE_SYNERGY_DESC: Record<Tribe, string[]> = {
  human: ['全体人族 +1 攻击', '全体人族 +1/+1', '人定胜天：全体人族攻击翻倍但生命减半'],
  demon: ['全体妖族 +1 生命', '全体妖族 +1/+1', '至死方休：全体妖族 +2/+2 且获得复生'],
  spirit: ['全体仙族 +1 攻击', '全体仙族 +1/+1', '仙风道骨：全体仙族获得圣盾'],
}

/** 职业羁绊效果描述 */
export const CLASS_SYNERGY_DESC: Record<Class, string[]> = {
  warrior: ['全体 +2 生命', '嘲讽随从 +3 攻击'],
  assassin: ['全体 +2 攻击', '首次攻击双倍伤害'],
  mage: ['战斗开始全体敌方各 1 伤害', '战斗开始随机消灭一个敌人'],
  archer: ['全体 +1 攻击', '风怒随从 +2 攻击'],
  priest: ['回合结束 +1/+1', '回合结束 +2/+2'],
  shaman: ['召唤物 +1/+1', '召唤物 +2/+2 且获得嘲讽'],
}

/** 触发时机 */
export type TriggerType =
  | 'battlecry' // 战吼：打出时
  | 'deathrattle' // 亡语：死亡时
  | 'endOfTurn' // 回合结束
  | 'startOfTurn' // 回合开始
  | 'onSummon' // 召唤时（被召唤/打出时触发）
  | 'combatStart' // 战斗开始时

/** 效果目标 */
export type EffectTarget =
  | 'self'
  | 'adjacent' // 相邻友方
  | 'allAllies' // 全体友方
  | 'allAlliesOfTribe' // 同族友方
  | 'summonMinion' // 召唤衍生物
  | 'damageRandomEnemy' // 随机敌随从伤害
  | 'randomAlly' // 随机友方随从
  | 'none'

/** 效果动作 */
export interface Effect {
  trigger: TriggerType
  target: EffectTarget
  tribe?: Tribe // 针对 allAlliesOfTribe 时的种族
  buffAttack?: number // 加攻击
  buffHealth?: number // 加血量
  summon?: { name: string; attack: number; health: number; tribe: Tribe } // 召唤的衍生物
  damage?: number // 造成的伤害
  divineShield?: boolean // 赋予圣盾
}

/** 卡牌原型（静态定义） */
export interface CardDef {
  id: string
  name: string
  tribe: Tribe
  class: Class
  tier: number // 星级 1-5（对应酒馆等级）
  attack: number
  health: number
  keywords?: Keyword[]
  effects?: Effect[]
  flavor?: string // 风味文字
}

/** 场上随从实例（运行时） */
export interface Minion {
  uid: string // 唯一实例 id
  defId: string
  name: string
  tribe: Tribe
  class: Class
  tier: number
  attack: number
  health: number
  maxHealth: number
  keywords: Keyword[]
  effects: Effect[]
  golden: boolean // 是否三连金卡
  divineShield: boolean
  hasAttacked: boolean
  // 羁绊加成追踪（每回合重置再重新计算）
  synergyBuffAttack: number
  synergyBuffHealth: number
  synergyBuffMaxHealth: number
  synergyAddedKeywords: Keyword[]
  // 状态标记
  poisoned?: boolean
  rebornUsed?: boolean // 复生是否已触发
  tripleRewardPending?: boolean // 三连金卡待触发奖励（打出时触发）
}

/** 英雄技能 id（决定被动效果触发点） */
export type HeroPower =
  | 'armorStart' // 玄武：开局 +5 护甲
  | 'nirvana' // 朱雀：首次死亡时以 1 血复活
  | 'freeRefreshOnce' // 白虎：每回合首次刷新免费
  | 'goldPlusOne' // 青龙：每回合开始 +1 金
  | 'startTier2' // 麒麟：开局酒馆 2 级

/** 英雄 */
export interface Hero {
  id: string
  name: string
  title: string
  health: number
  armor: number
  power: HeroPower
  powerName: string // 技能名称
  powerDesc: string // 技能描述（UI 显示）
  // 运行时状态（不计入英雄定义对比）
  saveUsed?: boolean // 朱雀保命是否已用
  freeRefreshUsed?: boolean // 白虎本回合免费刷新是否已用
}

/** 玩家状态 */
export interface PlayerState {
  hero: Hero
  tavernTier: number // 当前酒馆等级 1-6
  gold: number
  maxGold: number
  board: Minion[] // 战场（最多 7）
  hand: Minion[] // 手牌
  tavern: Minion[] // 酒馆待购
  frozen: boolean // 是否冻结酒馆
  isAI: boolean
  // 升级酒馆剩余费用（每回合 -1）
  upgradeCost: number
}

/** 游戏阶段 */
export type Phase = 'recruit' | 'combat' | 'gameover'

/** 战斗日志条目 */
export interface CombatLogEntry {
  text: string
  type: 'attack' | 'death' | 'shield' | 'damage' | 'info'
}

/** 完整游戏状态 */
export interface GameState {
  turn: number // 回合数
  phase: Phase
  player: PlayerState
  enemy: PlayerState
  log: CombatLogEntry[]
  winner: 'player' | 'enemy' | null
  // 升级酒馆的基准费用表（1->2 是 5，依次递增）
}

/** 酒馆各等级可购买的随从星级上限 */
export const TIER_MAX_BY_TAVERN: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 5,
}

/** 升级酒馆的基准费用（从 tier n 升到 n+1） */
export const UPGRADE_BASE_COST: Record<number, number> = {
  1: 5, // 1->2
  2: 7, // 2->3
  3: 8, // 3->4
  4: 10, // 4->5
  5: 10, // 5->6
}

/** 各酒馆等级刷新出的随从数量 */
export const TAVERN_OFFER_COUNT: Record<number, number> = {
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 7,
  6: 8,
}

/** 各酒馆等级每回合起始金币 */
export function goldForTurn(turn: number): number {
  // 第1回合3金，每回合+1，上限10
  return Math.min(10, 2 + turn)
}
