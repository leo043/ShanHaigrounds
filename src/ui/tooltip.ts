// Tooltip 生成 - 卡牌悬停详情、HTML 转义工具
import type { Minion, CardDef } from '../game/types'
import { describeCard, KEYWORD_NAMES, CARD_MAP } from '../game/cards'
import { MINION_IMAGES } from '../config/assets'

/** 种族中文字符 */
export const TRIBE_CHAR: Record<string, string> = { human: '人', demon: '妖', spirit: '仙' }

/** 转义 HTML 属性值中的特殊字符（用于 data-tooltip 属性） */
export function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 生成随从卡牌的 tooltip HTML（鼠标悬停详情 - 大图+侧边效果） */
export function minionTooltipHtml(m: Minion): string {
  const def: CardDef = {
    id: m.defId,
    name: m.name,
    tribe: m.tribe,
    tier: m.tier,
    attack: m.attack,
    health: m.health,
    keywords: m.keywords,
    effects: m.effects,
    flavor: CARD_MAP[m.defId]?.flavor ?? '',
  }
  return cardDetailHtml(def, m.golden, m.health, m.maxHealth)
}

/** 为静态卡牌定义生成 tooltip */
export function cardDefTooltipHtml(def: CardDef): string {
  return cardDetailHtml(def, false, def.health, def.health)
}

/** 生成卡牌详情面板 HTML：左侧大图卡 + 右侧效果说明 */
function cardDetailHtml(def: CardDef, golden: boolean, curHp: number, maxHp: number): string {
  const lines = describeCard(def)
  const imgSrc = MINION_IMAGES[def.id] ?? ''
  const tribeChar = TRIBE_CHAR[def.tribe] ?? '?'
  const stars = '★'.repeat(def.tier)

  // 关键词徽章
  const kwBadges = (def.keywords ?? [])
    .map((k) => {
      const cls =
        k === 'taunt'
          ? 'k-taunt'
          : k === 'divineShield'
            ? 'k-shield'
            : k === 'reborn'
              ? 'k-reborn'
              : k === 'poison'
                ? 'k-poison'
                : 'k-windfury'
      return `<span class="tcd-kw ${cls}">${KEYWORD_NAMES[k]}</span>`
    })
    .join('')

  // 效果说明
  const effectsHtml = lines.map((l) => `<div class="tcd-effect">${l}</div>`).join('')

  // 左侧大图卡
  const imgHtml = imgSrc
    ? `<img class="tcd-img" src="${imgSrc}" alt="${def.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="tcd-art-fallback" style="display:none">${def.name.charAt(0)}</div>`
    : `<div class="tcd-art-fallback" style="display:flex">${def.name.charAt(0)}</div>`

  const hpClass = curHp < maxHp ? 'damaged' : ''

  return `<div class="tooltip-card-detail tribe-${def.tribe} ${golden ? 'golden' : ''}">
    <div class="tcd-left">
      <div class="tcd-card-big">
        <div class="tcd-stars">${stars}</div>
        <div class="tcd-tribe">${tribeChar}</div>
        ${imgHtml}
        <div class="tcd-atk-big">${def.attack}</div>
        <div class="tcd-hp-big ${hpClass}">${Math.max(0, curHp)}</div>
      </div>
    </div>
    <div class="tcd-right">
      <div class="tcd-title">${def.name}${golden ? ' <span class="tcd-gold">★金</span>' : ''}</div>
      <div class="tcd-meta">${stars} · ${tribeChar}族 · 攻${def.attack}/血${curHp}${curHp < maxHp ? `/${maxHp}` : ''}</div>
      ${kwBadges ? `<div class="tcd-keywords">${kwBadges}</div>` : ''}
      <div class="tcd-effects">${effectsHtml}</div>
      ${def.flavor ? `<div class="tcd-flavor">「${def.flavor}」</div>` : ''}
    </div>
  </div>`
}
