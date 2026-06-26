// 共享工具函数 - 消除 main.ts / multiplayer.ts / combat.ts 之间的重复定义
import type { Minion } from './types'
import type { CombatResult, CombatStep } from './combat'

/** 延迟 */
export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** 深拷贝单个随从 */
export function cloneMinion(m: Minion): Minion {
  return { ...m, keywords: [...m.keywords], effects: m.effects.map((e) => ({ ...e })) }
}

/** 深拷贝随从数组 */
export function cloneBoard(board: Minion[]): Minion[] {
  return board.map(cloneMinion)
}

/** 根据 uid 查找战场上的卡牌 DOM */
export function getCardEl(uid: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`#app .card[data-uid="${uid}"]`)
}

/** 战斗步骤类型 → 日志 CSS 类 */
export function logClass(type: CombatStep['type']): string {
  if (type === 'hit' || type === 'attackStart') return 'attack'
  if (type === 'death') return 'death'
  if (type === 'shield') return 'shield'
  if (type === 'heroDamage') return 'heroDamage'
  if (type === 'summon') return 'summon'
  if (type === 'reborn') return 'reborn'
  return 'info'
}

/** 战斗步骤 → 标题文本 */
export function titleFor(step: CombatStep, result: CombatResult): string {
  if (step.type === 'heroDamage') {
    return step.side === 'player' ? '大获全胜' : '不敌败北'
  }
  if (step.type === 'end' && step.text === '战斗结束') {
    return result.winner === 'player'
      ? '大获全胜'
      : result.winner === 'enemy'
        ? '不敌败北'
        : '势均力敌'
  }
  if (step.type === 'info') return '两军交锋'
  return '交锋中'
}

/** 战斗步骤 → 副标题文本 */
export function subFor(step: CombatStep): string {
  if (step.type === 'heroDamage') return step.text
  if (step.type === 'info') return step.text
  return ''
}

/** 滚动战斗日志到底部 */
export function scrollLog(): void {
  const el = document.getElementById('combat-log')
  if (el) el.scrollTop = el.scrollHeight
}
