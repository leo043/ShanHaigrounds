// UI 渲染与交互 - 对齐官方酒馆战棋布局
import type { GameState, Minion, PlayerState, CardDef } from '../game/types'
import { describeCard, KEYWORD_NAMES, CARD_MAP, HEROES } from '../game/cards'
import { toggleMute, isMuted } from '../game/audio'

export type Selection = { type: 'hand'; uid: string } | { type: 'board'; uid: string } | null

const TRIBE_CHAR: Record<string, string> = { human: '人', demon: '妖', spirit: '仙' }

/** 卡牌图片路径映射 (defId → 图片相对路径) */
export const MINION_IMAGES: Record<string, string> = {
  // 人族
  human_archer: '/images/minions/human_archer.png',
  human_guard: '/images/minions/human_guard.png',
  human_swordsman: '/images/minions/human_swordsman.png',
  human_monk: '/images/minions/human_monk.png',
  human_general: '/images/minions/human_general.png',
  human_strategist: '/images/minions/human_strategist.png',
  human_immortal: '/images/minions/human_immortal.png',
  human_baima: '/images/minions/human_baima.png',
  human_huben: '/images/minions/human_huben.png',
  human_guanyu: '/images/minions/human_guanyu.png',
  // 妖族
  demon_imp: '/images/minions/demon_imp.png',
  demon_snake: '/images/minions/demon_snake.png',
  demon_bear: '/images/minions/demon_bear.png',
  demon_spider: '/images/minions/demon_spider.png',
  demon_fox: '/images/minions/demon_fox.png',
  demon_bull: '/images/minions/demon_bull.png',
  demon_zombie: '/images/minions/demon_zombie.png',
  demon_goblin: '/images/minions/demon_goblin.png',
  demon_centipede: '/images/minions/demon_centipede.png',
  demon_huangfeng: '/images/minions/demon_huangfeng.png',
  demon_niutou: '/images/minions/demon_niutou.png',
  // 仙族
  spirit_child: '/images/minions/spirit_child.png',
  spirit_crane: '/images/minions/spirit_crane.png',
  spirit_thunder: '/images/minions/spirit_thunder.png',
  spirit_erlang: '/images/minions/spirit_erlang.png',
  spirit_nezha: '/images/minions/spirit_nezha.png',
  spirit_taishang: '/images/minions/spirit_taishang.png',
  spirit_phoenix: '/images/minions/spirit_phoenix.png',
  spirit_yutu: '/images/minions/spirit_yutu.png',
  spirit_lotus: '/images/minions/spirit_lotus.png',
  spirit_nanji: '/images/minions/spirit_nanji.png',
  // 召唤物（衍生物）
  summon_小蛇: '/images/minions/summon_snake.png',
  summon_蛛仔: '/images/minions/summon_spider.png',
  summon_腐尸: '/images/minions/summon_zombie.png',
  summon_蛮牛: '/images/minions/summon_bull.png',
}

/** 英雄头像映射 */
export const HERO_IMAGES: Record<string, string> = {
  hero_xuanwu: '/images/heroes/hero_xuanwu.png',
  hero_zhuque: '/images/heroes/hero_zhuque.png',
  hero_baihu: '/images/heroes/hero_baihu.png',
  hero_qinglong: '/images/heroes/hero_qinglong.png',
  hero_qilin: '/images/heroes/hero_qilin.png',
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

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 英雄 HTML（支持图片） */
function heroHtml(p: PlayerState, isEnemy: boolean): string {
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

export class GameUI {
  state: GameState
  root: HTMLElement
  hooks: UIHooks
  selection: Selection = null

  constructor(state: GameState, root: HTMLElement, hooks: UIHooks) {
    this.state = state
    this.root = root
    this.hooks = hooks
    this.bindGlobalTooltip()
  }

  /** 全局 tooltip：监听 mouseover/mouseout，根据 data-tooltip 显示浮窗 */
  private bindGlobalTooltip(): void {
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
