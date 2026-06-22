// 卡牌与英雄 HTML 渲染单元
import type { Minion, PlayerState } from '../game/types'
import { MINION_IMAGES, HERO_IMAGES } from '../config/assets'
import { TRIBE_CHAR, escapeAttr, minionTooltipHtml } from './tooltip'

/** 生成随从卡牌 HTML（支持图片 + tooltip） */
export function minionHtml(
  m: Minion,
  opts: {
    hand?: boolean
    selected?: boolean
    zone?: string
    summonIn?: boolean
    side?: 'player' | 'enemy'
  } = {},
): string {
  const tribeChar = TRIBE_CHAR[m.tribe] ?? '?'
  const stars = '★'.repeat(m.tier)
  const keywords: string[] = []
  if (m.keywords.includes('taunt')) keywords.push('<span class="kw-badge k-taunt">嘲</span>')
  if (m.divineShield) keywords.push('<span class="kw-badge k-shield">盾</span>')
  if (m.keywords.includes('reborn') && !m.rebornUsed)
    keywords.push('<span class="kw-badge k-reborn">生</span>')
  if (m.keywords.includes('poison')) keywords.push('<span class="kw-badge k-poison">毒</span>')
  if (m.keywords.includes('windfury')) keywords.push('<span class="kw-badge k-windfury">风</span>')

  const imgSrc = MINION_IMAGES[m.defId] ?? ''
  const imgHtml = imgSrc
    ? `<img class="card-img" src="${imgSrc}" alt="${m.name}" onerror="this.style.display='none'">`
    : `<div class="card-art">${m.name.charAt(0)}</div>`

  const cls = [
    'card',
    `tribe-${m.tribe}`,
    m.golden ? 'golden' : '',
    m.keywords.includes('taunt') ? 'has-taunt' : '',
    m.divineShield ? 'has-shield' : '',
    m.keywords.includes('reborn') && !m.rebornUsed ? 'has-reborn' : '',
    m.keywords.includes('poison') ? 'has-poison' : '',
    m.keywords.includes('windfury') ? 'has-windfury' : '',
    m.tripleRewardPending ? 'triple-pending' : '',
    opts.hand ? 'hand-size' : '',
    opts.selected ? 'selected' : '',
    opts.summonIn ? 'summon-in' : '',
    opts.side ? `side-${opts.side}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const zoneAttr = opts.zone ? `data-zone="${opts.zone}"` : ''
  // tooltip 通过 data-tooltip 属性携带，由全局 mouseover 处理显示
  const tooltipData = escapeAttr(minionTooltipHtml(m))

  return `<div class="${cls}" data-uid="${m.uid}" ${zoneAttr} data-tooltip="${tooltipData}">
    ${m.tripleRewardPending ? '<div class="triple-badge">奖</div>' : ''}
    <div class="card-frame">
      <div class="card-stars">${stars}</div>
      <div class="card-tribe t-${m.tribe}">${tribeChar}</div>
      <div class="card-keywords">${keywords.join('')}</div>
      ${imgHtml}
    </div>
    <div class="card-atk">${m.attack}</div>
    <div class="card-hp ${m.health < m.maxHealth && !opts.summonIn ? 'damaged' : ''}">${Math.max(0, m.health)}</div>
  </div>`
}

/** 英雄 HTML（支持图片） */
export function heroHtml(p: PlayerState, isEnemy: boolean): string {
  const h = p.hero
  const imgSrc = HERO_IMAGES[h.id] ?? ''
  const portraitHtml = imgSrc
    ? `<img class="hero-img" src="${imgSrc}" alt="${h.name}" onerror="this.style.display='none'">`
    : ``

  return `<div class="hero-bar">
    <div class="hero-portrait">${portraitHtml}</div>
    <div class="hero-info">
      <span class="hero-name">${h.name}${isEnemy ? '（敌）' : ''}</span>
      <span class="hero-stats">
        <span class="stat-hp">❤ ${Math.max(0, h.health)}</span>
        ${h.armor > 0 ? `<span class="stat-armor">🛡 ${h.armor}</span>` : ''}
      </span>
    </div>
  </div>`
}
