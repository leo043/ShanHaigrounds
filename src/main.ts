// 山海战棋 · 入口
import './styles/main.css'
import {
  createGame,
  buyMinion,
  sellMinion,
  playMinion,
  swapMinions,
  refreshTavern,
  freezeTavern,
  upgradeTavern,
  endRecruitPhase,
  startTurn,
  dealDamageToHero,
  checkGameOver,
  generateTripleReward,
  applyTripleReward,
} from './game/game'
import { simulateCombat } from './game/combat'
import { runAITurn } from './game/ai'
import { GameUI, renderHeroSelect, renderMainMenu, renderCodex } from './ui/render'
import { renderRoomLobby, getMultiplayerClient } from './ui/room'
import { CARD_MAP, HEROES } from './game/cards'
import { delay, cloneBoard } from './game/shared'
import { playCombatAnimation } from './game/combat-anim'
import * as sfx from './game/audio'
import { playRecruitBgm, playCombatBgm, stopBgm } from './game/audio'

// ============ 游戏控制器：封装 state 和 ui，消除全局可变状态 ============

class GameController {
  private state: ReturnType<typeof createGame>
  private ui: GameUI

  constructor(playerHeroId: string, root: HTMLElement) {
    const enemyPool = HEROES.filter((h) => h.id !== playerHeroId)
    const enemyHero = enemyPool[Math.floor(Math.random() * enemyPool.length)]
    this.state = createGame(playerHeroId, enemyHero.id)
    sfx.sfxSelect()
    playRecruitBgm()
    this.ui = new GameUI(this.state, root, {
      onBuy: (uid) => this.onBuy(uid),
      onDropHandToBoard: (handUid, boardIdx) => this.onDropHandToBoard(handUid, boardIdx),
      onSwapBoard: (uidA, uidB) => this.onSwapBoard(uidA, uidB),
      onMoveBoardToSlot: (uid, boardIdx) => this.onMoveBoardToSlot(uid, boardIdx),
      onSell: (uid) => this.onSell(uid),
      onRefresh: () => this.onRefresh(),
      onFreeze: () => this.onFreeze(),
      onUpgrade: () => this.onUpgrade(),
      onCombat: () => this.onCombat(),
      onRestart: () => this.onRestart(),
      onTripleRewardPick: (defId) => this.onTripleRewardPick(defId),
      onHeroPick: () => {},
      onSurrender: () => this.onSurrender(),
    })
    this.ui.renderRecruit()
  }

  // ============ 招募阶段交互 ============

  private onBuy(uid: string): void {
    const idx = this.state.player.tavern.findIndex((m) => m.uid === uid)
    if (idx < 0) return
    buyMinion(this.state.player, idx, this.state.uidGen)
    sfx.sfxBuy()
    this.ui.renderRecruit()
  }

  private onDropHandToBoard(handUid: string, boardIndex: number): void {
    const handIdx = this.state.player.hand.findIndex((m) => m.uid === handUid)
    if (handIdx < 0) return
    const triggerReward = playMinion(this.state.player, handIdx, boardIndex, this.state.uidGen)
    if (triggerReward) {
      sfx.sfxTriple()
      this.showTripleReward()
    } else {
      sfx.sfxBuy()
      this.ui.renderRecruit()
    }
  }

  private onSwapBoard(uidA: string, uidB: string): void {
    swapMinions(this.state.player, uidA, uidB)
    this.ui.renderRecruit()
  }

  private onMoveBoardToSlot(uid: string, boardIndex: number): void {
    const board = this.state.player.board
    const fromIdx = board.findIndex((m) => m.uid === uid)
    if (fromIdx < 0 || fromIdx === boardIndex) return
    const [minion] = board.splice(fromIdx, 1)
    const insertAt = Math.min(boardIndex, board.length)
    board.splice(insertAt, 0, minion)
    this.ui.renderRecruit()
  }

  // ============ 三连奖励 ============

  private showTripleReward(): void {
    const rewards = generateTripleReward(this.state.player)
    if (rewards.length === 0) {
      this.ui.renderRecruit()
      return
    }
    sfx.sfxTripleReveal()
    this.ui.renderTripleReward(rewards)
  }

  private onTripleRewardPick(defId: string): void {
    const def = CARD_MAP[defId]
    if (def) applyTripleReward(this.state.player, def, this.state.uidGen)
    this.ui.renderRecruit()
  }

  private onSell(uid: string): void {
    const idx = this.state.player.board.findIndex((m) => m.uid === uid)
    if (idx < 0) return
    sellMinion(this.state.player, idx)
    sfx.sfxSell()
    sfx.sfxGoldCoin()
    this.ui.renderRecruit()
  }

  private onRefresh(): void {
    if (refreshTavern(this.state.player, this.state.uidGen)) {
      sfx.sfxRefresh()
      this.ui.renderRecruit()
    }
  }

  private onFreeze(): void {
    freezeTavern(this.state.player)
    sfx.sfxFreeze()
    this.ui.renderRecruit()
  }

  private onUpgrade(): void {
    if (upgradeTavern(this.state.player)) {
      sfx.sfxUpgrade()
      this.ui.renderRecruit()
    }
  }

  // ============ 战斗流程 ============

