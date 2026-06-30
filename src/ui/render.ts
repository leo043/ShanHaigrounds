// UI 渲染主协调 - GameUI 类、英雄选择、阶段渲染与交互绑定
import type { GameState, Minion, CardDef, Tribe, Class } from '../game/types'
import { HEROES, CARDS } from '../game/cards'
import { toggleMute, isMuted } from '../game/audio'
import { HERO_IMAGES } from '../config/assets'
import { minionHtml, heroHtml, codexCardHtml, rewardCardHtml } from './cards'
import { calculateSynergies, getTribeName, getClassName } from '../game/synergy'
import {
  TRIBE_SYNERGY_DESC,
  CLASS_SYNERGY_DESC,
  TRIBE_SYNERGY_LEVELS,
  CLASS_SYNERGY_LEVELS,
} from '../game/types'
import { escapeAttr, minionTooltipHtml } from './tooltip'

export type Selection = { type: 'hand'; uid: string } | { type: 'board'; uid: string } | null

export interface UIHooks {
  onBuy: (tavernUid: string) => void
  onDropHandToBoard: (handUid: string, boardIndex: number) => void
  onSwapBoard: (uidA: string, uidB: string) => void
  onMoveBoardToSlot: (uid: string, boardIndex: number) => void
  onSell: (uid: string) => void
  onRefresh: () => void
  onFreeze: () => void
  onUpgrade: () => void
  onCombat: () => void
  onRestart: () => void
  onTripleRewardPick: (defId: string) => void
  onHeroPick: (heroId: string) => void
  onSurrender: () => void
}

/** 渲染开局英雄选择面板（独立函数，不依赖 GameUI 实例） */
export function renderHeroSelect(
  root: HTMLElement,
  onPick: (heroId: string) => void,
  onBack: () => void,
): void {
  const cardsHtml = HEROES.map((h) => {
    const imgSrc = HERO_IMAGES[h.id] ?? ''
    const portraitHtml = imgSrc
      ? `<img class="hero-select-img" src="${imgSrc}" alt="${h.name}" onerror="this.style.display='none'">`
      : ``
    return `<div class="hero-select-card" data-hero-id="${h.id}">
      <div class="hero-select-portrait">${portraitHtml}</div>
      <div class="hero-select-name">${h.name}</div>
      <div class="hero-select-title">${h.title}</div>
      <div class="hero-select-stats">
        <span class="hs-hp">❤ ${h.health}</span>
        ${h.armor > 0 ? `<span class="hs-armor">🛡 ${h.armor}</span>` : ''}
      </div>
      <div class="hero-select-power">
        <div class="hs-power-label">${h.powerName}</div>
        <div class="hs-power-desc">${h.powerDesc}</div>
      </div>
    </div>`
  }).join('')

  root.innerHTML = `
    <div class="hero-select-overlay">
      <div class="hero-select-banner">
        <div class="codex-back" id="hero-back" style="position:absolute;top:16px;left:20px;font-size:28px;cursor:pointer;color:var(--gold-light);z-index:10">←</div>
        <h1 class="hero-select-h1">择主而战</h1>
        <div class="hero-select-sub">选择你的英雄 · 五神各异 · 技能定调</div>
      </div>
      <div class="hero-select-cards">${cardsHtml}</div>
      <div class="hero-select-foot">点选英雄即开战 · 敌方英雄将随机指定</div>
    </div>
  `
  root.querySelectorAll<HTMLElement>('.hero-select-card').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.heroId
      if (id) onPick(id)
    })
  })
  root.querySelector('#hero-back')?.addEventListener('click', onBack)
}

/** 渲染主菜单 */
export function renderMainMenu(
  root: HTMLElement,
  onAdventure: () => void,
  onCodex: () => void,
): void {
  root.innerHTML = `
    <div class="main-menu-overlay">
      <div class="main-menu-title">山海战棋</div>
      <div class="main-menu-subtitle">东方神话酒馆战棋</div>
      <div class="main-menu-cards">
        <div class="main-menu-card" data-action="adventure">
          <div class="menu-card-icon">⚔</div>
          <div class="menu-card-title">冒险模式</div>
          <div class="menu-card-desc">选择英雄，招募随从，击败对手</div>
        </div>
        <div class="main-menu-card" data-action="codex">
          <div class="menu-card-icon">📖</div>
          <div class="menu-card-title">随从图鉴</div>
          <div class="menu-card-desc">浏览所有随从卡牌，了解技能详情</div>
        </div>
      </div>
    </div>
  `
  root.querySelector('[data-action="adventure"]')?.addEventListener('click', onAdventure)
  root.querySelector('[data-action="codex"]')?.addEventListener('click', onCodex)
}

