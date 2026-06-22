// game.ts 核心逻辑单元测试 - 金币/升级/三连/英雄技能/买卖
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createGame,
  createPlayer,
  createMinion,
  buyMinion,
  sellMinion,
  playMinion,
  swapMinions,
  refreshTavern,
  freezeTavern,
  upgradeTavern,
  startTurn,
  endRecruitPhase,
  dealDamageToHero,
  checkGameOver,
  checkTriple,
  generateTripleReward,
  applyTripleReward,
  resetUid,
} from './game'
import { CARD_MAP, HEROES, CARDS } from './cards'
import { goldForTurn, UPGRADE_BASE_COST, TAVERN_OFFER_COUNT } from './types'
import type { PlayerState } from './types'

/** 按 defId 从卡池创建随从 */
function m(defId: string, golden = false) {
  return createMinion(CARD_MAP[defId], golden)
}

/** 创建一个干净的测试玩家（指定英雄，空棋盘） */
function makePlayer(heroId = 'hero_xuanwu'): PlayerState {
  return createPlayer(heroId, false)
}

describe('createMinion', () => {
  beforeEach(() => resetUid())

  it('普通卡属性应等于卡牌定义', () => {
    const minion = m('demon_imp') // 山魈 3/2
    expect(minion.attack).toBe(3)
    expect(minion.health).toBe(2)
    expect(minion.maxHealth).toBe(2)
    expect(minion.golden).toBe(false)
    expect(minion.uid).toBe('m1')
  })

  it('金卡属性应翻倍', () => {
    const golden = m('demon_imp', true) // 金卡山魈 6/4
    expect(golden.attack).toBe(6)
    expect(golden.health).toBe(4)
    expect(golden.maxHealth).toBe(4)
    expect(golden.golden).toBe(true)
  })

  it('金卡效果数值应翻倍', () => {
    // 蛇魅：亡语召唤小蛇 1/1，金卡应为 2/2
    const golden = m('demon_snake', true)
    const summon = golden.effects[0]?.summon
    expect(summon?.attack).toBe(2)
    expect(summon?.health).toBe(2)
  })

  it('金卡关键词不翻倍（保持原样）', () => {
    // 游侠：风怒，金卡仍只有一个风怒
    const golden = m('human_archer', true)
    expect(golden.keywords).toEqual(['windfury'])
  })

  it('圣盾随从应初始化 divineShield=true', () => {
    const minion = m('spirit_child') // 灵童 2/2 圣盾
    expect(minion.divineShield).toBe(true)
  })

  it('无圣盾随从应初始化 divineShield=false', () => {
    const minion = m('demon_imp')
    expect(minion.divineShield).toBe(false)
  })
})

describe('resetUid', () => {
  it('重置后 uid 应从 m1 重新开始', () => {
    resetUid()
    expect(createMinion(CARD_MAP['demon_imp']).uid).toBe('m1')
    expect(createMinion(CARD_MAP['demon_imp']).uid).toBe('m2')
    resetUid()
    expect(createMinion(CARD_MAP['demon_imp']).uid).toBe('m1')
  })
})

describe('金币系统', () => {
  it('goldForTurn: 第1回合3金，每回合+1，上限10', () => {
    expect(goldForTurn(1)).toBe(3)
    expect(goldForTurn(2)).toBe(4)
    expect(goldForTurn(5)).toBe(7)
    expect(goldForTurn(8)).toBe(10) // 2+8=10，封顶
    expect(goldForTurn(99)).toBe(10) // 不超上限
  })
})

describe('createPlayer / 英雄技能', () => {
  it('玄武应开局获得 5 护甲', () => {
    const p = makePlayer('hero_xuanwu')
    expect(p.hero.armor).toBe(5)
  })

  it('麒麟应开局酒馆 2 级，升级费对应 2→3', () => {
    const p = makePlayer('hero_qilin')
    expect(p.tavernTier).toBe(2)
    expect(p.upgradeCost).toBe(UPGRADE_BASE_COST[2])
  })

  it('非麒麟英雄应开局酒馆 1 级，升级费 5', () => {
    const p = makePlayer('hero_xuanwu')
    expect(p.tavernTier).toBe(1)
    expect(p.upgradeCost).toBe(UPGRADE_BASE_COST[1])
  })

  it('第1回合金币应为3', () => {
    const p = makePlayer()
    expect(p.gold).toBe(3)
    expect(p.maxGold).toBe(3)
  })
})

