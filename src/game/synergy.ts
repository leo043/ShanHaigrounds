// 羁绊系统 - 计算激活的羁绊并应用效果
import type { Minion, Tribe, Class, SynergyInfo } from './types'
import {
  TRIBE_SYNERGY_LEVELS,
  CLASS_SYNERGY_LEVELS,
  TRIBE_SYNERGY_DESC,
  CLASS_SYNERGY_DESC,
} from './types'

/** 计算玩家战场上所有激活的羁绊 */
export function calculateSynergies(board: Minion[]): SynergyInfo[] {
  const synergies: SynergyInfo[] = []

  // 统计种族数量
  const tribeCounts: Record<Tribe, number> = { human: 0, demon: 0, spirit: 0 }
  for (const m of board) {
    tribeCounts[m.tribe]++
  }

  // 计算种族羁绊
  for (const [tribe, count] of Object.entries(tribeCounts) as [Tribe, number][]) {
    const thresholds = TRIBE_SYNERGY_LEVELS[tribe]
    let activeLevel = 0
    for (let i = 0; i < thresholds.length; i++) {
      if (count >= thresholds[i]) {
        activeLevel = i + 1
      }
    }
    synergies.push({
      tag: tribe,
      tagType: 'tribe',
      count,
      activeLevel,
      maxLevel: thresholds.length,
      levelThresholds: thresholds,
      description: activeLevel > 0 ? TRIBE_SYNERGY_DESC[tribe][activeLevel - 1] : '',
    })
  }

  // 统计职业数量
  const classCounts: Record<Class, number> = {
    warrior: 0,
    assassin: 0,
    mage: 0,
    archer: 0,
    priest: 0,
    shaman: 0,
  }
  for (const m of board) {
    classCounts[m.class]++
  }

  // 计算职业羁绊
  for (const [cls, count] of Object.entries(classCounts) as [Class, number][]) {
    const thresholds = CLASS_SYNERGY_LEVELS[cls]
    let activeLevel = 0
    for (let i = 0; i < thresholds.length; i++) {
      if (count >= thresholds[i]) {
        activeLevel = i + 1
      }
    }
    synergies.push({
      tag: cls,
      tagType: 'class',
      count,
      activeLevel,
      maxLevel: thresholds.length,
      levelThresholds: thresholds,
      description: activeLevel > 0 ? CLASS_SYNERGY_DESC[cls][activeLevel - 1] : '',
    })
  }

  return synergies
}

/** 获取种族中文名 */
export function getTribeName(tribe: Tribe): string {
  const names: Record<Tribe, string> = {
    human: '人族',
    demon: '妖族',
    spirit: '仙族',
  }
  return names[tribe]
}

/** 获取职业中文名 */
export function getClassName(cls: Class): string {
  const names: Record<Class, string> = {
    warrior: '武将',
    assassin: '刺客',
    mage: '法师',
    archer: '射手',
    priest: '祭司',
    shaman: '巫祝',
  }
  return names[cls]
}

/** 应用种族羁绊效果到战场（招募阶段结束时调用） */
export function applyTribeSynergyBuffs(board: Minion[]): void {
  const synergies = calculateSynergies(board)

  for (const syn of synergies) {
    if (syn.tagType !== 'tribe' || syn.activeLevel === 0) continue
    const tribe = syn.tag as Tribe

    // Level 1: +1 attack
    if (syn.activeLevel >= 1) {
      for (const m of board) {
        if (m.tribe === tribe) {
          m.attack += 1
          m.synergyBuffAttack += 1
        }
      }
    }

    // Level 2: +1/+1 (on top of level 1)
    if (syn.activeLevel >= 2) {
      for (const m of board) {
        if (m.tribe === tribe) {
          m.attack += 1
          m.health += 1
          m.maxHealth += 1
          m.synergyBuffAttack += 1
          m.synergyBuffHealth += 1
          m.synergyBuffMaxHealth += 1
        }
      }
    }

    // Level 3: +2/+2 + special (on top of level 2)
    if (syn.activeLevel >= 3) {
      if (tribe === 'human') {
        // Human level 3: attack doubled, health halved
        for (const m of board) {
          if (m.tribe === 'human') {
            const atkBonus = m.attack
            const newHp = Math.max(1, Math.ceil(m.health / 2))
            const hpBonus = newHp - m.health
            m.attack += atkBonus
            m.health += hpBonus
            m.maxHealth += hpBonus
            m.synergyBuffAttack += atkBonus
            m.synergyBuffHealth += hpBonus
            m.synergyBuffMaxHealth += hpBonus
          }
        }
      } else {
        for (const m of board) {
          if (m.tribe === tribe) {
            m.attack += 2
            m.health += 2
            m.maxHealth += 2
            m.synergyBuffAttack += 2
            m.synergyBuffHealth += 2
            m.synergyBuffMaxHealth += 2
          }
        }
      }
      // Demon level 3: add reborn
      if (tribe === 'demon') {
        for (const m of board) {
          if (m.tribe === 'demon' && !m.keywords.includes('reborn')) {
            m.keywords.push('reborn')
            m.synergyAddedKeywords.push('reborn')
          }
        }
      }
      // Spirit level 3: grant divine shield
      if (tribe === 'spirit') {
        for (const m of board) {
          if (m.tribe === 'spirit') {
            m.divineShield = true
          }
        }
      }
    }
  }
}