/** 渲染随从图鉴 */
export function renderCodex(root: HTMLElement, onBack: () => void): void {
  bindGlobalTooltip()

  const tribeOptions = [
    { key: 'all', label: '全部' },
    { key: 'human', label: '人族' },
    { key: 'demon', label: '妖族' },
    { key: 'spirit', label: '仙族' },
  ]
  const classOptions = [
    { key: 'all', label: '全部' },
    { key: 'warrior', label: '武将' },
    { key: 'assassin', label: '刺客' },
    { key: 'mage', label: '法师' },
    { key: 'archer', label: '射手' },
    { key: 'priest', label: '祭司' },
    { key: 'shaman', label: '巫祝' },
  ]
  const tierOptions = [
    { key: 'all', label: '全部' },
    { key: '1', label: '★' },
    { key: '2', label: '★★' },
    { key: '3', label: '★★★' },
    { key: '4', label: '★★★★' },
    { key: '5', label: '★★★★★' },
  ]

  let filterTribe = 'all'
  let filterClass = 'all'
  let filterTier = 'all'

  function getLabel(
    opts: Array<{ key: string | number; label: string }>,
    val: string | number,
  ): string {
    return opts.find((o) => o.key === val)?.label ?? ''
  }

  function renderCards(): void {
    const filtered = CARDS.filter((c) => {
      if (filterTribe !== 'all' && c.tribe !== filterTribe) return false
      if (filterClass !== 'all' && c.class !== filterClass) return false
      if (filterTier !== 'all' && c.tier !== Number(filterTier)) return false
      return true
    })

    const cardsHtml = filtered.map((def) => codexCardHtml(def)).join('')
    const body = root.querySelector('.codex-body')
    if (body) {
      body.innerHTML = cardsHtml
        ? `<div class="codex-cards">${cardsHtml}</div>`
        : '<div class="codex-empty">没有符合条件的随从</div>'
    }

    const countEl = root.querySelector('.codex-count')
    if (countEl) countEl.textContent = `${filtered.length} / ${CARDS.length}`

    // 更新标签文字和 active 状态
    const tribeTag = root.querySelector('#codex-filter-tribe') as HTMLElement
    const classTag = root.querySelector('#codex-filter-class') as HTMLElement
    const tierTag = root.querySelector('#codex-filter-tier') as HTMLElement
    if (tribeTag) {
      tribeTag.textContent = filterTribe === 'all' ? '种族' : getLabel(tribeOptions, filterTribe)
      tribeTag.classList.toggle('active', filterTribe !== 'all')
    }
    if (classTag) {
      classTag.textContent = filterClass === 'all' ? '羁绊' : getLabel(classOptions, filterClass)
      classTag.classList.toggle('active', filterClass !== 'all')
    }
    if (tierTag) {
      tierTag.textContent = filterTier === 'all' ? '星级' : getLabel(tierOptions, filterTier)
      tierTag.classList.toggle('active', filterTier !== 'all')
    }
  }

  function showPicker(
    title: string,
    options: Array<{ key: string | number; label: string }>,
    current: string | number,
    onSelect: (key: string | number) => void,
  ): void {
    // 移除旧弹窗
    root.querySelector('.codex-picker-overlay')?.remove()

    const items = options
      .map((o) => {
        const active = o.key === current ? ' active' : ''
        return `<div class="codex-picker-item${active}" data-pick-key="${o.key}">${o.label}</div>`
      })
      .join('')

    const overlay = document.createElement('div')
    overlay.className = 'codex-picker-overlay'
    overlay.innerHTML = `
      <div class="codex-picker-mask"></div>
      <div class="codex-picker-panel">
        <div class="codex-picker-title">${title}</div>
        <div class="codex-picker-options">${items}</div>
      </div>
    `
    root.appendChild(overlay)

    overlay.querySelector('.codex-picker-mask')?.addEventListener('click', () => overlay.remove())
    overlay.querySelectorAll<HTMLElement>('.codex-picker-item').forEach((el) => {
      el.addEventListener('click', () => {
        const key = el.dataset.pickKey ?? 'all'
        onSelect(key)
        overlay.remove()
        renderCards()
      })
    })
  }

  root.innerHTML = `
    <div class="codex-overlay">
      <div class="codex-topbar">
        <div class="codex-back" id="codex-back">←</div>
        <div class="codex-title">随从图鉴</div>
        <button class="codex-filter-tag" id="codex-synergy-ref" style="background:rgba(201,161,74,0.25);color:#c9a14a;border-color:#c9a14a">查看羁绊</button>
        <span class="codex-count">${CARDS.length} / ${CARDS.length}</span>
        <div class="codex-filters">
          <button class="codex-filter-tag" id="codex-filter-tribe">种族</button>
          <button class="codex-filter-tag" id="codex-filter-class">职业</button>
          <button class="codex-filter-tag" id="codex-filter-tier">星级</button>
        </div>
      </div>
      <div class="codex-body"></div>
    </div>
  `

  root.querySelector('#codex-back')?.addEventListener('click', onBack)

  root.querySelector('#codex-filter-tribe')?.addEventListener('click', () => {
    showPicker('选择种族', tribeOptions, filterTribe, (k) => {
      filterTribe = k as string
    })
  })
  root.querySelector('#codex-filter-class')?.addEventListener('click', () => {
    showPicker('选择羁绊', classOptions, filterClass, (k) => {
      filterClass = k as string
    })
  })
  root.querySelector('#codex-filter-tier')?.addEventListener('click', () => {
    showPicker('选择星级', tierOptions, filterTier, (k) => {
      filterTier = k as string
    })
  })

  // 羁绊效果一览弹窗
  root.querySelector('#codex-synergy-ref')?.addEventListener('click', () => {
    root.querySelector('.codex-synergy-overlay')?.remove()

    function buildRows(
      entries: { name: string; descs: string[]; thresholds: number[] }[],
      colorClass: string,
    ): string {
      return entries
        .map(({ name, descs, thresholds }) => {
          const levels = descs
            .map(
              (d, i) =>
                `<div class="syn-ref-level"><span class="syn-ref-threshold">${thresholds[i]}个</span><span class="syn-ref-desc">${d}</span></div>`,
            )
            .join('')
          return `<div class="syn-ref-group"><div class="syn-ref-name ${colorClass}">${name}</div>${levels}</div>`
        })
        .join('')
    }

    const tribeRows = buildRows(
      [
        { name: '人族', descs: TRIBE_SYNERGY_DESC.human, thresholds: TRIBE_SYNERGY_LEVELS.human },
        { name: '妖族', descs: TRIBE_SYNERGY_DESC.demon, thresholds: TRIBE_SYNERGY_LEVELS.demon },
        { name: '仙族', descs: TRIBE_SYNERGY_DESC.spirit, thresholds: TRIBE_SYNERGY_LEVELS.spirit },
      ],
      'tribe-color',
    )

    const classRows = buildRows(
      [
        {
          name: '武将',
          descs: CLASS_SYNERGY_DESC.warrior,
          thresholds: CLASS_SYNERGY_LEVELS.warrior,
        },
        {
          name: '刺客',
          descs: CLASS_SYNERGY_DESC.assassin,
          thresholds: CLASS_SYNERGY_LEVELS.assassin,
        },
        { name: '法师', descs: CLASS_SYNERGY_DESC.mage, thresholds: CLASS_SYNERGY_LEVELS.mage },
        { name: '射手', descs: CLASS_SYNERGY_DESC.archer, thresholds: CLASS_SYNERGY_LEVELS.archer },
        { name: '祭司', descs: CLASS_SYNERGY_DESC.priest, thresholds: CLASS_SYNERGY_LEVELS.priest },
        { name: '巫祝', descs: CLASS_SYNERGY_DESC.shaman, thresholds: CLASS_SYNERGY_LEVELS.shaman },
      ],
      'class-color',
    )

    const overlay = document.createElement('div')
    overlay.className = 'codex-synergy-overlay'
    overlay.innerHTML = `
      <div class="codex-synergy-mask"></div>
      <div class="codex-synergy-panel">
        <div class="syn-ref-title">羁绊效果一览</div>
        <div class="syn-ref-body">
          <div class="syn-ref-section"><div class="syn-ref-section-title tribe-color">种族羁绊</div>${tribeRows}</div>
          <div class="syn-ref-section"><div class="syn-ref-section-title class-color">职业羁绊</div>${classRows}</div>
        </div>
        <button class="syn-ref-close" id="syn-ref-close">关闭</button>
      </div>
    `
    root.appendChild(overlay)
    overlay.querySelector('.codex-synergy-mask')?.addEventListener('click', () => overlay.remove())
    overlay.querySelector('#syn-ref-close')?.addEventListener('click', () => overlay.remove())
  })

  renderCards()
}

