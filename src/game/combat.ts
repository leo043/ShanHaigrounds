// 战斗系统 - 自动战斗模拟（对齐酒馆战棋规则）
import type { GameState, Minion } from './types'
import { createSummonMinion, damageMinion } from './game'

/** 战斗中的 buff 辅助函数（与 game.ts 的 buffMinion 逻辑一致） */
function combatBuff(m: Minion, atk?: number, hp?: number): void {
  if (atk) m.attack += atk
  if (hp) {
    m.health += hp
    m.maxHealth += hp
  }
}

/** 生成 buff 描述文本 */
function buffDesc(atk?: number, hp?: number): string {
  if (atk && hp) return `+${atk}/+${hp}`
  if (atk) return `+${atk} 攻击`
  if (hp) return `+${hp} 血量`
  return ''
}

export type Side = 'player' | 'enemy'

/** 战斗步骤（每步带双方棋盘快照，供 UI 回放） */
export interface CombatStep {
  type:
    | 'attackStart'
    | 'hit'
    | 'shield'
    | 'death'
    | 'reborn'
    | 'summon'
    | 'heroDamage'
    | 'info'
    | 'end'
  side?: Side // 行动方
  attackerUid?: string
  defenderUid?: string
  damage?: number
  killedUids?: string[]
  killedSide?: Side
  summonedUid?: string
  rebornUid?: string
  snap: { p: Minion[]; e: Minion[] } // 本步发生后的双方棋盘状态
  text: string
}

export interface CombatResult {
  steps: CombatStep[]
  winner: Side | 'tie'
  damageToLoser: number
  survivorBoard: Minion[] // 玩方存活（已回满血）
  enemySurvivorBoard: Minion[] // 敌方存活（已回满血）
}

function cloneMinion(m: Minion): Minion {
  return { ...m, keywords: [...m.keywords], effects: m.effects.map((e) => ({ ...e })) }
}
function cloneBoard(b: Minion[]): Minion[] {
  return b.map(cloneMinion)
}

/**
 * 模拟一次战斗。在副本上进行，不修改 state。
 * 战斗结束后存活随从回满血（战斗中受到的伤害不保留）。
 */
