// 战斗动画播放 - 从 main.ts / multiplayer.ts 提取的共享逻辑
import type { CombatResult, CombatStep } from './combat'
import type { Minion } from './types'
import type { GameUI } from '../ui/render'
import { delay, getCardEl, logClass, titleFor, subFor, scrollLog } from './shared'
import * as sfx from './audio'

/** 播放战斗动画：基于每步快照渲染，配合 CSS 动画类 */
export async function playCombatAnimation(
  ui: GameUI,
  result: CombatResult,
  playerBoard: Minion[],
  enemyBoard: Minion[],
): Promise<void> {
  let logHtml = ''
  // 初始渲染：用第一步之前的原始棋盘
  ui.renderCombatStatic(playerBoard, enemyBoard, '', '两军交锋', '战鼓擂动，胜负将分……')
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