/** 羁绊图标（名称首字） */
const SYNERGY_ICONS: Record<string, string> = {
  human: '人',
  demon: '妖',
  spirit: '仙',
  warrior: '武',
  assassin: '刺',
  mage: '法',
  archer: '射',
  priest: '祭',
  shaman: '巫',
}

/** 羁绊颜色 */
const SYNERGY_COLORS: Record<string, string> = {
  human: '#3a6ea5',
  demon: '#7b4b94',
  spirit: '#c9a14a',
  warrior: '#b0bec5',
  assassin: '#e74c3c',
  mage: '#9b59b6',
  archer: '#27ae60',
  priest: '#f39c12',
  shaman: '#1abc9c',
}

/** 渲染羁绊图标条 HTML（底部dock，紧凑横向排列） */
function synergyDockHtml(board: Minion[]): string {
  const synergies = calculateSynergies(board)
  const activeSynergies = synergies.filter((s) => s.count > 0)

  if (activeSynergies.length === 0) {
    return ''
  }

  const items = activeSynergies
    .map((s) => {
      const name =
        s.tagType === 'tribe' ? getTribeName(s.tag as Tribe) : getClassName(s.tag as Class)
      const icon = SYNERGY_ICONS[s.tag] ?? '?'
      const color = SYNERGY_COLORS[s.tag] ?? '#888'
      const isActive = s.activeLevel > 0

      const tag = s.tagType === 'tribe' ? (s.tag as Tribe) : (s.tag as Class)
      const descs =
        s.tagType === 'tribe' ? TRIBE_SYNERGY_DESC[tag as Tribe] : CLASS_SYNERGY_DESC[tag as Class]
      const tooltipLines = descs
        .map((d, i) => {
          const reached = s.levelThresholds[i] <= s.count
          return `<div class="tt-syn-line ${reached ? 'active' : ''}">
            <span class="tt-syn-num">${s.levelThresholds[i]}</span>
            <span class="tt-syn-desc">${d}</span>
          </div>`
        })
        .join('')
      const tooltip = escapeAttr(
        `<div class="tt-syn-wrap">${name}（${s.count}）${tooltipLines}</div>`,
      )

      return `<div class="dock-syn-item ${isActive ? 'active' : ''}" data-tooltip="${tooltip}">
        <div class="dock-syn-icon ${isActive ? 'glow' : ''}" style="background:${isActive ? color : 'rgba(255,255,255,0.12)'};${isActive ? `box-shadow:0 0 8px ${color}66` : ''}">
          <span class="dock-syn-icon-text">${icon}</span>
        </div>
        <span class="dock-syn-count" style="color:${isActive ? color : '#888'}">${s.count}</span>
      </div>`
    })
    .join('')

  return `${items}`
}