export function simulateCombat(state: GameState): CombatResult {
  const steps: CombatStep[] = []
  let pBoard: Minion[] = cloneBoard(state.player.board)
  let eBoard: Minion[] = cloneBoard(state.enemy.board)

  // 先手：随从数量多者先，相同则随机
  let turn: Side
  if (pBoard.length > eBoard.length) turn = 'player'
  else if (eBoard.length > pBoard.length) turn = 'enemy'
  else turn = Math.random() < 0.5 ? 'player' : 'enemy'

  const snap = (): { p: Minion[]; e: Minion[] } => ({
    p: cloneBoard(pBoard),
    e: cloneBoard(eBoard),
  })

  steps.push({
    type: 'info',
    snap: snap(),
    text: `战斗开始！我方 ${pBoard.length} 子 vs 敌方 ${eBoard.length} 子，${turn === 'player' ? '我方' : '敌方'}先手`,
  })

  // 处理战斗开始时的效果
  for (const side of ['player', 'enemy'] as const) {
    const board = side === 'player' ? pBoard : eBoard
    const enemy = side === 'player' ? eBoard : pBoard
    for (const m of board) {
      for (const e of m.effects) {
        if (e.trigger !== 'combatStart') continue
        // 伤害类效果
        if (e.target === 'damageRandomEnemy' && e.damage && enemy.length > 0) {
          const t = enemy[Math.floor(Math.random() * enemy.length)]
          if (t.divineShield) {
            t.divineShield = false
            steps.push({
              type: 'shield',
              side: side === 'player' ? 'enemy' : 'player',
              defenderUid: t.uid,
              snap: snap(),
              text: `【${m.name}】战斗开始伤害被【${t.name}】圣盾抵挡`,
            })
          } else {
            damageMinion(t, e.damage)
            steps.push({
              type: 'hit',
              side,
              defenderUid: t.uid,
              damage: e.damage,
              snap: snap(),
              text: `【${m.name}】战斗开始对【${t.name}】造成 ${e.damage} 点伤害`,
            })
          }
        }
        // buff 类效果
        else if (e.target === 'allAlliesOfTribe' && e.tribe) {
          const tribeName = e.tribe === 'human' ? '人族' : e.tribe === 'demon' ? '妖族' : '仙族'
          const buffedNames: string[] = []
          for (const ally of board) {
            if (ally.tribe === e.tribe) {
              combatBuff(ally, e.buffAttack, e.buffHealth)
              buffedNames.push(ally.name)
            }
          }
          if (buffedNames.length > 0) {
            steps.push({
              type: 'info',
              side,
              snap: snap(),
              text: `【${m.name}】战斗开始：${tribeName}友方${buffDesc(e.buffAttack, e.buffHealth)}（${buffedNames.join('、')}）`,
            })
          }
        } else if (e.target === 'allAllies') {
          const buffedNames: string[] = []
          for (const ally of board) {
            combatBuff(ally, e.buffAttack, e.buffHealth)
            buffedNames.push(ally.name)
          }
          if (buffedNames.length > 0) {
            steps.push({
              type: 'info',
              side,
              snap: snap(),
              text: `【${m.name}】战斗开始：全体友方${buffDesc(e.buffAttack, e.buffHealth)}（${buffedNames.join('、')}）`,
            })
          }
        } else if (e.target === 'adjacent') {
          const idx = board.indexOf(m)
          const buffedNames: string[] = []
          if (idx > 0) {
            combatBuff(board[idx - 1], e.buffAttack, e.buffHealth)
            buffedNames.push(board[idx - 1].name)
          }
          if (idx >= 0 && idx < board.length - 1) {
            combatBuff(board[idx + 1], e.buffAttack, e.buffHealth)
            buffedNames.push(board[idx + 1].name)
          }
          if (buffedNames.length > 0) {
            steps.push({
              type: 'info',
              side,
              snap: snap(),
              text: `【${m.name}】战斗开始：相邻友方${buffDesc(e.buffAttack, e.buffHealth)}（${buffedNames.join('、')}）`,
            })
          }
        } else if (e.target === 'self') {
          combatBuff(m, e.buffAttack, e.buffHealth)
          steps.push({
            type: 'info',
            side,
            snap: snap(),
            text: `【${m.name}】战斗开始：自身${buffDesc(e.buffAttack, e.buffHealth)}`,
          })
        }
      }
    }
  }

  let pPtr = 0
  let ePtr = 0
  let guard = 0
  // 记录每个随从本回合已攻击次数（支持风怒）
  const attacksUsed = new Map<string, number>()
  const canAttack = (m: Minion): boolean => {
    const used = attacksUsed.get(m.uid) ?? 0
    const max = m.keywords.includes('windfury') ? 2 : 1
    return used < max
  }
  const markAttack = (m: Minion): void => {
    attacksUsed.set(m.uid, (attacksUsed.get(m.uid) ?? 0) + 1)
  }

  while (pBoard.length > 0 && eBoard.length > 0 && guard < 300) {
    guard++
    const atkSide: Side = turn
    const atkBoard = atkSide === 'player' ? pBoard : eBoard
    const defBoard = atkSide === 'player' ? eBoard : pBoard
    const ptr = atkSide === 'player' ? pPtr : ePtr

    // 找下一个还能攻击的随从
    let idx = -1
    for (let i = 0; i < atkBoard.length; i++) {
      const r = (ptr + i) % atkBoard.length
      if (canAttack(atkBoard[r])) {
        idx = r
        break
      }
    }
    if (idx === -1) {
      // 本方所有随从都打完，重置攻击计数进入下一轮
      for (const m of atkBoard) attacksUsed.delete(m.uid)
      if (atkSide === 'player') pPtr = 0
      else ePtr = 0
      // 若对方也全打完则跳出（避免死循环）
      const otherBoard = atkSide === 'player' ? eBoard : pBoard
      const otherCanAttack = otherBoard.some((m) => {
        const used = attacksUsed.get(m.uid) ?? 0
        const max = m.keywords.includes('windfury') ? 2 : 1
        return used < max
      })
      if (!otherCanAttack) {
        for (const m of otherBoard) attacksUsed.delete(m.uid)
      }
      turn = turn === 'player' ? 'enemy' : 'player'
      continue
    }

    const attacker = atkBoard[idx]
    markAttack(attacker)

    // 选目标：优先嘲讽，否则随机
    const taunts = defBoard.filter((m) => m.keywords.includes('taunt'))
    const pool = taunts.length > 0 ? taunts : defBoard
    const defender = pool[Math.floor(Math.random() * pool.length)]
    const defSide: Side = atkSide === 'player' ? 'enemy' : 'player'

    const windfuryTag =
      attacker.keywords.includes('windfury') && (attacksUsed.get(attacker.uid) ?? 0) === 1
        ? '（风怒·二击）'
        : ''
    steps.push({
      type: 'attackStart',
      side: atkSide,
      attackerUid: attacker.uid,
      defenderUid: defender.uid,
      snap: snap(),
      text: `【${attacker.name}】(${attacker.attack}/${attacker.health})${windfuryTag} 冲向【${defender.name}】(${defender.attack}/${defender.health})`,
    })

    // 互相造成攻击力伤害
    resolveHit(attacker, defender, atkSide, steps, snap)
    resolveHit(defender, attacker, defSide, steps, snap)

    // 清理死亡 + 复生 + 亡语
    pBoard = cleanupDead('player', pBoard, eBoard, steps)
    eBoard = cleanupDead('enemy', eBoard, pBoard, steps)

    // 风怒：如果攻击者还能攻击，不切换回合
    const currentAtkBoard = atkSide === 'player' ? pBoard : eBoard
    const attackerStillCanAttack = currentAtkBoard.includes(attacker) && canAttack(attacker)
    if (!attackerStillCanAttack) {
      turn = turn === 'player' ? 'enemy' : 'player'
    }
  }

  // 判定胜负 + 英雄伤害
  let winner: Side | 'tie'
  let damage = 0
  if (pBoard.length > 0 && eBoard.length === 0) {
    winner = 'player'
    // 伤害 = 存活随从星级之和 + 当前酒馆等级
    damage = tierDamage(pBoard) + state.player.tavernTier
    steps.push({
      type: 'heroDamage',
      side: 'player',
      damage,
      snap: snap(),
      text: `大胜！对敌方英雄造成 ${damage} 点伤害（随从${tierDamage(pBoard)} + 酒馆${state.player.tavernTier}）`,
    })
  } else if (eBoard.length > 0 && pBoard.length === 0) {
    winner = 'enemy'
    damage = tierDamage(eBoard) + state.enemy.tavernTier
    steps.push({
      type: 'heroDamage',
      side: 'enemy',
      damage,
      snap: snap(),
      text: `败北！我方英雄承受 ${damage} 点伤害（随从${tierDamage(eBoard)} + 酒馆${state.enemy.tavernTier}）`,
    })
  } else {
    winner = 'tie'
    steps.push({ type: 'end', snap: snap(), text: '平局，双方互不伤害' })
  }
  steps.push({ type: 'end', snap: snap(), text: '战斗结束' })

  // 关键：战斗后存活随从回满血（战斗伤害不保留），复生状态重置
  for (const m of pBoard) {
    m.health = m.maxHealth
    m.rebornUsed = false
    m.divineShield = m.keywords.includes('divineShield') // 圣盾恢复（官方规则：每回合开始圣盾恢复）
  }
  for (const m of eBoard) {
    m.health = m.maxHealth
    m.rebornUsed = false
    m.divineShield = m.keywords.includes('divineShield')
  }

  return {
    steps,
    winner,
    damageToLoser: damage,
    survivorBoard: pBoard,
    enemySurvivorBoard: eBoard,
  }
}

