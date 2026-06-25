// Tooltip 生成 - 卡牌悬停详情、HTML 转义工具
import type { Minion, CardDef, SynergyInfo, Tribe, Class } from '../game/types'
import { describeCard, KEYWORD_NAMES, CARD_MAP } from '../game/cards'
import { MINION_IMAGES } from '../config/assets'
import { calculateSynergies, getTribeName, getClassName } from '../game/synergy'

/** 种族中文字符 */
export const TRIBE_CHAR: Record<string, string> = { human: '人', demon: '妖', spirit: '仙' }

/** 转义 HTML 属性值中的特殊字符（用于 data-tooltip 属性） */
export function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 计算羁绊预览：始终显示种族和职业贡献，战场卡显示贡献，酒馆/手牌卡显示购买后变化 */
function synergyPreviewHtml(m: Minion, board: Minion[] | undefined): string {
  if (!board) return ''

  const isOnBoard = board.some((b) => b.uid === m.uid)

  let after: SynergyInfo[]

  if (isOnBoard) {
    after = calculateSynergies(board)
  } else {
    after = calculateSynergies([...board, m])
  }

  const items: string[] = []
  for (const s of after) {
    // 只显示这张卡所属的种族和职业
    if (s.tagType === 'tribe' && s.tag !== m.tribe) continue
    if (s.tagType === 'class' && s.tag !== m.class) continue
    if (s.count === 0) continue

    const name = s.tagType === 'tribe' ? getTribeName(s.tag as Tribe) : getClassName(s.tag as Class)
    if (s.activeLevel > 0) {
      items.push(`<span class="tcd-synergy-up">▲ ${name} ×${s.count} Lv.${s.activeLevel}</span>`)
    } else {
      const next = s.levelThresholds[0]
      items.push(`<span class="tcd-synergy-near">${name} ×${s.count}/${next}</span>`)
    }
  }

  if (items.length === 0) return ''
  const label = isOnBoard ? '贡献' : '羁绊'
  return `<div class="tcd-synergy-preview"><span class="tcd-synergy-label">${label}</span>${items.join('')}</div>`
}

/** 生成随从卡牌的 tooltip HTML（鼠标悬停详情 - 大图+侧边效果） */
export function minionTooltipHtml(m: Minion, board?: Minion[]): string {
  const def: CardDef = {
    id: m.defId,
    name: m.name,
    tribe: m.tribe,
    class: m.class,
    tier: m.tier,
    attack: m.attack,
    health: m.health,
    keywords: m.keywords,
    effects: m.effects,
    flavor: CARD_MAP[m.defId]?.flavor ?? '',
  }
  const synergyHtml = synergyPreviewHtml(m, board)
  return cardDetailHtml(def, m.golden, m.health, m.maxHealth, synergyHtml)
}

/** 为静态卡牌定义生成 tooltip（图鉴用，显示种族/职业羁绊信息） */
export function cardDefTooltipHtml(def: CardDef): string {
  const synergyHtml = codexSynergyHtml(def)
  return cardDetailHtml(def, false, def.health, def.health, synergyHtml)
}

/** 图鉴用：显示该卡所属种族和职业 */
function codexSynergyHtml(def: CardDef): string {
  const tribeName = getTribeName(def.tribe)
  const className = getClassName(def.class)
  return `<div class="tcd-synergy-preview">
    <span class="tcd-synergy-label">羁绊</span>
    <span class="tcd-synergy-near">${tribeName}</span>
    <span class="tcd-synergy-near">${className}</span>
  </div>`
}

/** 生成卡牌详情面板 HTML：左侧大图卡 + 右侧效果说明 */
function cardDetailHtml(
  def: CardDef,
  golden: boolean,
  curHp: number,
  maxHp: number,
  synergyHtml?: string,
): string {
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
      ${synergyHtml ?? ''}
      ${def.flavor ? `<div class="tcd-flavor">「${def.flavor}」</div>` : ''}
    </div>
  </div>`
}