/** 应用职业羁绊效果到战场（招募阶段结束时调用） */
export function applyClassSynergyBuffs(board: Minion[]): void {
  const synergies = calculateSynergies(board)

  for (const syn of synergies) {
    if (syn.tagType !== 'class' || syn.activeLevel === 0) continue
    const cls = syn.tag as Class

    // Level 1 effects
    if (syn.activeLevel >= 1) {
      switch (cls) {
        case 'warrior':
          // 全体 +2 health
          for (const m of board) {
            m.health += 2
            m.maxHealth += 2
            m.synergyBuffHealth += 2
            m.synergyBuffMaxHealth += 2
          }
          break
        case 'assassin':
          // 全体 +2 attack
          for (const m of board) {
            m.attack += 2
            m.synergyBuffAttack += 2
          }
          break
        case 'mage':
          // 战斗开始伤害在 combat.ts 中处理，这里只标记
          break
        case 'archer':
          // 全体 +1 attack
          for (const m of board) {
            m.attack += 1
            m.synergyBuffAttack += 1
          }
          break
        case 'priest':
          // 回合结束 buff 在 game.ts 中处理
          break
        case 'shaman':
          // 召唤物 buff 在召唤时处理
          break
      }
    }

    // Level 2 effects
    if (syn.activeLevel >= 2) {
      switch (cls) {
        case 'warrior':
          // 嘲讽随从 +3 attack
          for (const m of board) {
            if (m.keywords.includes('taunt')) {
              m.attack += 3
              m.synergyBuffAttack += 3
            }
          }
          break
        case 'assassin':
          // 首次攻击双倍伤害在 combat.ts 中处理
          break
        case 'mage':
          // 战斗开始全体敌方各 1 伤害在 combat.ts 中处理
          break
        case 'archer':
          // 风怒随从 +2 attack
          for (const m of board) {
            if (m.keywords.includes('windfury')) {
              m.attack += 2
              m.synergyBuffAttack += 2
            }
          }
          break
        case 'priest':
          // 回合结束 +2/+2 (额外)
          for (const m of board) {
            m.attack += 2
            m.health += 2
            m.maxHealth += 2
            m.synergyBuffAttack += 2
            m.synergyBuffHealth += 2
            m.synergyBuffMaxHealth += 2
          }
          break
        case 'shaman':
          // 召唤物 +2/+2 且获得嘲讽在召唤时处理
          break
      }
    }
  }
}

/** 缓存：记录上次应用羁绊时的棋盘指纹，避免无变化时重复撤销+重算 */
const synergyFingerprintCache = new WeakMap<Minion[], string>()

/** 计算棋盘的羁绊指纹（仅依赖种族/职业组成，不依赖数值） */
function synergyFingerprint(board: Minion[]): string {
  const tribeCounts: Record<string, number> = {}
  const classCounts: Record<string, number> = {}
  for (const m of board) {
    tribeCounts[m.tribe] = (tribeCounts[m.tribe] ?? 0) + 1
    classCounts[m.class] = (classCounts[m.class] ?? 0) + 1
  }
  return JSON.stringify({ t: tribeCounts, c: classCounts })
}

/** 重算羁绊光环（撤销旧的、应用新的），在每次战场变化后调用 */
export function recalcSynergyAuras(board: Minion[]): void {
  // 先检查棋盘组成是否变化，没变则跳过
  const fp = synergyFingerprint(board)
  if (synergyFingerprintCache.get(board) === fp) return

  // 撤销上一轮的羁绊加成
  for (const m of board) {
    m.attack -= m.synergyBuffAttack
    m.health -= m.synergyBuffHealth
    m.maxHealth -= m.synergyBuffMaxHealth
    for (const kw of m.synergyAddedKeywords) {
      const idx = m.keywords.indexOf(kw)
      if (idx >= 0) m.keywords.splice(idx, 1)
    }
    m.synergyBuffAttack = 0
    m.synergyBuffHealth = 0
    m.synergyBuffMaxHealth = 0
    m.synergyAddedKeywords = []
  }
  // 重新计算并应用
  applyTribeSynergyBuffs(board)
  applyClassSynergyBuffs(board)
  synergyFingerprintCache.set(board, fp)
}
