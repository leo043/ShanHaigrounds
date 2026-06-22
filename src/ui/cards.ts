// 卡牌与英雄 HTML 渲染单元
import type { Minion, CardDef, PlayerState, Keyword } from '../game/types'
import { MINION_IMAGES, HERO_IMAGES } from '../config/assets'
import { KEYWORD_NAMES } from '../game/cards'
import { TRIBE_CHAR, escapeAttr, minionTooltipHtml, cardDefTooltipHtml } from './tooltip'

/** 关键词优先级（多关键词时决定边框/带子取哪个）—— 防御类优先 */
const KEYWORD_PRIORITY: Keyword[] = [
  'taunt', // 嘲讽：必须先打，最显眼
  'divineShield', // 圣盾：免疫，次之
  'reborn', // 复生：重生
  'poison', // 剧毒：攻击向
  'windfury', // 风怒：攻击向
]

/** 关键词图形化 SVG 图标（矢量，可用 currentColor 着色） */
const KEYWORD_ICONS: Record<Keyword, string> = {
  // 嘲讽：盾牌（防御）
  taunt:
    '<svg viewBox="0 0 24 24" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><path d="M12 2 L20 5 V11 Q20 17 12 22 Q4 17 4 11 V5 Z" fill="currentColor"/></svg>',
  // 圣盾：光环（神圣）
  divineShield:
    '<svg viewBox="0 0 24 24" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="currentColor"/></svg>',
  // 复生：莲花（重生）
  reborn:
    '<svg viewBox="0 0 24 24" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><path d="M12 3 Q6.5 6 6.5 12 Q6.5 18 12 21 Q17.5 18 17.5 12 Q17.5 6 12 3 Z" fill="currentColor"/></svg>',
  // 剧毒：毒滴（腐蚀）
  poison:
    '<svg viewBox="0 0 24 24" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><path d="M12 2 Q6 9 6 15 Q6 20.5 12 22 Q18 20.5 18 15 Q18 9 12 2 Z" fill="currentColor"/></svg>',
  // 风怒：旋风（疾风）
  windfury:
    '<svg viewBox="0 0 24 24" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><path d="M3 7 Q8 3 13 7 Q16 9 19 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M3 13 Q8 9 13 13 Q16 15 19 13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M3 19 Q8 15 13 19 Q16 21 19 19" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
}

/** 从 Minion 计算当前激活的关键词列表（考虑运行时状态：圣盾是否已破、复生是否已用） */
function activeKeywords(m: Minion): Keyword[] {
  const out: Keyword[] = []
  if (m.keywords.includes('taunt')) out.push('taunt')
  if (m.divineShield) out.push('divineShield')
  if (m.keywords.includes('reborn') && !m.rebornUsed) out.push('reborn')
  if (m.keywords.includes('poison')) out.push('poison')
  if (m.keywords.includes('windfury')) out.push('windfury')
  return out
}

/** 从 CardDef 计算关键词列表（静态定义，无运行时状态） */
function defKeywords(def: CardDef): Keyword[] {
  return def.keywords ?? []
}

/** 取主关键词（最高优先级），用于边框、顶部带子、外发光 */
function primaryKeyword(kws: Keyword[]): Keyword | null {
  if (kws.length === 0) return null
  for (const k of KEYWORD_PRIORITY) {
    if (kws.includes(k)) return k
  }
  return kws[0]
}

