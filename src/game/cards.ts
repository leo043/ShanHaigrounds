// 国风卡牌数据 - 山海战棋
// 主题：东方神话，三族（人/妖/仙）
import type { CardDef, Hero, Effect, Keyword } from './types'

export const CARDS: CardDef[] = [
  // ============ 人族 · 侠客武将 ============
  {
    id: 'human_archer',
    name: '游侠',
    tribe: 'human',
    tier: 1,
    attack: 2,
    health: 2,
    keywords: ['windfury'],
    flavor: '青衫快马，一箭双雕。',
  },
  {
    id: 'human_guard',
    name: '铜甲卫',
    tribe: 'human',
    tier: 1,
    attack: 1,
    health: 4,
    keywords: ['taunt'],
    flavor: '铜墙铁壁，守土一方。',
  },
  {
    id: 'human_swordsman',
    name: '青衫剑客',
    tribe: 'human',
    tier: 2,
    attack: 3,
    health: 2,
    keywords: ['poison'],
    flavor: '剑出无悔，见血封喉。',
  },
  {
    id: 'human_monk',
    name: '少林武僧',
    tribe: 'human',
    tier: 2,
    attack: 2,
    health: 3,
    effects: [{ trigger: 'endOfTurn', target: 'self', buffAttack: 1, buffHealth: 1 }],
    flavor: '一禅一棍，日进寸功。',
  },
  {
    id: 'human_general',
    name: '征北将军',
    tribe: 'human',
    tier: 3,
    attack: 4,
    health: 3,
    effects: [{ trigger: 'battlecry', target: 'adjacent', buffAttack: 1, buffHealth: 1 }],
    flavor: '三军司命，号令如山。',
  },
  {
    id: 'human_strategist',
    name: '运筹谋士',
    tribe: 'human',
    tier: 3,
    attack: 2,
    health: 4,
    effects: [{ trigger: 'endOfTurn', target: 'allAllies', buffAttack: 1 }],
    flavor: '运筹帷幄，决胜千里。',
  },
  {
    id: 'human_immortal',
    name: '不死剑仙',
    tribe: 'human',
    tier: 4,
    attack: 4,
    health: 3,
    keywords: ['reborn'],
    flavor: '剑心不灭，肉身重生。',
  },

  // ============ 妖族 · 山精妖怪 ============
  {
    id: 'demon_imp',
    name: '山魈',
    tribe: 'demon',
    tier: 1,
    attack: 3,
    health: 2,
    flavor: '山林小妖，蛮力惊人。',
  },
  {
    id: 'demon_snake',
    name: '蛇魅',
    tribe: 'demon',
    tier: 2,
    attack: 2,
    health: 3,
    effects: [
      {
        trigger: 'deathrattle',
        target: 'summonMinion',
        summon: { name: '小蛇', attack: 1, health: 1, tribe: 'demon' },
      },
    ],
    flavor: '化形未全，毒牙已利。',
  },
  {
    id: 'demon_bear',
    name: '黑熊精',
    tribe: 'demon',
    tier: 2,
    attack: 2,
    health: 5,
    keywords: ['taunt'],
    flavor: '力能扛鼎，背如铁塔。',
  },
  {
    id: 'demon_spider',
    name: '蛛女',
    tribe: 'demon',
    tier: 2,
    attack: 1,
    health: 3,
    effects: [
      {
        trigger: 'battlecry',
        target: 'summonMinion',
        summon: { name: '蛛仔', attack: 1, health: 1, tribe: 'demon' },
      },
    ],
    flavor: '吐丝成阵，困敌于网。',
  },
  {
    id: 'demon_fox',
    name: '九尾狐妖',
    tribe: 'demon',
    tier: 4,
    attack: 4,
    health: 4,
    effects: [
      {
        trigger: 'endOfTurn',
        target: 'allAlliesOfTribe',
        tribe: 'demon',
        buffAttack: 1,
        buffHealth: 1,
      },
    ],
    flavor: '九尾摇曳，惑乱苍生。',
  },
  {
    id: 'demon_bull',
    name: '平天牛魔',
    tribe: 'demon',
    tier: 4,
    attack: 6,
    health: 5,
    keywords: ['taunt'],
    effects: [
      {
        trigger: 'deathrattle',
        target: 'adjacent',
        buffAttack: 2,
        buffHealth: 2,
      },
    ],
    flavor: '平天大圣，蛮力无双，死后余威犹存。',
  },
  {
    id: 'demon_zombie',
    name: '尸魅',
    tribe: 'demon',
    tier: 3,
    attack: 3,
    health: 2,
    keywords: ['reborn'],
    effects: [
      {
        trigger: 'deathrattle',
        target: 'summonMinion',
        summon: { name: '腐尸', attack: 1, health: 1, tribe: 'demon' },
      },
    ],
    flavor: '死而不僵，亡而不灭。',
  },

  // ============ 仙族 · 神仙天将 ============
  {
    id: 'spirit_child',
    name: '灵童',
    tribe: 'spirit',
    tier: 1,
    attack: 2,
    health: 2,
    keywords: ['divineShield'],
    flavor: '仙山童子，灵光护体。',
  },
  {
    id: 'spirit_crane',
    name: '云中仙鹤',
    tribe: 'spirit',
    tier: 2,
    attack: 1,
    health: 5,
    effects: [{ trigger: 'endOfTurn', target: 'adjacent', buffAttack: 1, buffHealth: 1 }],
    flavor: '鹤鸣九皋，声闻于天，泽被同侪。',
  },
  {
    id: 'spirit_thunder',
    name: '雷部正神',
    tribe: 'spirit',
    tier: 3,
    attack: 3,
    health: 3,
    effects: [{ trigger: 'combatStart', target: 'damageRandomEnemy', damage: 2 }],
    flavor: '雷霆万钧，邪祟辟易。',
  },
  {
    id: 'spirit_erlang',
    name: '显圣二郎',
    tribe: 'spirit',
    tier: 4,
    attack: 5,
    health: 4,
    effects: [{ trigger: 'startOfTurn', target: 'self', buffAttack: 1, buffHealth: 1 }],
    flavor: '三眼洞明，斩妖除魔。',
  },
  {
    id: 'spirit_nezha',
    name: '三太子哪吒',
    tribe: 'spirit',
    tier: 5,
    attack: 6,
    health: 6,
    keywords: ['divineShield', 'reborn'],
    flavor: '脚踏风火，三头六臂。',
  },
  {
    id: 'spirit_taishang',
    name: '太上道祖',
    tribe: 'spirit',
    tier: 5,
    attack: 7,
    health: 7,
    effects: [{ trigger: 'endOfTurn', target: 'allAllies', buffAttack: 1, buffHealth: 1 }],
    flavor: '道生万物，德被苍生。',
  },
  {
    id: 'spirit_phoenix',
    name: '九天玄女',
    tribe: 'spirit',
    tier: 3,
    attack: 3,
    health: 3,
    keywords: ['reborn'],
    flavor: '九天降世，赐盾众生。',
  },

  // ============ 第八轮扩卡：补足每族每星级至少 2 张 ============

  // --- 人族补 ---
  {
    id: 'human_baima',
    name: '白马义从',
    tribe: 'human',
    tier: 3,
    attack: 3,
    health: 3,
    keywords: ['windfury'],
    flavor: '白马银枪，来往如风。',
  },
  {
    id: 'human_huben',
    name: '虎贲校尉',
    tribe: 'human',
    tier: 4,
    attack: 5,
    health: 4,
    keywords: ['taunt'],
    flavor: '虎贲三千，挡者披靡。',
  },
  {
    id: 'human_guanyu',
    name: '汉寿亭侯',
    tribe: 'human',
    tier: 5,
    attack: 7,
    health: 5,
    keywords: ['poison', 'windfury'],
    flavor: '青龙偃月，斩将夺旗，一夫当关。',
  },

  // --- 妖族补 ---
  {
    id: 'demon_goblin',
    name: '小妖兵',
    tribe: 'demon',
    tier: 1,
    attack: 1,
    health: 3,
    keywords: ['taunt'],
    flavor: '山间喽啰，前赴后继。',
  },
  {
    id: 'demon_centipede',
    name: '百眼魔君',
    tribe: 'demon',
    tier: 3,
    attack: 3,
    health: 4,
    effects: [{ trigger: 'combatStart', target: 'damageRandomEnemy', damage: 2 }],
    flavor: '百目千足，毒雾弥漫。',
  },
  {
    id: 'demon_huangfeng',
    name: '黄风怪',
    tribe: 'demon',
    tier: 3,
    attack: 4,
    health: 2,
    keywords: ['windfury'],
    flavor: '黄风一卷，飞沙走石。',
  },
  {
    id: 'demon_niutou',
    name: '牛魔王',
    tribe: 'demon',
    tier: 5,
    attack: 7,
    health: 7,
    keywords: ['taunt'],
    effects: [
      {
        trigger: 'deathrattle',
        target: 'summonMinion',
        summon: { name: '蛮牛', attack: 5, health: 5, tribe: 'demon' },
      },
    ],
    flavor: '平天大圣，力压群妖，亡亦留威。',
  },

  // --- 仙族补 ---
  {
    id: 'spirit_yutu',
    name: '玉兔',
    tribe: 'spirit',
    tier: 1,
    attack: 1,
    health: 2,
    effects: [{ trigger: 'battlecry', target: 'self', buffAttack: 1, buffHealth: 1 }],
    flavor: '广寒捣药，灵性十足。',
  },
  {
    id: 'spirit_lotus',
    name: '荷花仙子',
    tribe: 'spirit',
    tier: 2,
    attack: 2,
    health: 2,
    effects: [{ trigger: 'battlecry', target: 'adjacent', buffAttack: 1, buffHealth: 1 }],
    flavor: '步步生莲，泽被相邻。',
  },
  {
    id: 'spirit_nanji',
    name: '南极仙翁',
    tribe: 'spirit',
    tier: 4,
    attack: 4,
    health: 5,
    effects: [{ trigger: 'battlecry', target: 'allAllies', buffHealth: 1 }],
    flavor: '寿同南山，福泽众生。',
  },
]

