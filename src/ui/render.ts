// UI 渲染主协调 - GameUI 类、英雄选择、阶段渲染与交互绑定
import type { GameState, Minion, CardDef } from '../game/types'
import { KEYWORD_NAMES, HEROES, CARDS } from '../game/cards'
import { toggleMute, isMuted } from '../game/audio'
import { MINION_IMAGES, HERO_IMAGES } from '../config/assets'
import { escapeAttr, cardDefTooltipHtml, TRIBE_CHAR } from './tooltip'
import { minionHtml, heroHtml, codexCardHtml } from './cards'

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
}

/** 渲染开局英雄选择面板（独立函数，不依赖 GameUI 实例） */
export function renderHeroSelect(root: HTMLElement, onPick: (heroId: string) => void): void {
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
        <div class="main-menu-card disabled" data-action="room">
          <div class="menu-card-badge">敬请期待</div>
          <div class="menu-card-icon">🏠</div>
          <div class="menu-card-title">创建房间</div>
          <div class="menu-card-desc">与好友对战，更多玩法即将上线</div>
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
  const tribes: Array<{ key: string; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'human', label: '人族' },
    { key: 'demon', label: '妖族' },
    { key: 'spirit', label: '仙族' },
  ]
  const tiers: Array<{ key: number | 'all'; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 1, label: '★' },
    { key: 2, label: '★★' },
    { key: 3, label: '★★★' },
    { key: 4, label: '★★★★' },
    { key: 5, label: '★★★★★' },
  ]

  let filterTribe = 'all'
  let filterTier: number | 'all' = 'all'

  function renderCards(): void {
    const filtered = CARDS.filter((c) => {
      if (filterTribe !== 'all' && c.tribe !== filterTribe) return false
      if (filterTier !== 'all' && c.tier !== filterTier) return false
      return true
    })

    const cardsHtml = filtered.map((def) => codexCardHtml(def)).join('')
    const body = root.querySelector('.codex-body')
    if (body) {
      body.innerHTML = cardsHtml
        ? `<div class="codex-cards">${cardsHtml}</div>`
        : '<div class="codex-empty">没有符合条件的随从</div>'
    }

    // 更新计数
    const countEl = root.querySelector('.codex-count')
    if (countEl) {
      countEl.textContent = `${filtered.length} / ${CARDS.length}`
    }

    // 更新筛选按钮状态
    root.querySelectorAll<HTMLElement>('[data-filter-tribe]').forEach((el) => {
      el.classList.toggle('active', el.dataset.filterTribe === filterTribe)
    })
    root.querySelectorAll<HTMLElement>('[data-filter-tier]').forEach((el) => {
      const val = el.dataset.filterTier
      el.classList.toggle('active', val === String(filterTier))
    })
  }

  const tribeBtns = tribes
    .map(
      (t) =>
        `<button class="codex-filter-btn${t.key === filterTribe ? ' active' : ''}" data-filter-tribe="${t.key}">${t.label}</button>`,
    )
    .join('')

  const tierBtns = tiers
    .map(
      (t) =>
        `<button class="codex-filter-btn${t.key === filterTier ? ' active' : ''}" data-filter-tier="${t.key}">${t.label}</button>`,
    )
    .join('')

  root.innerHTML = `
    <div class="codex-overlay">
      <div class="codex-topbar">
        <div class="codex-back" id="codex-back">←</div>
        <div class="codex-title">随从图鉴</div>
        <span class="codex-count">${CARDS.length} / ${CARDS.length}</span>
        <div class="codex-filters">
          <span style="font-size:12px;color:var(--gold-light);margin-right:2px">种族</span>
          ${tribeBtns}
          <div class="codex-filter-sep"></div>
          <span style="font-size:12px;color:var(--gold-light);margin-right:2px">星级</span>
          ${tierBtns}
        </div>
      </div>
      <div class="codex-body"></div>
    </div>
  `

  root.querySelector('#codex-back')?.addEventListener('click', onBack)

  root.querySelectorAll<HTMLElement>('[data-filter-tribe]').forEach((el) => {
    el.addEventListener('click', () => {
      filterTribe = el.dataset.filterTribe ?? 'all'
      renderCards()
    })
  })

  root.querySelectorAll<HTMLElement>('[data-filter-tier]').forEach((el) => {
    el.addEventListener('click', () => {
      const val = el.dataset.filterTier ?? 'all'
      filterTier = val === 'all' ? 'all' : parseInt(val, 10)
      renderCards()
    })
  })

  renderCards()
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
      tooltipEl.style.cssText =
        'position:fixed;z-index:9999;pointer-events:none;display:none;max-width:440px;'
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
    let left = rect.left + rect.width / 2 - tw / 2
    let top = rect.top - th - 8
    if (top < 4) top = rect.bottom + 8 // 下方
    if (left < 4) left = 4
    if (left + tw > window.innerWidth - 4) left = window.innerWidth - tw - 4
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
    const cardsHtml = rewards
      .map((def) => {
        const tooltip = escapeAttr(cardDefTooltipHtml(def))
        const imgSrc = MINION_IMAGES[def.id] ?? ''
        const imgHtml = imgSrc
          ? `<img class="card-img" src="${imgSrc}" alt="${def.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="card-art-fallback" style="display:none">${def.name.charAt(0)}</div>`
          : `<div class="card-art">${def.name.charAt(0)}</div>`
        const kwBadges = (def.keywords ?? [])
          .map((k) => {
            const cls =
              k === 'taunt'
                ? 'taunt'
                : k === 'divineShield'
                  ? 'shield'
                  : k === 'reborn'
                    ? 'reborn'
                    : k === 'poison'
                      ? 'poison'
                      : 'windfury'
            return `<span class="kw-badge k-${cls}">${KEYWORD_NAMES[k].charAt(0)}</span>`
          })
          .join('')
        return `<div class="card reward-card tribe-${def.tribe} ${def.keywords?.includes('taunt') ? 'has-taunt' : ''}" data-reward-id="${def.id}" data-tooltip="${tooltip}">
        <div class="card-frame">
          <div class="card-stars">${'★'.repeat(def.tier)}</div>
          <div class="card-tribe t-${def.tribe}">${TRIBE_CHAR[def.tribe]}</div>
          <div class="card-keywords">${kwBadges}</div>
          ${imgHtml}
        </div>
        <div class="card-atk">${def.attack}</div>
        <div class="card-hp">${def.health}</div>
      </div>`
      })
      .join('')

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

    const tavernCards = s.player.tavern.map((m) => minionHtml(m, { zone: 'tavern' })).join('')
    const handCards = s.player.hand
      .map((m) => minionHtml(m, { hand: true, selected: m.uid === selUid, zone: 'hand' }))
      .join('')
    const boardCards = s.player.board
      .map((m) => minionHtml(m, { selected: m.uid === selUid, zone: 'board', side: 'player' }))
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
        <div class="combat-log visible" id="combat-log">${logHtml}</div>
      </div>
    `
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

  /** 轻量更新：根据快照原地更新 HP / 攻击力 / 圣盾状态，不重建 DOM */
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
}
