// simulateCombat 单元测试 - 覆盖核心战斗机制
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { simulateCombat } from './combat'
import { createGame, createMinion } from './game'
import { CARD_MAP } from './cards'
import type { GameState, Minion } from './types'

/** 构造测试用游戏状态：用真实 createGame 初始化，仅替换 board */
function makeState(playerBoard: Minion[], enemyBoard: Minion[]): GameState {
  const state = createGame('hero_xuanwu', 'hero_baihu')
  state.player.board = playerBoard
  state.enemy.board = enemyBoard
  return state
}

/** 按 defId 从卡池创建随从 */
function m(defId: string, golden = false): Minion {
  return createMinion(CARD_MAP[defId], golden)
}

/** 从战斗步骤中提取所有文本（便于断言关键事件） */
function stepTexts(steps: ReturnType<typeof simulateCombat>['steps']): string[] {
  return steps.map((s) => s.text)
}

describe('simulateCombat', () => {
  beforeEach(() => {
    // 固定随机：player 先手（0 < 0.5）、总是选池中第一个目标
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ========== 基础胜负判定 ==========

  it('双方空板应判为平局，无伤害', () => {
    const result = simulateCombat(makeState([], []))
    expect(result.winner).toBe('tie')
    expect(result.damageToLoser).toBe(0)
    expect(result.survivorBoard).toHaveLength(0)
    expect(result.enemySurvivorBoard).toHaveLength(0)
  })

  it('一方有随从、另一方空板应直接获胜，伤害=星级+酒馆等级', () => {
    // 游侠 tier=1, tavernTier=1 → damage = 1 + 1 = 2
    const result = simulateCombat(makeState([m('human_archer')], []))
    expect(result.winner).toBe('player')
    expect(result.damageToLoser).toBe(2)
  })

  it('两个相同随从对撞应同归于尽，判平局', () => {
    // 山魈 3/2 vs 山魈 3/2：互相造成 3 伤害，都剩 -1
    const result = simulateCombat(makeState([m('demon_imp')], [m('demon_imp')]))
    expect(result.winner).toBe('tie')
    expect(result.survivorBoard).toHaveLength(0)
    expect(result.enemySurvivorBoard).toHaveLength(0)
  })

  // ========== 关键词机制 ==========

  it('圣盾应抵消首次伤害，随后反击击杀攻击者', () => {
    // 山魈 3/2 攻击灵童 2/2(圣盾)：灵童圣盾抵消，灵童反击山魈造成 2 伤害，山魈死
    const result = simulateCombat(makeState([m('demon_imp')], [m('spirit_child')]))
    expect(result.winner).toBe('enemy')
    expect(result.survivorBoard).toHaveLength(0)
    // 灵童存活（圣盾已破，但战斗后回满血、圣盾恢复）
    expect(result.enemySurvivorBoard).toHaveLength(1)
    expect(result.enemySurvivorBoard[0].defId).toBe('spirit_child')
    // 战斗日志应出现圣盾抵消
    expect(stepTexts(result.steps).some((t) => t.includes('圣盾'))).toBe(true)
  })

  it('剧毒应一击毙命高血量嘲讽随从', () => {
    // 青衫剑客 3/2(剧毒) vs 铜甲卫 1/4(嘲讽)：剧毒直接归零铜甲卫血量
    // 铜甲卫反击 1 伤，青衫剑客 2 血剩 1 存活（战棋规则：剧毒不阻止反击伤害）
    const result = simulateCombat(makeState([m('human_swordsman')], [m('human_guard')]))
    expect(result.winner).toBe('player')
    expect(result.enemySurvivorBoard).toHaveLength(0)
    expect(result.survivorBoard[0].defId).toBe('human_swordsman')
    expect(stepTexts(result.steps).some((t) => t.includes('剧毒'))).toBe(true)
  })

  it('嘲讽应强制攻击方优先攻击嘲讽随从', () => {
    // p=[山魈3/2], e=[铜甲卫1/4(嘲讽), 灵童2/2(圣盾)]
    // e 先手(2>1)：铜甲卫打山魈，山魈反击铜甲卫。p 回合：山魈打嘲讽铜甲卫(而非灵童)
    const shanjing = m('demon_imp') // 山魈
    const taunt = m('human_guard') // 铜甲卫 1/4 嘲讽
    const shield = m('spirit_child') // 灵童 2/2 圣盾
    const result = simulateCombat(makeState([shanjing], [taunt, shield]))
    expect(result.winner).toBe('enemy')
    // 精确找山魈(player 的随从)的攻击步骤，验证其目标是嘲讽随从
    const shanjingAttack = result.steps.find(
      (s) => s.type === 'attackStart' && s.attackerUid === shanjing.uid,
    )
    expect(shanjingAttack).toBeDefined()
    expect(shanjingAttack?.defenderUid).toBe(taunt.uid)
  })

  it('风怒应允许一回合攻击两次', () => {
    // 金卡游侠 4/4(风怒) + 灵童 2/2 vs 小妖兵1/3(嘲讽) × 2
    // 2v2 player 先手：游侠连击两个小妖兵，每次受 1 反击剩 3/2，存活
    const result = simulateCombat(
      makeState(
        [m('human_archer', true), m('spirit_child')],
        [m('demon_goblin'), m('demon_goblin')],
      ),
    )
    expect(result.winner).toBe('player')
    // 金卡游侠应存活
    expect(result.survivorBoard.some((mm) => mm.defId === 'human_archer')).toBe(true)
    // 应出现风怒·二击的日志
    expect(stepTexts(result.steps).some((t) => t.includes('风怒·二击'))).toBe(true)
  })

  it('复生应在死亡后以 1 血复活一次', () => {
    // 不死剑仙 4/3(复生) vs 牛魔王 7/7(嘲讽)
    // p 先手：不死剑仙打牛魔王(嘲讽) 4 伤，牛魔王反击 7 伤杀死不死剑仙
    // 复生！不死剑仙 1 血复活。e 回合：牛魔王再杀不死剑仙(不复生)
    const result = simulateCombat(makeState([m('human_immortal')], [m('demon_niutou')]))
    expect(result.winner).toBe('enemy')
    // 应有复生事件
    expect(result.steps.some((s) => s.type === 'reborn')).toBe(true)
    expect(stepTexts(result.steps).some((t) => t.includes('复生'))).toBe(true)
  })

  // ========== 亡语与召唤 ==========

  it('亡语召唤应在随从死亡时触发', () => {
    // 蛇魅 2/3(亡语召唤小蛇1/1) vs 牛魔王 7/7(嘲讽)
    // p 先手：蛇魅打牛魔王 2 伤，牛魔王反击杀蛇魅。蛇魅亡语召唤小蛇。
    // e 回合：牛魔王杀小蛇。p 空板败。
    const result = simulateCombat(makeState([m('demon_snake')], [m('demon_niutou')]))
    expect(result.winner).toBe('enemy')
    expect(result.steps.some((s) => s.type === 'summon')).toBe(true)
    expect(stepTexts(result.steps).some((t) => t.includes('亡语') && t.includes('召唤'))).toBe(true)
  })

  // ========== 金卡机制 ==========

  it('金卡属性应翻倍，伤害按星级×2 计算', () => {
    // 金卡山魈 6/4 vs 普通山魈 3/2：一击击杀
    // damage = tierDamage(金卡山魈 tier=1×2) + tavernTier(1) = 2 + 1 = 3
    const result = simulateCombat(makeState([m('demon_imp', true)], [m('demon_imp')]))
    expect(result.winner).toBe('player')
    expect(result.damageToLoser).toBe(3)
    expect(result.survivorBoard[0].golden).toBe(true)
    expect(result.survivorBoard[0].attack).toBe(6)
    expect(result.survivorBoard[0].health).toBe(4)
  })

  it('金卡亡语召唤物属性应翻倍', () => {
    // 金卡蛇魅 4/6(亡语召唤小蛇，金卡翻倍→小蛇 2/4) vs 牛魔王 7/7(嘲讽)
    // 蛇魅死亡后亡语召唤的小蛇应是 2/4（金卡效果强化）
    const goldenSnake = m('demon_snake', true)
    const result = simulateCombat(makeState([goldenSnake], [m('demon_niutou')]))
    // 找到召唤步骤
    const summonStep = result.steps.find((s) => s.type === 'summon')
    expect(summonStep).toBeDefined()
    // 从快照中找到召唤物（小蛇），验证属性翻倍
    const summoned = summonStep?.snap.p.find((mm) => mm.name === '小蛇')
    expect(summoned).toBeDefined()
    expect(summoned?.attack).toBe(2)
    expect(summoned?.health).toBe(4)
  })

  // ========== 战斗后状态恢复 ==========

  it('战斗后存活随从应回满血，复生状态重置', () => {
    // 牛魔王 7/7 vs 山魈 3/2：牛魔王受 3 剩 4，山魈受 7 死。战斗后牛魔王回满血 7
    const result = simulateCombat(makeState([m('demon_niutou')], [m('demon_imp')]))
    expect(result.winner).toBe('player')
    const survivor = result.survivorBoard[0]
    expect(survivor.defId).toBe('demon_niutou')
    expect(survivor.health).toBe(survivor.maxHealth)
  })

  it('不应修改原始 state（战斗在副本上进行）', () => {
    const originalBoard = [m('demon_imp')]
    const originalHp = originalBoard[0].health
    const state = makeState(originalBoard, [m('human_archer')])
    simulateCombat(state)
    // 原始 board 的随从血量不应变化
    expect(state.player.board[0].health).toBe(originalHp)
  })

  // ========== 边界场景 ==========

  it('战斗日志首步应包含双方随从数量', () => {
    const result = simulateCombat(makeState([m('demon_imp'), m('demon_imp')], [m('demon_imp')]))
    const firstStep = result.steps[0]
    expect(firstStep.type).toBe('info')
    expect(firstStep.text).toContain('2')
    expect(firstStep.text).toContain('1')
  })
})