/** 按 id 索引 */
export const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]))

/** 英雄定义 */
export const HEROES: Hero[] = [
  {
    id: 'hero_xuanwu',
    name: '玄武',
    title: '北辰镇守',
    health: 40,
    armor: 10,
    power: 'armorStart',
    powerName: '玄甲',
    powerDesc: '开局额外获得 10 点护甲',
  },
  {
    id: 'hero_zhuque',
    name: '朱雀',
    title: '南明离火',
    health: 35,
    armor: 0,
    power: 'nirvana',
    powerName: '涅槃',
    powerDesc: '首次死亡时以 1 点生命复活',
  },
  {
    id: 'hero_baihu',
    name: '白虎',
    title: '西极杀伐',
    health: 40,
    armor: 0,
    power: 'freeRefreshOnce',
    powerName: '虎啸',
    powerDesc: '每回合首次刷新酒馆免费',
  },
  {
    id: 'hero_qinglong',
    name: '青龙',
    title: '东苍生气',
    health: 38,
    armor: 0,
    power: 'goldPlusOne',
    powerName: '东来',
    powerDesc: '每回合开始额外获得 1 金',
  },
  {
    id: 'hero_qilin',
    name: '麒麟',
    title: '中央厚土',
    health: 38,
    armor: 2,
    power: 'startTier2',
    powerName: '赐福',
    powerDesc: '开局酒馆直接 2 级（节省升级费）',
  },
]