/** 生成关键词视觉层 HTML（独立 DOM 层，避免伪元素冲突） */
export function keywordVisualLayers(kws: Keyword[]): {
  floor: string // 底座光环
  aura: string // 外发光层
  banner: string // 顶部带子
  icons: string // 右上角图标徽章组
} {
  if (kws.length === 0) {
    return { floor: '', aura: '', banner: '', icons: '' }
  }
  const primary = primaryKeyword(kws)

  // 底座光环：仅主关键词一层（控制 overdraw）
  const floor = primary ? `<div class="kw-floor kw-floor-${primary}"></div>` : ''

  // 外发光层：仅主关键词一层（控制 overdraw）
  const aura = primary ? `<div class="kw-aura kw-aura-${primary}"></div>` : ''

  // 顶部带子：已移除（保留底座光环/外发光/图标徽章三层即可识别）
  const banner = ''

  // 右上角图标徽章：所有激活的关键词都显示（垂直排列）
  const icons = kws
    .map(
      (k) =>
        `<span class="kw-icon kw-icon-${k}" title="${KEYWORD_NAMES[k]}">${KEYWORD_ICONS[k]}</span>`,
    )
    .join('')

  return { floor, aura, banner, icons }
}

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

  // 关键词视觉层（独立 DOM）
  const kws = activeKeywords(m)
  const { floor, aura, banner, icons } = keywordVisualLayers(kws)

  const imgSrc = MINION_IMAGES[m.defId] ?? ''
  const imgHtml = imgSrc
    ? `<img class="card-img" src="${imgSrc}" alt="${m.name}" onerror="this.style.display='none'">`
    : `<div class="card-art">${m.name.charAt(0)}</div>`

  const cls = [
    'card',
    `tribe-${m.tribe}`,
    m.golden ? 'golden' : '',
    // 关键词 class 保留（用于 CSS 选择器与边框样式）
    kws.includes('taunt') ? 'has-taunt' : '',
    kws.includes('divineShield') ? 'has-shield' : '',
    kws.includes('reborn') ? 'has-reborn' : '',
    kws.includes('poison') ? 'has-poison' : '',
    kws.includes('windfury') ? 'has-windfury' : '',
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
    ${floor}
    ${aura}
    ${banner}
    <div class="card-frame">
      <div class="card-stars">${stars}</div>
      <div class="card-tribe t-${m.tribe}">${tribeChar}</div>
      <div class="card-keywords">${icons}</div>
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

/** 图鉴用卡牌 HTML（基于 CardDef，支持悬停 tooltip） */
export function codexCardHtml(def: CardDef): string {
  const tribeChar = TRIBE_CHAR[def.tribe] ?? '?'
  const stars = '★'.repeat(def.tier)

  // 关键词视觉层
  const kws = defKeywords(def)
  const { floor, aura, banner, icons } = keywordVisualLayers(kws)

  const imgSrc = MINION_IMAGES[def.id] ?? ''
  const imgHtml = imgSrc
    ? `<img class="card-img" src="${imgSrc}" alt="${def.name}" onerror="this.style.display='none'">`
    : `<div class="card-art">${def.name.charAt(0)}</div>`

  const cls = [
    'card',
    `tribe-${def.tribe}`,
    kws.includes('taunt') ? 'has-taunt' : '',
    kws.includes('divineShield') ? 'has-shield' : '',
    kws.includes('reborn') ? 'has-reborn' : '',
    kws.includes('poison') ? 'has-poison' : '',
    kws.includes('windfury') ? 'has-windfury' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const tooltipData = escapeAttr(cardDefTooltipHtml(def))

  return `<div class="${cls}" data-tooltip="${tooltipData}">
    ${floor}
    ${aura}
    ${banner}
    <div class="card-frame">
      <div class="card-stars">${stars}</div>
      <div class="card-tribe t-${def.tribe}">${tribeChar}</div>
      <div class="card-keywords">${icons}</div>
      ${imgHtml}
    </div>
    <div class="card-atk">${def.attack}</div>
    <div class="card-hp">${def.health}</div>
  </div>`
}

/** 生成三连奖励卡牌用的关键词图标徽章（供 render.ts 复用） */
export function keywordIconBadges(kws: Keyword[]): string {
  return kws
    .map(
      (k) =>
        `<span class="kw-icon kw-icon-${k}" title="${KEYWORD_NAMES[k]}">${KEYWORD_ICONS[k]}</span>`,
    )
    .join('')
}

/** 三连奖励卡牌 HTML（带完整关键词视觉层） */
export function rewardCardHtml(def: CardDef, rewardId: string): string {
  const tribeChar = TRIBE_CHAR[def.tribe] ?? '?'
  const stars = '★'.repeat(def.tier)
  const kws = defKeywords(def)
  const { floor, aura, banner, icons } = keywordVisualLayers(kws)
  const tooltip = escapeAttr(cardDefTooltipHtml(def))

  const imgSrc = MINION_IMAGES[def.id] ?? ''
  const imgHtml = imgSrc
    ? `<img class="card-img" src="${imgSrc}" alt="${def.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="card-art-fallback" style="display:none">${def.name.charAt(0)}</div>`
    : `<div class="card-art">${def.name.charAt(0)}</div>`

  const cls = [
    'card',
    'reward-card',
    `tribe-${def.tribe}`,
    kws.includes('taunt') ? 'has-taunt' : '',
    kws.includes('divineShield') ? 'has-shield' : '',
    kws.includes('reborn') ? 'has-reborn' : '',
    kws.includes('poison') ? 'has-poison' : '',
    kws.includes('windfury') ? 'has-windfury' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return `<div class="${cls}" data-reward-id="${rewardId}" data-tooltip="${tooltip}">
    ${floor}
    ${aura}
    ${banner}
    <div class="card-frame">
      <div class="card-stars">${stars}</div>
      <div class="card-tribe t-${def.tribe}">${tribeChar}</div>
      <div class="card-keywords">${icons}</div>
      ${imgHtml}
    </div>
    <div class="card-atk">${def.attack}</div>
    <div class="card-hp">${def.health}</div>
  </div>`
}
