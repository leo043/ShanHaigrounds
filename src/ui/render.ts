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
  onHandClick: (uid: string) => void
  onBoardClick: (uid: string) => void
  onPlayToSlot: (boardIndex: number) => void
  onSell: () => void
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
  onRoom: () => void,
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
        <div class="main-menu-card" data-action="room">
          <div class="menu-card-icon">🏠</div>
          <div class="menu-card-title">创建房间</div>
          <div class="menu-card-desc">与好友在线对战</div>
        </div>
      </div>
    </div>
  `
  root.querySelector('[data-action="adventure"]')?.addEventListener('click', onAdventure)
  root.querySelector('[data-action="codex"]')?.addEventListener('click', onCodex)
  root.querySelector('[data-action="room"]')?.addEventListener('click', onRoom)
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

/** 渲染羁绊面板 HTML */
function synergyPanelHtml(board: Minion[]): string {
  const synergies = calculateSynergies(board)
  const activeSynergies = synergies.filter((s) => s.count > 0)

  if (activeSynergies.length === 0) {
    return '<div class="synergy-panel"><div class="synergy-title">羁绊</div><div class="synergy-empty">战场无随从</div></div>'
  }

  const items = activeSynergies
    .map((s) => {
      const name =
        s.tagType === 'tribe' ? getTribeName(s.tag as Tribe) : getClassName(s.tag as Class)
      const icon = SYNERGY_ICONS[s.tag] ?? '?'
      const color = SYNERGY_COLORS[s.tag] ?? '#888'
      const isActive = s.activeLevel > 0

      // 生成 tooltip 内容：每级效果
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

      // 阈值进度：显示每个阈值，已激活的高亮
      const thresholds = s.levelThresholds
      const progressDots = thresholds
        .map((t) => {
          const reached = s.count >= t
          return `<span class="syn-threshold ${reached ? 'reached' : ''}">${t}</span>`
        })
        .join('<span class="syn-sep">›</span>')

      return `<div class="syn-row ${isActive ? 'active' : ''}" data-tooltip="${tooltip}">
        <div class="syn-icon ${isActive ? 'glow' : ''}" style="background:${isActive ? color : 'rgba(255,255,255,0.12)'};${isActive ? `box-shadow:0 0 10px ${color}88` : ''}">
          <span class="syn-icon-text">${icon}</span>
        </div>
        <div class="syn-info">
          <div class="syn-top">
            <span class="syn-count" style="color:${isActive ? color : '#888'}">${s.count}</span>
            <span class="syn-name">${name}</span>
          </div>
          <div class="syn-thresholds">${progressDots}</div>
        </div>
      </div>`
    })
    .join('')

  return `<div class="synergy-panel"><div class="synergy-title">羁绊</div>${items}</div>`
}

/** 全局 tooltip：监听 mouseover/mouseout，根据 data-tooltip 显示浮窗（只绑定一次） */
let tooltipBound = false
function bindGlobalTooltip(): void {
  if (tooltipBound) return
  tooltipBound = true
  let tooltipEl: HTMLDivElement | null = null
  const ensureTooltip = (): HTMLDivElement => {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div')
      tooltipEl.id = 'global-tooltip'
      tooltipEl.className = 'tooltip-floating'
      document.body.appendChild(tooltipEl)
    }
    return tooltipEl
  }
  document.addEventListener('mouseover', (e) => {
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
    // 优先显示在元素右侧
    let left = rect.right + pad
    let top = rect.top + rect.height / 2 - th / 2
    // 右侧放不下则显示在左侧
    if (left + tw > window.innerWidth - pad) {
      left = rect.left - tw - pad
    }
    // 左侧也放不下则居中显示在上方
    if (left < pad) {
      left = rect.left + rect.width / 2 - tw / 2
      top = rect.top - th - pad
    }
    // 上方放不下则显示在下方
    if (top < pad) {
      top = rect.bottom + pad
    }
    // 底部溢出
    if (top + th > window.innerHeight - pad) {
      top = window.innerHeight - th - pad
    }
    // 水平边界修正
    if (left < pad) left = pad
    if (left + tw > window.innerWidth - pad) left = window.innerWidth - tw - pad
    t.style.left = left + 'px'
    t.style.top = top + 'px'
  })
  document.addEventListener('mouseout', (e) => {
    const card = (e.target as HTMLElement).closest('[data-tooltip]')
    if (card && tooltipEl) tooltipEl.style.display = 'none'
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

  /** 渲染招募阶段 - 布局：顶部英雄栏+控制 → 酒馆行 → 战场行 → 手牌悬浮底栏 */
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
    const emptySlot =
      s.player.board.length < 7
        ? `<div class="board-slot drop-target" data-slot="board-${s.player.board.length}"></div>`
        : ''

    const canUpgrade = s.player.tavernTier < 6 && s.player.gold >= s.player.upgradeCost
    const hasFreeRefresh =
      s.player.hero.power === 'freeRefreshOnce' && !s.player.hero.freeRefreshUsed
    const canRefresh = hasFreeRefresh || s.player.gold >= 1
    const refreshCost = hasFreeRefresh ? 0 : 1
    const canSell = this.selection?.type === 'board'

    const hint =
      this.selection?.type === 'hand'
        ? '点击战场空位或随从前方放置'
        : this.selection?.type === 'board'
          ? '点另一随从交换站位 · 再点取消 · 点卖出'
          : '点酒馆购买 · 点手牌选中放置 · 点战场调整站位'

    this.root.innerHTML = `
      <!-- ====== 顶部：英雄 + 控制按钮（对齐官方）====== -->
      <div class="topbar">
        ${heroHtml(s.enemy, true)}
        <div class="turn-info">第 ${s.turn} 回合 · 招募 · 酒馆${s.player.tavernTier}级</div>
        ${heroHtml(s.player, false)}
      </div>

      <!-- 控制行：升级 | 刷新 | 冻结 | 金币 | 静音 | 卖出 | 开战 -->
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
        <div class="gold-display"><span class="gold-coin"></span>${s.player.gold}/${s.player.maxGold}</div>
        <div class="spacer"></div>
        <button class="ctrl-btn ctrl-surrender" id="btn-surrender" title="投降"><span class="ctrl-icon">⚑</span></button>
        <button class="ctrl-btn ctrl-mute" id="btn-mute" title="${isMuted() ? '取消静音' : '静音'}">
          <span class="ctrl-icon">${isMuted() ? '🔇' : '🔊'}</span>
        </button>
        <button class="ctrl-btn ctrl-sell" id="btn-sell" ${canSell ? '' : 'disabled'} title="卖出选中随从">
          <span class="ctrl-icon">$</span><span>+1</span>
        </button>
        <button class="ctrl-btn ctrl-combat btn-primary" id="btn-combat">⚔ 开战！</button>
      </div>

      <!-- ====== 主区域：酒馆 → 战场 → 手牌 ====== -->
      <div class="main-area recruit-layout">
        <!-- 羁绊面板（左侧） -->
        <div class="synergy-sidebar" id="synergy-panel">
          ${synergyPanelHtml(s.player.board)}
        </div>

        <!-- 中间区域 -->
        <div class="recruit-center">
          <!-- 酒馆行（在上方！） -->
          <div class="tavern-row">
            <div class="row-label">酒馆商店</div>
            <div class="tavern-cards" id="tavern-cards">${tavernCards || '<span class="empty-row">暂无商品，点击刷新</span>'}</div>
          </div>

          <!-- 我方战场 -->
          <div class="board-row">
            <div class="row-label">我方阵容</div>
            <div class="board-zone" id="player-board">${boardCards}${emptySlot}</div>
          </div>

          <!-- 提示信息 -->
          <div class="hint-bar">
            <span>${hint}</span>
            <span class="enemy-tag">敌方备战中 · 酒馆${s.enemy.tavernTier}级 · 棋子${s.enemy.board.length}/7</span>
          </div>

          <!-- 手牌区（底部悬浮） -->
          <div class="hand-row">
            <div class="row-label">手牌 (${s.player.hand.length}/10)</div>
            <div class="hand-zone" id="player-hand">${handCards || '<span class="empty-hand">手牌为空</span>'}</div>
          </div>
        </div>
      </div>
    `
    this.bindRecruitEvents()
  }

  private bindRecruitEvents(): void {
    const root = this.root
    root.querySelector('#tavern-cards')?.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.card') as HTMLElement | null
      if (card?.dataset.uid) this.hooks.onBuy(card.dataset.uid)
    })
    root.querySelector('#player-hand')?.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.card') as HTMLElement | null
      if (card?.dataset.uid) this.hooks.onHandClick(card.dataset.uid)
    })
    root.querySelector('#player-board')?.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.card') as HTMLElement | null
      if (card?.dataset.uid) {
        this.hooks.onBoardClick(card.dataset.uid)
      } else {
        const slot = (e.target as HTMLElement).closest('[data-slot]') as HTMLElement | null
        if (slot?.dataset.slot) {
          const idx = parseInt(slot.dataset.slot.replace('board-', ''), 10)
          this.hooks.onPlayToSlot(idx)
        }
      }
    })
    root.querySelector('#btn-refresh')?.addEventListener('click', () => this.hooks.onRefresh())
    root.querySelector('#btn-freeze')?.addEventListener('click', () => this.hooks.onFreeze())
    root.querySelector('#btn-upgrade')?.addEventListener('click', () => this.hooks.onUpgrade())
    root.querySelector('#btn-sell')?.addEventListener('click', () => this.hooks.onSell())
    root.querySelector('#btn-surrender')?.addEventListener('click', () => {
      if (confirm('确定要投降吗？')) this.hooks.onSurrender()
    })
    root.querySelector('#btn-combat')?.addEventListener('click', () => this.hooks.onCombat())
    root.querySelector('#btn-mute')?.addEventListener('click', () => {
      toggleMute()
      this.renderRecruit()
    })
  }

  /** 渲染战斗阶段（双方棋盘上下对峙 + 右侧日志） */
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
        ${heroHtml(s.enemy, true)}
        <div class="turn-info">第 ${s.turn} 回合 · 战斗中</div>
        ${heroHtml(s.player, false)}
      </div>
      <div class="main-area combat-layout">
        <div class="synergy-sidebar" id="synergy-panel">
          ${synergyPanelHtml(s.player.board)}
        </div>
        <div class="combat-center-area">
          <div class="combat-side combat-enemy">
            <div class="row-label">敌阵</div>
            <div class="board-zone enemy" id="board-enemy">${eHtml || '<span class="empty-hint">空</span>'}</div>
          </div>
          <div class="combat-center">
            <div class="message-title">${title}</div>
            <div class="message-sub">${sub}</div>
          </div>
          <div class="combat-side combat-player">
            <div class="row-label">我阵</div>
            <div class="board-zone" id="player-board">${pHtml || '<span class="empty-hint">空</span>'}</div>
          </div>
        </div>
        <div class="combat-log-sidebar open" id="combat-log-sidebar">
          <button class="log-toggle-btn" id="log-toggle">▸ 日志</button>
          <div class="combat-log" id="combat-log">${logHtml}</div>
        </div>
      </div>
    `
    this.bindLogToggle()
  }

  private bindLogToggle(): void {
    const sidebar = this.root.querySelector('#combat-log-sidebar') as HTMLElement | null
    const btn = this.root.querySelector('#log-toggle') as HTMLElement | null
    if (!sidebar || !btn) return
    btn.addEventListener('click', () => {
      sidebar.classList.toggle('open')
      btn.textContent = sidebar.classList.contains('open') ? '▸ 日志' : '◂ 日志'
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