/** 衍生物（亡语/战吼召唤的）转为 CardDef-like 用于实例化 */
export function getSummonDef(summon: {
  name: string
  attack: number
  health: number
  tribe: 'human' | 'demon' | 'spirit'
}): CardDef {
  return {
    id: `summon_${summon.name}`,
    name: summon.name,
    tribe: summon.tribe,
    tier: 1,
    attack: summon.attack,
    health: summon.health,
  }
}

/** 关键词中文名 */
export const KEYWORD_NAMES: Record<Keyword, string> = {
  taunt: '嘲讽',
  divineShield: '圣盾',
  poison: '剧毒',
  windfury: '风怒',
  reborn: '复生',
}

/** 触发时机中文名 */
export const TRIGGER_NAMES: Record<string, string> = {
  battlecry: '战吼',
  deathrattle: '亡语',
  endOfTurn: '回合结束',
  startOfTurn: '回合开始',
  onSummon: '召唤',
  combatStart: '战斗开始',
}

/** 目标中文名 */
export const TARGET_NAMES: Record<string, string> = {
  self: '自身',
  adjacent: '相邻友方',
  allAllies: '全体友方',
  allAlliesOfTribe: '同族友方',
  summonMinion: '召唤',
  damageRandomEnemy: '随机敌方随从',
  none: '无',
}

/** 生成效果的可读描述 */
export function describeEffect(e: Effect): string {
  const trigger = TRIGGER_NAMES[e.trigger] ?? e.trigger
  const target = TARGET_NAMES[e.target] ?? e.target
  const parts: string[] = []
  if (e.buffAttack && e.buffHealth) parts.push(`+${e.buffAttack}/+${e.buffHealth}`)
  else if (e.buffAttack) parts.push(`+${e.buffAttack} 攻击`)
  else if (e.buffHealth) parts.push(`+${e.buffHealth} 生命`)
  if (e.summon) parts.push(`召唤 ${e.summon.name}(${e.summon.attack}/${e.summon.health})`)
  if (e.damage) parts.push(`造成 ${e.damage} 点伤害`)
  if (e.divineShield) parts.push('赋予圣盾')
  const action = parts.length > 0 ? parts.join('，') : ''
  if (e.target === 'summonMinion' && e.summon) {
    return `${trigger}：召唤 ${e.summon.name}(${e.summon.attack}/${e.summon.health})`
  }
  if (e.target === 'damageRandomEnemy' && e.damage) {
    return `${trigger}：对随机敌方随从造成 ${e.damage} 点伤害`
  }
  return `${trigger}：使${target}${action}`
}

/** 生成卡牌的完整效果描述（多行） */
export function describeCard(def: CardDef): string[] {
  const lines: string[] = []
  // 关键词
  if (def.keywords && def.keywords.length > 0) {
    for (const k of def.keywords) {
      lines.push(`【${KEYWORD_NAMES[k]}】${KEYWORD_DESC[k]}`)
    }
  }
  // 效果
  if (def.effects) {
    for (const e of def.effects) {
      lines.push(describeEffect(e))
    }
  }
  if (lines.length === 0) {
    lines.push('（无特殊效果）')
  }
  return lines
}

/** 关键词说明 */
export const KEYWORD_DESC: Record<Keyword, string> = {
  taunt: '敌人必须先攻击此随从',
  divineShield: '免疫下一次伤害',
  poison: '攻击击杀敌方随从',
  windfury: '每回合可攻击两次',
  reborn: '死亡后以 1 点生命复活',
}