describe('startTurn / 回合开始', () => {
  it('青龙技能应每回合开始 +1 金（不超过10）', () => {
    const state = createGame('hero_qinglong', 'hero_baihu')
    state.turn = 2 // startTurn 会 +1 到 3
    startTurn(state)
    // goldForTurn(3) = 5, +1 青龙 = 6
    expect(state.player.gold).toBe(6)
  })

  it('白虎技能应在回合开始重置免费刷新', () => {
    const state = createGame('hero_baihu', 'hero_xuanwu')
    // 用掉免费刷新
    state.player.hero.freeRefreshUsed = true
    startTurn(state) // turn 1→2
    expect(state.player.hero.freeRefreshUsed).toBe(false)
  })

  it('升级费应每回合 -1（不低于0）', () => {
    const state = createGame('hero_xuanwu', 'hero_baihu')
    const initialCost = state.player.upgradeCost
    startTurn(state) // turn 1→2
    expect(state.player.upgradeCost).toBe(Math.max(0, initialCost - 1))
  })

  it('金币应随回合递增', () => {
    const state = createGame('hero_xuanwu', 'hero_baihu')
    expect(state.player.gold).toBe(3) // 第1回合
    startTurn(state) // → 第2回合
    expect(state.player.gold).toBe(4)
    startTurn(state) // → 第3回合
    expect(state.player.gold).toBe(5)
  })
})

describe('buyMinion / sellMinion', () => {
  it('购买应扣 3 金、从酒馆移入手牌', () => {
    const p = makePlayer()
    p.tavern = [m('demon_imp')]
    const initialGold = p.gold
    buyMinion(p, 0)
    expect(p.gold).toBe(initialGold - 3)
    expect(p.tavern).toHaveLength(0)
    expect(p.hand).toHaveLength(1)
    expect(p.hand[0].defId).toBe('demon_imp')
  })

  it('金币不足时购买应失败（不扣金不入手牌）', () => {
    const p = makePlayer()
    p.gold = 2
    p.tavern = [m('demon_imp')]
    buyMinion(p, 0)
    expect(p.gold).toBe(2)
    expect(p.hand).toHaveLength(0)
    expect(p.tavern).toHaveLength(1)
  })

  it('手牌满（10张）时购买应失败', () => {
    const p = makePlayer()
    p.gold = 99
    p.hand = Array.from({ length: 10 }, () => m('demon_imp'))
    p.tavern = [m('demon_imp')]
    buyMinion(p, 0)
    expect(p.hand).toHaveLength(10)
    expect(p.tavern).toHaveLength(1)
  })

  it('卖出应 +1 金（不超过 maxGold）、从战场移除', () => {
    const p = makePlayer()
    p.gold = 3
    p.maxGold = 10
    p.board = [m('demon_imp')]
    sellMinion(p, 0)
    expect(p.gold).toBe(4)
    expect(p.board).toHaveLength(0)
  })

  it('卖出回金不应超过 maxGold', () => {
    const p = makePlayer()
    p.gold = 10
    p.maxGold = 10
    p.board = [m('demon_imp')]
    sellMinion(p, 0)
    expect(p.gold).toBe(10) // 已满，不加
  })
})

describe('upgradeTavern', () => {
  it('金币足够时应升级成功，扣金、等级+1、更新升级费', () => {
    const p = makePlayer()
    p.gold = 99
    const initialTier = p.tavernTier
    upgradeTavern(p)
    expect(p.tavernTier).toBe(initialTier + 1)
    expect(p.upgradeCost).toBe(UPGRADE_BASE_COST[p.tavernTier])
  })

  it('金币不足时应失败', () => {
    const p = makePlayer()
    p.gold = 2
    p.upgradeCost = 5
    upgradeTavern(p)
    expect(p.tavernTier).toBe(1)
    expect(p.gold).toBe(2)
  })

  it('酒馆 6 级时不应再升级', () => {
    const p = makePlayer()
    p.tavernTier = 6
    p.gold = 99
    upgradeTavern(p)
    expect(p.tavernTier).toBe(6)
  })
})