/** 全局 tooltip：监听 mouseover/mouseout，根据 data-tooltip 显示浮窗（只绑定一次） */
let tooltipBound = false
let isDragging = false
let tooltipEl: HTMLDivElement | null = null
export function setDragging(v: boolean): void {
  isDragging = v
  if (v && tooltipEl) tooltipEl.style.display = 'none'
}
function bindGlobalTooltip(): void {
  if (tooltipBound) return
  tooltipBound = true
  const ensureTooltip = (): HTMLDivElement => {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div')
      tooltipEl.id = 'global-tooltip'
      tooltipEl.className = 'tooltip-floating'
      document.body.appendChild(tooltipEl)
    }
    return tooltipEl
  }
  const hideTooltip = () => {
    if (tooltipEl) tooltipEl.style.display = 'none'
  }
  document.addEventListener('mouseover', (e) => {
    if (isDragging) {
      hideTooltip()
      return
    }
    const card = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement | null
    if (!card) return
    const raw = card.getAttribute('data-tooltip')
    if (!raw) return
    const t = ensureTooltip()
    t.innerHTML = raw
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
    t.style.display = 'block'
    const rect = card.getBoundingClientRect()
    const tw = t.offsetWidth
    const th = t.offsetHeight
    const pad = 10
    let left = rect.right + pad
    let top = rect.top + rect.height / 2 - th / 2
    if (left + tw > window.innerWidth - pad) {
      left = rect.left - tw - pad
    }
    if (left < pad) {
      left = rect.left + rect.width / 2 - tw / 2
      top = rect.top - th - pad
    }
    if (top < pad) {
      top = rect.bottom + pad
    }
    if (top + th > window.innerHeight - pad) {
      top = window.innerHeight - th - pad
    }
    if (left < pad) left = pad
    if (left + tw > window.innerWidth - pad) left = window.innerWidth - tw - pad
    t.style.left = left + 'px'
    t.style.top = top + 'px'
  })
  document.addEventListener('mouseout', (e) => {
    const card = (e.target as HTMLElement).closest('[data-tooltip]')
    if (card && tooltipEl) tooltipEl.style.display = 'none'
  })
  document.addEventListener('dragover', () => {
    if (isDragging && tooltipEl) tooltipEl.style.display = 'none'
  })
}

export class GameUI {
  state: GameState
  root: HTMLElement
  hooks: UIHooks
  selection: Selection = null

  constructor(state: GameState, root: HTMLElement, hooks: UIHooks) {
    this.state = state
    this.root = root
    this.hooks = hooks
    bindGlobalTooltip()
  }