  private async onCombat(): Promise<void> {
    // 禁用开战按钮防止重复点击
    const btn = document.getElementById('btn-combat') as HTMLButtonElement | null
    if (btn) btn.disabled = true

    // 1. AI 执行招募
    runAITurn(this.state)

    // 2. 结束招募阶段（触发回合结束 buff）
    endRecruitPhase(this.state)

    // 3. 保存战斗开始时的 board 快照（深拷贝）
    //    规则：战斗中的死亡不影响我方阵容，下一回合开始时随从应与战斗开始时一致
    const playerBoardSnapshot = cloneBoard(this.state.player.board)
    const enemyBoardSnapshot = cloneBoard(this.state.enemy.board)

    // 4. 模拟战斗（在副本上进行，不修改 state）
    const result = simulateCombat(this.state)

    // 5. 播放战斗动画
    sfx.sfxCombatStart()
    playCombatBgm()
    await playCombatAnimation(this.ui, result, this.state.player.board, this.state.enemy.board)

    // 6. 结算英雄伤害（按战斗胜负）
    if (result.winner === 'player') {
      dealDamageToHero(this.state, 'enemy', result.damageToLoser)
    } else if (result.winner === 'enemy') {
      dealDamageToHero(this.state, 'player', result.damageToLoser)
    }

    // 7. 关键：恢复战斗开始时的阵容（所有随从都在，回满血，复生/圣盾重置）
    //    战斗中死亡的随从不消失，只有主动出售才会消失
    for (const m of playerBoardSnapshot) {
      m.health = m.maxHealth
      m.rebornUsed = false
      m.divineShield = m.keywords.includes('divineShield')
      m.hasAttacked = false
    }
    for (const m of enemyBoardSnapshot) {
      m.health = m.maxHealth
      m.rebornUsed = false
      m.divineShield = m.keywords.includes('divineShield')
      m.hasAttacked = false
    }
    this.state.player.board = playerBoardSnapshot
    this.state.enemy.board = enemyBoardSnapshot

    // 8. 检查游戏结束
    checkGameOver(this.state)
    if (this.state.phase === 'gameover') {
      stopBgm()
      if (this.state.winner === 'player') sfx.sfxVictory()
      else if (this.state.winner === 'enemy') sfx.sfxDefeat()
      else sfx.sfxDraw()
      this.ui.state = this.state
      this.ui.renderGameOver()
      return
    }

    // 9. 进入下一回合
    startTurn(this.state)
    sfx.sfxTurnStart()
    playRecruitBgm()
    this.ui.state = this.state
    this.ui.selection = null
    await delay(700)
    this.ui.renderRecruit()
  }

  private onRestart(): void {
    stopBgm()
    showMainMenu()
  }

  private onSurrender(): void {
    stopBgm()
    showMainMenu()
  }
}

// ============ 启动入口 ============

const appRoot = document.getElementById('app')!

function showMainMenu(): void {
  renderMainMenu(
    appRoot,
    () => showHeroSelect(),
    () => showCodex(),
    () => showRoomSelect(),
  )
}

function showHeroSelect(): void {
  renderHeroSelect(
    appRoot,
    (heroId) => {
      new GameController(heroId, appRoot)
    },
    () => showMainMenu(),
  )
}

function showCodex(): void {
  renderCodex(appRoot, () => showMainMenu())
}

function showRoomSelect(): void {
  appRoot.innerHTML = `
    <div class="room-select-overlay">
      <div class="room-lobby-card">
        <div class="room-lobby-back" id="room-select-back">← 返回</div>
        <div class="room-lobby-title">多人对战</div>
        <div class="room-select-cards">
          <div class="main-menu-card" data-action="create">
            <div class="menu-card-icon">🏠</div>
            <div class="menu-card-title">创建房间</div>
            <div class="menu-card-desc">邀请好友加入你的房间</div>
          </div>
          <div class="main-menu-card" data-action="join">
            <div class="menu-card-icon">🚪</div>
            <div class="menu-card-title">加入房间</div>
            <div class="menu-card-desc">输入房间号加入好友的对局</div>
          </div>
        </div>
      </div>
    </div>
  `
  appRoot.querySelector('#room-select-back')?.addEventListener('click', showMainMenu)
  appRoot
    .querySelector('[data-action="create"]')
    ?.addEventListener('click', () => showRoomLobby('create'))
  appRoot
    .querySelector('[data-action="join"]')
    ?.addEventListener('click', () => showRoomLobby('join'))
}

function showRoomLobby(mode: 'create' | 'join'): void {
  let pickedHero = false

  renderRoomLobby(appRoot, mode, {
    onConnected: () => {},
    onEnemyJoined: () => {
      // 对手加入，显示英雄选择
      showMultiplayerHeroSelect()
    },
    onEnemyPicked: (_heroId) => {
      // 对手选了英雄，如果自己还没选，提示选择
    },
    onCountdown: () => {},
    onCombatStart: (_boards) => {
      // 进入战斗
      const client = getMultiplayerClient(appRoot)
      if (client && !pickedHero) {
        // 如果还没选英雄，用随机英雄
        const randomHero = HEROES[Math.floor(Math.random() * HEROES.length)]
        pickedHero = true
        client.pickHero(randomHero.id)
        // 等待服务器发 combat_start
      }
    },
    onNextTurn: () => {},
    onOpponentLeft: () => {
      setTimeout(() => showMainMenu(), 1500)
    },
    onError: () => {},
    onBack: () => showMainMenu(),
  })
}

function showMultiplayerHeroSelect(): void {
  renderHeroSelect(
    appRoot,
    (heroId) => {
      const client = getMultiplayerClient(appRoot)
      if (client) {
        client.pickHero(heroId)
        // 显示等待界面
        appRoot.innerHTML = `
          <div class="room-lobby-overlay">
            <div class="room-lobby-card">
              <div class="room-lobby-title">已选择英雄</div>
              <div class="room-lobby-status">等待对手选择英雄...</div>
              <div class="room-waiting">
                <div class="room-waiting-spinner"></div>
              </div>
            </div>
          </div>
        `
      }
    },
    () => {
      // 返回主菜单，断开连接
      const client = getMultiplayerClient(appRoot)
      if (client) client.disconnect()
      showMainMenu()
    },
  )
}

// 启动：显示主菜单
showMainMenu()