describe('refreshTavern / freezeTavern', () => {
  it('白虎首次刷新应免费', () => {
    const p = makePlayer('hero_baihu')
    p.gold = 3
    const goldBefore = p.gold
    refreshTavern(p)
    expect(p.gold).toBe(goldBefore) // 不扣金
    expect(p.hero.freeRefreshUsed).toBe(true)
  })

  it('白虎第二次刷新应扣 1 金', () => {
    const p = makePlayer('hero_baihu')
    p.hero.freeRefreshUsed = true
    p.gold = 3
    refreshTavern(p)
    expect(p.gold).toBe(2)
  })

  it('冻结后回合开始应保持原酒馆内容不变', () => {
    const state = createGame('hero_xuanwu', 'hero_baihu')
    const originalUid = state.player.tavern[0].uid
    freezeTavern(state.player) // 冻结
    expect(state.player.frozen).toBe(true)
    startTurn(state) // 回合开始 → rollTavern 应跳过刷新
    expect(state.player.tavern[0].uid).toBe(originalUid) // 内容不变
    expect(state.player.frozen).toBe(false) // 冻结消费后重置
  })

  it('金币为0时非白虎英雄刷新应失败', () => {
    const p = makePlayer('hero_xuanwu')
    p.gold = 0
    const result = refreshTavern(p)
    expect(result).toBe(false)
  })
})

describe('swapMinions', () => {
  it('应交换两个随从的战场位置', () => {
    const p = makePlayer()
    const a = m('demon_imp')
    const b = m('human_archer')
    p.board = [a, b]
    swapMinions(p, a.uid, b.uid)
    expect(p.board[0]).toBe(b)
    expect(p.board[1]).toBe(a)
  })

  it('同一随从不应交换', () => {
    const p = makePlayer()
    const a = m('demon_imp')
    p.board = [a]
    expect(swapMinions(p, a.uid, a.uid)).toBe(false)
  })

  it('不存在的 uid 应返回 false', () => {
    const p = makePlayer()
    p.board = [m('demon_imp')]
    expect(swapMinions(p, 'nonexistent', p.board[0].uid)).toBe(false)
  })
})

describe('checkTriple / 三连合成', () => {
  it('手牌3张同名普通卡应合成金卡', () => {
    const p = makePlayer()
    p.hand = [m('demon_imp'), m('demon_imp'), m('demon_imp')]
    checkTriple(p)
    expect(p.hand).toHaveLength(1)
    expect(p.hand[0].golden).toBe(true)
    expect(p.hand[0].defId).toBe('demon_imp')
  })

  it('金卡不应再参与三连', () => {
    const p = makePlayer()
    p.hand = [m('demon_imp', true), m('demon_imp'), m('demon_imp'), m('demon_imp')]
    checkTriple(p)
    // 3张普通合成1张金卡，加上原有的1张金卡 = 2张金卡
    expect(p.hand.filter((x) => x.golden)).toHaveLength(2)
    expect(p.hand.filter((x) => !x.golden)).toHaveLength(0)
  })

  it('手牌+战场合并检查三连', () => {
    const p = makePlayer()
    p.board = [m('demon_imp'), m('demon_imp')]
    p.hand = [m('demon_imp')]
    checkTriple(p)
    expect(p.board).toHaveLength(0)
    expect(p.hand).toHaveLength(1)
    expect(p.hand[0].golden).toBe(true)
  })

  it('2张同名不应触发三连', () => {
    const p = makePlayer()
    p.hand = [m('demon_imp'), m('demon_imp')]
    checkTriple(p)
    expect(p.hand).toHaveLength(2)
    expect(p.hand.every((x) => !x.golden)).toBe(true)
  })
})

describe('generateTripleReward / applyTripleReward', () => {
  it('应返回比当前酒馆等级+1星级的3张卡', () => {
    const p = makePlayer()
    p.tavernTier = 2
    const rewards = generateTripleReward(p)
    expect(rewards).toHaveLength(3)
    // 奖励池应为 tier=3（tavernTier+1）
    expect(rewards.every((r) => r.tier === 3)).toBe(true)
  })

  it('应用奖励应将卡加入手牌', () => {
    const p = makePlayer()
    p.hand = []
    const reward = CARDS[0]
    applyTripleReward(p, reward)
    expect(p.hand).toHaveLength(1)
    expect(p.hand[0].defId).toBe(reward.id)
  })

  it('手牌满时不应应用奖励', () => {
    const p = makePlayer()
    p.hand = Array.from({ length: 10 }, () => m('demon_imp'))
    const reward = CARDS[0]
    applyTripleReward(p, reward)
    expect(p.hand).toHaveLength(10)
  })
})