  /** 渲染三连奖励三选一面板 */
  renderTripleReward(rewards: CardDef[]): void {
    const s = this.state
    const cardsHtml = rewards.map((def) => rewardCardHtml(def, def.id)).join('')

    this.root.innerHTML = `
      <div class="topbar">
        ${heroHtml(s.enemy, true)}
        <div class="turn-info">三连奖励！</div>
        ${heroHtml(s.player, false)}
      </div>
      <div class="triple-reward-overlay">
        <div class="triple-banner">
          <div class="triple-title">三连达成！</div>
          <div class="triple-sub">从以下三张卡牌中选择一张加入手牌</div>
        </div>
        <div class="triple-cards">${cardsHtml}</div>
      </div>
    `
    this.root.querySelectorAll<HTMLElement>('.reward-card').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.rewardId
        if (id) this.hooks.onTripleRewardPick(id)
      })
    })
  }

  /** 渲染招募阶段 - 对齐官方布局：英雄+控制顶栏 → 酒馆+战场中间 → 手牌底部 → 羁绊图标条 */
  renderRecruit(): void {
    const s = this.state
    const selUid =
      this.selection?.type === 'hand' || this.selection?.type === 'board'
        ? this.selection.uid
        : null

    const tavernCards = s.player.tavern
      .map((m) => minionHtml(m, { zone: 'tavern', board: s.player.board }))
      .join('')
    const handCards = s.player.hand
      .map((m) =>
        minionHtml(m, {
          hand: true,
          selected: m.uid === selUid,
          zone: 'hand',
          board: s.player.board,
        }),
      )
      .join('')
    const boardCards = s.player.board
      .map((m) =>
        minionHtml(m, {
          selected: m.uid === selUid,
          zone: 'board',
          side: 'player',
          board: s.player.board,
        }),
      )
      .join('')

    const canUpgrade = s.player.tavernTier < 6 && s.player.gold >= s.player.upgradeCost
    const hasFreeRefresh =
      s.player.hero.power === 'freeRefreshOnce' && !s.player.hero.freeRefreshUsed
    const canRefresh = hasFreeRefresh || s.player.gold >= 1
    const refreshCost = hasFreeRefresh ? 0 : 1

    this.root.innerHTML = `
      <!-- ====== 顶部：英雄 + 控制按钮 ====== -->
      <div class="topbar">
        ${heroHtml(s.enemy, true)}
        <div class="turn-info">第 ${s.turn} 回合 · 招募 · 酒馆${s.player.tavernTier}级</div>
        <div class="topbar-actions">
          <button class="topbar-icon-btn" id="btn-mute" title="${isMuted() ? '取消静音' : '静音'}">
            <span>${isMuted() ? '🔇' : '🔊'}</span>
          </button>
          <button class="topbar-icon-btn" id="btn-surrender" title="投降"><span>⚑</span></button>
        </div>
      </div>

      <!-- 控制行：升级 | 刷新 | 冻结 | 金币 | 卖出 | 开战 -->
      <div class="control-row">
        <button class="ctrl-btn ctrl-upgrade" id="btn-upgrade" ${canUpgrade ? '' : 'disabled'} title="升级酒馆">
          <span class="ctrl-icon">★</span>
          <span class="ctrl-cost">${s.player.upgradeCost}</span>
        </button>
        <button class="ctrl-btn ctrl-refresh" id="btn-refresh" ${canRefresh ? '' : 'disabled'} title="刷新酒馆">
          <span class="ctrl-icon">↻</span>
          <span class="ctrl-cost">${refreshCost}</span>
        </button>
        <button class="ctrl-btn ctrl-freeze ${s.player.frozen ? 'active' : ''}" id="btn-freeze" title="${s.player.frozen ? '已冻结' : '冻结酒馆'}">
          <span class="ctrl-icon">❄</span>
          <span class="ctrl-cost">${s.player.frozen ? '✓' : '0'}</span>
        </button>
        <div class="gold-display"><span class="gold-coin"></span>${s.player.gold}</div>
        <div class="synergy-dock" id="synergy-panel">
          ${synergyDockHtml(s.player.board)}
        </div>
        <div class="spacer"></div>
        <button class="ctrl-btn ctrl-combat btn-primary" id="btn-combat">⚔ 开战！</button>
      </div>

      <!-- ====== 主区域：垂直堆叠（对齐官方） ====== -->
      <div class="main-area recruit-layout">
        <!-- 酒馆区 -->
        <div class="tavern-section">
          <div class="section-header">
            <span class="section-label">酒馆</span>
            <span class="section-sub">酒馆${s.player.tavernTier}级</span>
          </div>
          <div class="tavern-cards" id="tavern-cards">${tavernCards || '<span class="empty-row">暂无商品，点击刷新</span>'}</div>
        </div>

        <!-- 战场区 -->
        <div class="board-section">
          <div class="section-header">
            <span class="section-label">我方阵容</span>
            <span class="section-sub">${s.player.board.length}/7</span>
          </div>
          <div class="board-zone" id="player-board">${boardCards}</div>
        </div>

        <!-- 手牌区（底部） -->
        <div class="hand-section">
          <div class="section-header">
            <span class="section-label">手牌</span>
            <span class="section-sub">${s.player.hand.length}/10</span>
          </div>
          <div class="hand-zone" id="player-hand">${handCards || '<span class="empty-hand">手牌为空</span>'}</div>
        </div>
      </div>
    `
    this.bindRecruitEvents()
  }

  private bindRecruitEvents(): void {
    const root = this.root

    // --- 拖拽交互 ---
    const clearDragOver = () => {
      root.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'))
    }

    // 酒馆卡牌拖出
    root.querySelector('#tavern-cards')?.addEventListener('dragstart', (e: Event) => {
      const de = e as DragEvent
      const card = (de.target as HTMLElement).closest('.card') as HTMLElement | null
      if (!card?.dataset.uid) return
      de.dataTransfer!.setData(
        'text/plain',
        JSON.stringify({ source: 'tavern', uid: card.dataset.uid }),
      )
      card.classList.add('dragging')
      setDragging(true)
    })
    root.querySelector('#tavern-cards')?.addEventListener('dragend', (e: Event) => {
      const card = (e.target as HTMLElement).closest('.card') as HTMLElement | null
      if (card) card.classList.remove('dragging')
      clearDragOver()
      setDragging(false)
    })

    // 手牌区域：接受酒馆拖入（购买）；手牌卡牌可拖出
    const handZone = root.querySelector('#player-hand')
    handZone?.addEventListener('dragover', (e: Event) => {
      const raw = (root.querySelector('#tavern-cards') as HTMLElement)?.querySelector('.dragging')
      if (raw) {
        e.preventDefault()
        handZone.classList.add('drag-over')
      }
    })
    handZone?.addEventListener('dragleave', () => handZone.classList.remove('drag-over'))
    handZone?.addEventListener('drop', (e: Event) => {
      e.preventDefault()
      handZone.classList.remove('drag-over')
      try {
        const data = JSON.parse((e as DragEvent).dataTransfer!.getData('text/plain'))
        if (data.source === 'tavern') this.hooks.onBuy(data.uid)
      } catch {
        /* ignore */
      }
    })

    // 手牌卡牌拖出
    root.querySelector('#player-hand')?.addEventListener('dragstart', (e: Event) => {
      const de = e as DragEvent
      const card = (de.target as HTMLElement).closest('.card') as HTMLElement | null
      if (!card?.dataset.uid) return
      de.dataTransfer!.setData(
        'text/plain',
        JSON.stringify({ source: 'hand', uid: card.dataset.uid }),
      )
      card.classList.add('dragging')
      setDragging(true)
    })
    root.querySelector('#player-hand')?.addEventListener('dragend', (e: Event) => {
      const card = (e.target as HTMLElement).closest('.card') as HTMLElement | null
      if (card) card.classList.remove('dragging')
      clearDragOver()
      setDragging(false)
    })

    // 战场区域：接受手牌拖入（上场）和战场内拖拽（换位）
    const boardZone = root.querySelector('#player-board')
    let currentDropIdx = -999
    const clearDropIndicators = () => {
      boardZone?.querySelectorAll<HTMLElement>('.drop-indicator').forEach((el) => el.remove())
      currentDropIdx = -999
    }
    const getBoardDropIndex = (de: DragEvent, zone: HTMLElement): number => {
      const cards = Array.from(zone.querySelectorAll<HTMLElement>('.card[data-zone="board"]'))
      const dragging = zone.querySelector<HTMLElement>('.dragging')
      const valid = cards.filter((c) => c !== dragging)
      if (valid.length === 0) return 0
      const x = de.clientX
      for (let i = 0; i < valid.length; i++) {
        const rect = valid[i].getBoundingClientRect()
        if (x < rect.left + rect.width / 2) return i
      }
      return valid.length
    }
    const showDropIndicator = (idx: number) => {
      if (idx === currentDropIdx) return
      clearDropIndicators()
      const cards = Array.from(boardZone!.querySelectorAll<HTMLElement>('.card[data-zone="board"]'))
      const ph = document.createElement('div')
      ph.className = 'drop-indicator'
      if (idx < cards.length) {
        boardZone!.insertBefore(ph, cards[idx])
      } else {
        boardZone!.appendChild(ph)
      }
      currentDropIdx = idx
    }
    boardZone?.addEventListener('dragover', (e: Event) => {
      const de = e as DragEvent
      const raw = root.querySelector('.dragging')
      if (!raw) return
      const zone = (raw as HTMLElement).dataset.zone
      if (zone === 'hand' || zone === 'board') {
        e.preventDefault()
        boardZone.classList.add('drag-over')
        // 先清再量再建：清除旧占位 → 测量干净的 bounding rect → 只在位置变化时重建
        boardZone.querySelectorAll<HTMLElement>('.drop-indicator').forEach((el) => el.remove())
        const idx = getBoardDropIndex(de, boardZone as HTMLElement)
        showDropIndicator(idx)
      }
    })
    boardZone?.addEventListener('dragleave', (e: Event) => {
      if (!boardZone.contains((e as DragEvent).relatedTarget as Node)) {
        boardZone.classList.remove('drag-over')
        clearDropIndicators()
      }
    })
    boardZone?.addEventListener('drop', (e: Event) => {
      e.preventDefault()
      boardZone.classList.remove('drag-over')
      clearDropIndicators()
      try {
        const de = e as DragEvent
        const data = JSON.parse(de.dataTransfer!.getData('text/plain'))
        const boardIndex = getBoardDropIndex(de, boardZone as HTMLElement)

        if (data.source === 'hand') {
          this.hooks.onDropHandToBoard(data.uid, boardIndex)
        } else if (data.source === 'board') {
          const targetCard = (de.target as HTMLElement).closest(
            '.card[data-zone="board"]',
          ) as HTMLElement | null
          if (targetCard?.dataset.uid && targetCard.dataset.uid !== data.uid) {
            this.hooks.onSwapBoard(data.uid, targetCard.dataset.uid)
          } else {
            this.hooks.onMoveBoardToSlot(data.uid, boardIndex)
          }
        }
      } catch {
        /* ignore */
      }
    })

    // 战场卡牌拖出
    root.querySelector('#player-board')?.addEventListener('dragstart', (e: Event) => {
      const de = e as DragEvent
      const card = (de.target as HTMLElement).closest('.card') as HTMLElement | null
      if (!card?.dataset.uid) return
      de.dataTransfer!.setData(
        'text/plain',
        JSON.stringify({ source: 'board', uid: card.dataset.uid }),
      )
      card.classList.add('dragging')
      setDragging(true)
    })
    root.querySelector('#player-board')?.addEventListener('dragend', (e: Event) => {
      const card = (e.target as HTMLElement).closest('.card') as HTMLElement | null
      if (card) card.classList.remove('dragging')
      clearDragOver()
      clearDropIndicators()
      setDragging(false)
    })

    // 酒馆区域：接受战场卡拖入（卖出）
    const tavernZone = root.querySelector('#tavern-cards')
    tavernZone?.addEventListener('dragover', (e: Event) => {
      const raw = root.querySelector('.dragging')
      if ((raw as HTMLElement)?.dataset.zone === 'board') {
        e.preventDefault()
        tavernZone.classList.add('drag-over')
      }
    })
    tavernZone?.addEventListener('dragleave', () => tavernZone.classList.remove('drag-over'))
    tavernZone?.addEventListener('drop', (e: Event) => {
      e.preventDefault()
      tavernZone.classList.remove('drag-over')
      try {
        const data = JSON.parse((e as DragEvent).dataTransfer!.getData('text/plain'))
        if (data.source === 'board') this.hooks.onSell(data.uid)
      } catch {
        /* ignore */
      }
    })

    // ===== 触摸拖拽支持（Android WebView） =====
    let touchDragData: {
      source: 'tavern' | 'hand' | 'board'
      uid: string
      clone: HTMLElement
      startX: number
      startY: number
      timer: ReturnType<typeof setTimeout>
      active: boolean
    } | null = null
    const LONG_PRESS_MS = 300

    const getTouchCard = (el: HTMLElement): HTMLElement | null => {
      return el.closest('.card') as HTMLElement | null
    }

    const getDropTarget = (x: number, y: number): { zone: string; index: number } | null => {
      const handZone = root.querySelector('#player-hand') as HTMLElement | null
      const boardZone = root.querySelector('#player-board') as HTMLElement | null
      const tavernZone = root.querySelector('#tavern-cards') as HTMLElement | null

      // Check hand zone
      if (handZone) {
        const r = handZone.getBoundingClientRect()
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return { zone: 'hand', index: 0 }
        }
      }
      // Check board zone
      if (boardZone) {
        const r = boardZone.getBoundingClientRect()
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          const cards = Array.from(
            boardZone.querySelectorAll<HTMLElement>('.card[data-zone="board"]'),
          )
          let idx = cards.length
          for (let i = 0; i < cards.length; i++) {
            const cr = cards[i].getBoundingClientRect()
            if (x < cr.left + cr.width / 2) {
              idx = i
              break
            }
          }
          return { zone: 'board', index: idx }
        }
      }
      // Check tavern zone (for selling)
      if (tavernZone) {
        const r = tavernZone.getBoundingClientRect()
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return { zone: 'tavern', index: 0 }
        }
      }
      return null
    }

    const onTouchStart = (e: TouchEvent) => {
      const card = getTouchCard(e.target as HTMLElement)
      if (!card?.dataset.uid) return
      const zone = card.dataset.zone as 'tavern' | 'hand' | 'board'
      const touch = e.touches[0]

      touchDragData = {
        source: zone,
        uid: card.dataset.uid,
        clone: null as unknown as HTMLElement,
        startX: touch.clientX,
        startY: touch.clientY,
        timer: setTimeout(() => {
          if (!touchDragData) return
          // Long press confirmed — create lightweight drag indicator
          const c = document.createElement('div')
          c.className = 'touch-drag-ghost'
          c.style.cssText =
            'position:fixed;z-index:9999;pointer-events:none;opacity:0.8;' +
            'width:64px;height:80px;border-radius:8px;' +
            'background:linear-gradient(180deg,rgba(201,161,74,0.6),rgba(192,57,43,0.4));' +
            'border:2px solid rgba(201,161,74,0.8);box-shadow:0 4px 16px rgba(0,0,0,0.3);' +
            'display:flex;align-items:center;justify-content:center;font-size:28px;'
          c.textContent = '🃏'
          c.style.left = touch.clientX - 32 + 'px'
          c.style.top = touch.clientY - 40 + 'px'
          document.body.appendChild(c)
          touchDragData.clone = c
          touchDragData.active = true
          card.classList.add('dragging')
          setDragging(true)
          if (tooltipEl) tooltipEl.style.display = 'none'
        }, LONG_PRESS_MS),
        active: false,
      }
    }

    let lastMoveTime = 0
    const onTouchMove = (e: TouchEvent) => {
      if (!touchDragData) return
      const touch = e.touches[0]
      const dx = Math.abs(touch.clientX - touchDragData.startX)
      const dy = Math.abs(touch.clientY - touchDragData.startY)
      // Cancel long press if moved too far before activation
      if (!touchDragData.active && (dx > 10 || dy > 10)) {
        clearTimeout(touchDragData.timer)
        touchDragData = null
        return
      }
      if (!touchDragData.active) return
      e.preventDefault()

      // Throttle: max ~30fps for move handling
      const now = performance.now()
      if (now - lastMoveTime < 33) return
      lastMoveTime = now

      touchDragData.clone.style.left = touch.clientX - 32 + 'px'
      touchDragData.clone.style.top = touch.clientY - 40 + 'px'

      // Highlight drop zone
      clearDragOver()
      const target = getDropTarget(touch.clientX, touch.clientY)
      if (target) {
        const zoneEl =
          target.zone === 'hand'
            ? root.querySelector('#player-hand')
            : target.zone === 'board'
              ? root.querySelector('#player-board')
              : root.querySelector('#tavern-cards')
        zoneEl?.classList.add('drag-over')
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchDragData) return
      clearTimeout(touchDragData.timer)
      if (!touchDragData.active) {
        touchDragData = null
        return
      }
      const touch = e.changedTouches[0]
      const target = getDropTarget(touch.clientX, touch.clientY)

      // Cleanup
      touchDragData.clone.remove()
      const origCard = root.querySelector(`.card[data-uid="${touchDragData.uid}"]`)
      origCard?.classList.remove('dragging')
      clearDragOver()
      clearDropIndicators()
      setDragging(false)

      if (target) {
        const { source, uid } = touchDragData
        if (source === 'tavern' && target.zone === 'hand') {
          this.hooks.onBuy(uid)
        } else if (source === 'hand' && target.zone === 'board') {
          this.hooks.onDropHandToBoard(uid, target.index)
        } else if (source === 'board' && target.zone === 'board') {
          // Find card at target index to swap
          const boardCards = Array.from(
            root.querySelectorAll('#player-board .card[data-zone="board"]'),
          )
          const targetCard = boardCards[target.index] as HTMLElement | null
          if (targetCard?.dataset.uid && targetCard.dataset.uid !== uid) {
            this.hooks.onSwapBoard(uid, targetCard.dataset.uid)
          } else {
            this.hooks.onMoveBoardToSlot(uid, target.index)
          }
        } else if (source === 'board' && target.zone === 'tavern') {
          this.hooks.onSell(uid)
        }
      }
      touchDragData = null
    }

    // Attach touch listeners to card zones
    for (const sel of ['#tavern-cards', '#player-hand', '#player-board']) {
      root
        .querySelector(sel)
        ?.addEventListener('touchstart', onTouchStart as EventListener, { passive: true })
      root
        .querySelector(sel)
        ?.addEventListener('touchmove', onTouchMove as EventListener, { passive: false })
      root
        .querySelector(sel)
        ?.addEventListener('touchend', onTouchEnd as EventListener, { passive: true })
    }

    // 按钮事件（保持不变）
    root.querySelector('#btn-refresh')?.addEventListener('click', () => this.hooks.onRefresh())
    root.querySelector('#btn-freeze')?.addEventListener('click', () => this.hooks.onFreeze())
    root.querySelector('#btn-upgrade')?.addEventListener('click', () => this.hooks.onUpgrade())
    root.querySelector('#btn-surrender')?.addEventListener('click', () => {
      if (confirm('确定要投降吗？')) this.hooks.onSurrender()
    })
    root.querySelector('#btn-combat')?.addEventListener('click', () => this.hooks.onCombat())
    root.querySelector('#btn-mute')?.addEventListener('click', () => {
      toggleMute()
      this.renderRecruit()
    })
  }

  /** 渲染战斗阶段（对齐官方：敌方英雄+战场在上，我方战场+英雄在下，日志overlay） */
  renderCombatStatic(
    playerBoard: Minion[],
    enemyBoard: Minion[],
    logHtml: string,
    title: string,
    sub: string,
    summonedUid?: string,
  ): void {
    const s = this.state
    const eHtml = enemyBoard
      .map((m) => minionHtml(m, { side: 'enemy', summonIn: m.uid === summonedUid }))
      .join('')
    const pHtml = playerBoard
      .map((m) => minionHtml(m, { side: 'player', summonIn: m.uid === summonedUid }))
      .join('')

    this.root.innerHTML = `
      <div class="topbar">
        <div class="topbar-left-info">
          <span class="topbar-phase-label">第 ${s.turn} 回合 · 战斗中</span>
        </div>
        <div class="topbar-actions">
          <button class="topbar-icon-btn" id="btn-mute" title="${isMuted() ? '取消静音' : '静音'}">
            <span>${isMuted() ? '🔇' : '🔊'}</span>
          </button>
          <button class="topbar-icon-btn" id="btn-surrender" title="投降"><span>⚑</span></button>
        </div>
      </div>
      <div class="main-area combat-layout">
        <!-- 敌方区域：英雄 + 战场 -->
        <div class="combat-half combat-enemy-half">
          <div class="combat-hero-bar enemy">${heroHtml(s.enemy, true)}</div>
          <div class="board-zone enemy" id="board-enemy">${eHtml || '<span class="empty-hint">空</span>'}</div>
        </div>

        <!-- 中间战斗信息 -->
        <div class="combat-center">
          <div class="message-title">${title}</div>
          <div class="message-sub">${sub}</div>
        </div>

        <!-- 我方区域：战场 + 英雄 -->
        <div class="combat-half combat-player-half">
          <div class="board-zone" id="player-board">${pHtml || '<span class="empty-hint">空</span>'}</div>
          <div class="combat-hero-bar player">${heroHtml(s.player, false)}</div>
        </div>
      </div>

      <!-- 日志按钮 + 浮窗 -->
      <button class="combat-log-toggle" id="log-toggle">日志</button>
      <div class="combat-log-overlay" id="combat-log-sidebar">
        <div class="combat-log-panel">
          <div class="combat-log-header">
            <span>战斗日志</span>
            <button class="combat-log-close" id="log-close">✕</button>
          </div>
          <div class="combat-log" id="combat-log">${logHtml}</div>
        </div>
      </div>
    `
    this.bindLogToggle()
  }

  private bindLogToggle(): void {
    const sidebar = this.root.querySelector('#combat-log-sidebar') as HTMLElement | null
    const btn = this.root.querySelector('#log-toggle') as HTMLElement | null
    const closeBtn = this.root.querySelector('#log-close') as HTMLElement | null
    if (!sidebar || !btn) return
    btn.addEventListener('click', () => {
      sidebar.classList.toggle('open')
    })
    closeBtn?.addEventListener('click', () => {
      sidebar.classList.remove('open')
    })
  }

  /** 轻量更新：只更新日志和标题，不重建棋盘 DOM */
  updateCombatLogAndTitle(logHtml: string, title: string, sub: string): void {
    const logEl = this.root.querySelector('#combat-log')
    if (logEl) logEl.innerHTML = logHtml
    const titleEl = this.root.querySelector('.message-title')
    if (titleEl) titleEl.textContent = title
    const subEl = this.root.querySelector('.message-sub')
    if (subEl) subEl.textContent = sub
  }

  /** 轻量更新：根据快照原地更新 HP / 攻击力 / 圣盾状态，同时刷新悬停详情 */
  updateCombatHp(pBoard: Minion[], eBoard: Minion[]): void {
    const updateSide = (board: Minion[], zoneSelector: string) => {
      const zone = this.root.querySelector(zoneSelector)
      if (!zone) return
      for (const m of board) {
        const el = zone.querySelector(`[data-uid="${m.uid}"]`) as HTMLElement | null
        if (!el) continue
        const hpEl = el.querySelector('.card-hp')
        if (hpEl) {
          const val = Math.max(0, m.health)
          hpEl.textContent = String(val)
          hpEl.classList.toggle('damaged', m.health < m.maxHealth)
        }
        const atkEl = el.querySelector('.card-atk')
        if (atkEl) atkEl.textContent = String(m.attack)
        el.classList.toggle('has-shield', m.divineShield)
        el.classList.toggle('has-reborn', m.keywords.includes('reborn') && !m.rebornUsed)
        el.setAttribute('data-tooltip', escapeAttr(minionTooltipHtml(m)))
      }
    }
    updateSide(pBoard, '#player-board')
    updateSide(eBoard, '#board-enemy')
  }

  renderGameOver(): void {
    const s = this.state
    const winText = s.winner === 'player' ? '胜' : s.winner === 'enemy' ? '败' : '和'
    const sub =
      s.winner === 'player'
        ? '荡平妖氛，凯旋而归！'
        : s.winner === 'enemy'
          ? '兵败如山倒，卷土重来？'
          : '两败俱伤，势均力敌。'
    this.root.innerHTML = `
      <div class="topbar">
        ${heroHtml(s.enemy, true)}
        <div class="turn-info">战局已定</div>
        ${heroHtml(s.player, false)}
      </div>
      <div class="gameover-overlay">
        <h1>${winText}</h1>
        <div class="sub">${sub}</div>
        <button class="btn btn-primary" id="btn-restart">再战一局</button>
      </div>
    `
    this.root.querySelector('#btn-restart')?.addEventListener('click', () => this.hooks.onRestart())
  }

  /** 显示倒计时（多人模式招募阶段） */
  showCountdown(seconds: number): void {
    const turnInfo = this.root.querySelector('.turn-info')
    if (turnInfo) {
      const badge = document.createElement('span')
      badge.className = 'mp-countdown-badge'
      badge.id = 'mp-countdown'
      badge.textContent = `⏱ ${seconds}s`
      turnInfo.appendChild(badge)
    }
    // 隐藏开战按钮
    const combatBtn = this.root.querySelector('#btn-combat') as HTMLElement | null
    if (combatBtn) combatBtn.style.display = 'none'
  }

  /** 更新倒计时数字 */
  updateCountdown(seconds: number): void {
    const badge = this.root.querySelector('#mp-countdown')
    if (badge) badge.textContent = `⏱ ${seconds}s`
  }

  /** 显示等待对手（倒计时结束后） */
  showWaitingForOpponent(): void {
    const badge = this.root.querySelector('#mp-countdown')
    if (badge) {
      badge.textContent = '等待对手...'
      badge.classList.add('waiting')
    }
    // 禁用所有操作按钮
    const buttons = this.root.querySelectorAll('.ctrl-btn') as NodeListOf<HTMLElement>
    for (const btn of buttons) {
      btn.style.pointerEvents = 'none'
      btn.style.opacity = '0.5'
    }
  }
}