/** 结算一次命中（攻击者打防御者） */
function resolveHit(
  attacker: Minion,
  defender: Minion,
  atkSide: Side,
  steps: CombatStep[],
  snap: () => { p: Minion[]; e: Minion[] },
): void {
  if (defender.health <= 0) return
  if (attacker.attack <= 0) return
  const dmg = attacker.attack
  // 圣盾抵消伤害（含剧毒）
  if (defender.divineShield) {
    defender.divineShield = false
    steps.push({
      type: 'shield',
      side: atkSide === 'player' ? 'enemy' : 'player',
      defenderUid: defender.uid,
      snap: snap(),
      text: `【${defender.name}】圣盾破碎，抵消${attacker.keywords.includes('poison') ? '剧毒' : '伤害'}`,
    })
    return
  }
  // 剧毒：直接击杀随从
  if (attacker.keywords.includes('poison')) {
    defender.health = 0
    steps.push({
      type: 'hit',
      side: atkSide,
      attackerUid: attacker.uid,
      defenderUid: defender.uid,
      damage: dmg,
      snap: snap(),
      text: `【${attacker.name}】剧毒之刃命中【${defender.name}】，一击毙命！`,
    })
    return
  }
  damageMinion(defender, dmg)
  steps.push({
    type: 'hit',
    side: atkSide,
    attackerUid: attacker.uid,
    defenderUid: defender.uid,
    damage: dmg,
    snap: snap(),
    text: `【${defender.name}】受到 ${dmg} 点伤害（剩 ${Math.max(0, defender.health)}）`,
  })
}