describe('dealDamageToHero / 朱雀技能', () => {
  it('朱雀首次受伤应减5（保命技能）', () => {
    const state = createGame('hero_zhuque', 'hero_xuanwu')
    const initialHp = state.player.hero.health
    dealDamageToHero(state, 'player', 8)
    // 8 - 5 = 3 实际伤害
    expect(state.player.hero.health).toBe(initialHp - 3)
    expect(state.player.hero.saveUsed).toBe(true)
  })

  it('朱雀第二次受伤不减免', () => {
    const state = createGame('hero_zhuque', 'hero_xuanwu')
    state.player.hero.saveUsed = true
    const initialHp = state.player.hero.health
    dealDamageToHero(state, 'player', 8)
    expect(state.player.hero.health).toBe(initialHp - 8)
  })

  it('玄武护甲应优先吸收伤害', () => {
    const state = createGame('hero_xuanwu', 'hero_baihu')
    // 玄武 5 护甲
    dealDamageToHero(state, 'player', 3)
    expect(state.player.hero.armor).toBe(2) // 5-3=2
    expect(state.player.hero.health).toBe(40) // 未扣血
  })

  it('护甲吸收后溢出伤害应扣血', () => {
    const state = createGame('hero_xuanwu', 'hero_baihu')
    dealDamageToHero(state, 'player', 10)
    expect(state.player.hero.armor).toBe(0) // 5护甲吸完
    expect(state.player.hero.health).toBe(35) // 40 - (10-5) = 35
  })
})

describe('checkGameOver', () => {
  it('玩家血量<=0应判敌方胜', () => {
    const state = createGame('hero_xuanwu', 'hero_baihu')
    state.player.hero.health = 0
    checkGameOver(state)
    expect(state.phase).toBe('gameover')
    expect(state.winner).toBe('enemy')
  })

  it('敌方血量<=0应判玩家胜', () => {
    const state = createGame('hero_xuanwu', 'hero_baihu')
    state.enemy.hero.health = 0
    checkGameOver(state)
    expect(state.phase).toBe('gameover')
    expect(state.winner).toBe('player')
  })

  it('双方同时<=0应判平局', () => {
    const state = createGame('hero_xuanwu', 'hero_baihu')
    state.player.hero.health = 0
    state.enemy.hero.health = 0
    checkGameOver(state)
    expect(state.phase).toBe('gameover')
    expect(state.winner).toBeNull()
  })

  it('双方都>0不应结束', () => {
    const state = createGame('hero_xuanwu', 'hero_baihu')
    checkGameOver(state)
    expect(state.phase).not.toBe('gameover')
  })
})

describe('createGame', () => {
  it('应创建 recruit 阶段、第1回合、无胜者的游戏', () => {
    const state = createGame('hero_xuanwu', 'hero_baihu')
    expect(state.turn).toBe(1)
    expect(state.phase).toBe('recruit')
    expect(state.winner).toBeNull()
    expect(state.player.board).toHaveLength(0)
    expect(state.player.hand).toHaveLength(0)
    // 酒馆应已刷新
    expect(state.player.tavern.length).toBe(TAVERN_OFFER_COUNT[1])
    expect(state.enemy.tavern.length).toBe(TAVERN_OFFER_COUNT[1])
  })

  it('uid 应从 m1 开始（createGame 内部调用了 resetUid）', () => {
    const state = createGame('hero_xuanwu', 'hero_baihu')
    // 酒馆里的随从 uid 应从 m1 开始
    expect(state.player.tavern[0].uid).toBe('m1')
  })
})

describe('endRecruitPhase', () => {
  it('应将阶段切换到 combat', () => {
    const state = createGame('hero_xuanwu', 'hero_baihu')
    endRecruitPhase(state)
    expect(state.phase).toBe('combat')
  })
})