/** 清理死亡随从：先处理复生，再触发亡语。复生体/召唤物在原死亡位置出现 */
function cleanupDead(
  side: Side,
  board: Minion[],
  enemyBoard: Minion[],
  steps: CombatStep[],
): Minion[] {
  const dead = board.filter((m) => m.health <= 0)
  if (dead.length === 0) return board

  const makeSnapFromArr = (arr: Minion[]): { p: Minion[]; e: Minion[] } =>
    side === 'player'
      ? { p: cloneBoard(arr), e: cloneBoard(enemyBoard) }
      : { p: cloneBoard(enemyBoard), e: cloneBoard(arr) }

  // 先按原 board 顺序重建：存活直接保留，死亡的在原位置触发复生/亡语召唤
  const finalBoard: Minion[] = []

  for (const m of board) {
    if (m.health > 0) {
      finalBoard.push(m)
      continue
    }

    // 死亡随从：先尝试复生（在原位置）
    if (m.keywords.includes('reborn') && !m.rebornUsed && finalBoard.length < 7) {
      m.health = 1
      m.rebornUsed = true
      m.divineShield = false
      m.hasAttacked = false
      finalBoard.push(m)
      steps.push({
        type: 'reborn',
        side,
        rebornUid: m.uid,
        snap: makeSnapFromArr(finalBoard),
        text: `【${m.name}】复生！以 1 点生命重返战场`,
      })
    }

    // 触发亡语
    for (const e of m.effects) {
      if (e.trigger !== 'deathrattle') continue
      if (e.target === 'summonMinion' && e.summon && finalBoard.length < 7) {
        const s = createSummonMinion(e.summon)
        finalBoard.push(s)
        steps.push({
          type: 'summon',
          side,
          summonedUid: s.uid,
          snap: makeSnapFromArr(finalBoard),
          text: `【${m.name}】亡语：召唤 ${s.name} (${s.attack}/${s.health})`,
        })
      } else if (e.target === 'damageRandomEnemy' && e.damage && enemyBoard.length > 0) {
        const t = enemyBoard[Math.floor(Math.random() * enemyBoard.length)]
        if (t.divineShield) {
          t.divineShield = false
          steps.push({
            type: 'shield',
            side: side === 'player' ? 'enemy' : 'player',
            defenderUid: t.uid,
            snap: makeSnapFromArr(finalBoard),
            text: `【${m.name}】亡语伤害被【${t.name}】圣盾抵挡`,
          })
        } else {
          damageMinion(t, e.damage)
          steps.push({
            type: 'hit',
            side,
            defenderUid: t.uid,
            damage: e.damage,
            snap: makeSnapFromArr(finalBoard),
            text: `【${m.name}】亡语：对【${t.name}】造成 ${e.damage} 点伤害`,
          })
        }
      } else if (e.target === 'adjacent') {
        const pos = finalBoard.length
        // 左相邻：finalBoard 最后一个
        if (pos > 0 && e.buffAttack) {
          const left = finalBoard[pos - 1]
          left.attack += e.buffAttack
          if (e.buffHealth) {
            left.health += e.buffHealth
            left.maxHealth += e.buffHealth
          }
          steps.push({
            type: 'info',
            snap: makeSnapFromArr(finalBoard),
            text: `【${m.name}】亡语：给【${left.name}】+${e.buffAttack}/${e.buffHealth ?? 0}`,
          })
        }
        // 右相邻：board 中下一个存活的随从
        const boardIdx = board.indexOf(m)
        for (let j = boardIdx + 1; j < board.length; j++) {
          if (board[j].health > 0 && e.buffAttack) {
            const right = board[j]
            right.attack += e.buffAttack
            if (e.buffHealth) {
              right.health += e.buffHealth
              right.maxHealth += e.buffHealth
            }
            steps.push({
              type: 'info',
              snap: makeSnapFromArr(finalBoard),
              text: `【${m.name}】亡语：给【${right.name}】+${e.buffAttack}/${e.buffHealth ?? 0}`,
            })
            break
          }
        }
      } else if (e.target === 'randomAlly' && finalBoard.length > 0) {
        const allies = finalBoard.filter((a) => a.uid !== m.uid)
        if (allies.length > 0 && e.divineShield) {
          const target = allies[Math.floor(Math.random() * allies.length)]
          target.divineShield = true
          steps.push({
            type: 'info',
            snap: makeSnapFromArr(finalBoard),
            text: `【${m.name}】亡语：给予【${target.name}】圣盾`,
          })
        }
      }
    }
    // 无复生无召唤：随从消失，不加入 finalBoard
  }

  // 用 finalBoard（含复生/召唤物）作为死亡步快照，避免渲染空白期
  steps.push({
    type: 'death',
    killedSide: side,
    killedUids: dead.map((m) => m.uid),
    snap: makeSnapFromArr(finalBoard),
    text: `${side === 'player' ? '我方' : '敌方'}阵亡：${dead.map((m) => m.name).join('、')}`,
  })

  return finalBoard
}

/** 计算随从造成的伤害部分 = 存活随从星级之和 */
function tierDamage(board: Minion[]): number {
  return board.reduce((s, m) => s + m.tier, 0)
}
