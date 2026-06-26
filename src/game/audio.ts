// 音效系统 - 使用 Web Audio API 合成音效（无需外部音频文件）
// 国风音效：清脆、悠扬，配合水墨主题
// 五声音阶：宫商角徵羽 (C D E G A) 用于旋律

let ctx: AudioContext | null = null
let bgmGain: GainNode | null = null
let sfxGain: GainNode | null = null
let muted = false
let bgmPlaying: string | null = null
let bgmOscillators: OscillatorNode[] = []
let bgmIntervals: ReturnType<typeof setInterval>[] = []

/** 五声音阶频率（C4 起，宫商角徵羽） */
const PENTA = {
  c3: 130.81,
  d3: 146.83,
  e3: 164.81,
  g3: 196.0,
  a3: 220.0,
  c4: 261.63,
  d4: 293.66,
  e4: 329.63,
  g4: 392.0,
  a4: 440.0,
  c5: 523.25,
  d5: 587.33,
  e5: 659.25,
  g5: 783.99,
  a5: 880.0,
  c6: 1046.5,
}

/** 初始化 AudioContext（必须在用户交互后调用） */
function ensureCtx(): AudioContext | null {
  if (muted) return null
  if (!ctx) {
    try {
      const AC =
        window.AudioContext ??
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      const audioCtx = new AC()
      // 音效音量
      const sfx = audioCtx.createGain()
      sfx.gain.value = 0.5
      sfx.connect(audioCtx.destination)
      sfxGain = sfx
      // BGM 音量
      const bgm = audioCtx.createGain()
      bgm.gain.value = 0.12
      bgm.connect(audioCtx.destination)
      bgmGain = bgm
      ctx = audioCtx
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

/** 切换静音 */
export function toggleMute(): boolean {
  muted = !muted
  if (muted) stopBgm()
  return muted
}

/** 获取静音状态 */
export function isMuted(): boolean {
  return muted
}

// ============ 合成原语 ============

/** 播放一个简单的振荡器音 */
function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  vol = 0.5,
  delay = 0,
  freqEnd?: number,
  dest?: GainNode,
): void {
  const c = ensureCtx()
  if (!c || !sfxGain) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration)
  }
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + 0.005)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.connect(g)
  g.connect(dest ?? sfxGain)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

/** 播放噪声（用于打击、风声等） */
function noise(duration: number, vol = 0.3, delay = 0, filterFreq = 1000, dest?: GainNode): void {
  const c = ensureCtx()
  if (!c || !sfxGain) return
  const t0 = c.currentTime + delay
  const bufferSize = Math.floor(c.sampleRate * duration)
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  }
  const src = c.createBufferSource()
  src.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = filterFreq
  const g = c.createGain()
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  src.connect(filter)
  filter.connect(g)
  g.connect(dest ?? sfxGain)
  src.start(t0)
  src.stop(t0 + duration + 0.05)
}

/** 古琴拨弦音效（衰减快、有泛音） */
function pluck(freq: number, duration: number, vol = 0.4, delay = 0, dest?: GainNode): void {
  const c = ensureCtx()
  if (!c || !sfxGain) return
  const t0 = c.currentTime + delay
  const d = dest ?? sfxGain

  // 基音
  const osc1 = c.createOscillator()
  osc1.type = 'triangle'
  osc1.frequency.setValueAtTime(freq, t0)

  // 泛音（2倍频，音量更低）
  const osc2 = c.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(freq * 2, t0)

  const g1 = c.createGain()
  g1.gain.setValueAtTime(vol, t0)
  g1.gain.exponentialRampToValueAtTime(0.001, t0 + duration)

  const g2 = c.createGain()
  g2.gain.setValueAtTime(vol * 0.3, t0)
  g2.gain.exponentialRampToValueAtTime(0.001, t0 + duration * 0.6)

  osc1.connect(g1)
  g1.connect(d)
  osc2.connect(g2)
  g2.connect(d)
  osc1.start(t0)
  osc1.stop(t0 + duration + 0.05)
  osc2.start(t0)
  osc2.stop(t0 + duration + 0.05)
}

/** 竹笛音效（正弦 + 轻微颤音） */
function flute(freq: number, duration: number, vol = 0.3, delay = 0, dest?: GainNode): void {
  const c = ensureCtx()
  if (!c || !sfxGain) return
  const t0 = c.currentTime + delay
  const d = dest ?? sfxGain

  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  // 轻微颤音
  const lfo = c.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(5, t0) // 5Hz 颤音
  const lfoGain = c.createGain()
  lfoGain.gain.setValueAtTime(freq * 0.015, t0) // 微小的频率偏移
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)

  const g = c.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + 0.05)
  g.gain.setValueAtTime(vol, t0 + duration - 0.1)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)

  osc.connect(g)
  g.connect(d)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
  lfo.start(t0)
  lfo.stop(t0 + duration + 0.05)
}

// ============ 原有音效（保留 + 微调） ============

/** 购买随从：清脆"叮"声 */
export function sfxBuy(): void {
  pluck(PENTA.c5, 0.15, 0.4)
  pluck(PENTA.e5, 0.12, 0.25, 0.03)
}

/** 卖出随从：干脆"咚" */
export function sfxSell(): void {
  tone(350, 0.12, 'triangle', 0.45, 0, 150)
  tone(600, 0.06, 'sine', 0.2, 0)
  noise(0.06, 0.15, 0, 1500)
}

/** 刷新酒馆：旋转"唰" */
export function sfxRefresh(): void {
  noise(0.2, 0.2, 0, 2500)
  pluck(PENTA.g4, 0.15, 0.2, 0.05)
  pluck(PENTA.a4, 0.12, 0.15, 0.1)
}

/** 冻结酒馆：冰晶"叮" */
export function sfxFreeze(): void {
  tone(PENTA.c6, 0.3, 'sine', 0.3)
  tone(PENTA.e5, 0.25, 'sine', 0.2, 0.05)
  noise(0.15, 0.08, 0, 3000)
}

/** 升级酒馆：上升音阶 + 编钟 */
export function sfxUpgrade(): void {
  pluck(PENTA.c4, 0.15, 0.4)
  pluck(PENTA.e4, 0.15, 0.4, 0.1)
  pluck(PENTA.g4, 0.15, 0.45, 0.2)
  pluck(PENTA.c5, 0.3, 0.5, 0.3)
  // 编钟泛音
  tone(PENTA.c5 * 2, 0.5, 'sine', 0.15, 0.3)
}

/** 三连达成：华丽五声音阶上行 + 琶音 */
export function sfxTriple(): void {
  pluck(PENTA.c4, 0.1, 0.35)
  pluck(PENTA.e4, 0.1, 0.35, 0.07)
  pluck(PENTA.g4, 0.1, 0.35, 0.14)
  pluck(PENTA.c5, 0.15, 0.4, 0.21)
  pluck(PENTA.e5, 0.2, 0.35, 0.28)
  // 余韵泛音
  tone(PENTA.c5 * 2, 0.6, 'sine', 0.1, 0.35)
  tone(PENTA.c5 * 3, 0.4, 'sine', 0.05, 0.4)
}

/** 战斗开始：战鼓"咚咚咚"（明亮） */
export function sfxCombatStart(): void {
  tone(150, 0.15, 'triangle', 0.5, 0, 80)
  tone(400, 0.08, 'sine', 0.2, 0)
  tone(150, 0.15, 'triangle', 0.5, 0.2, 80)
  tone(400, 0.08, 'sine', 0.2, 0.2)
  tone(120, 0.3, 'triangle', 0.6, 0.4, 60)
  tone(350, 0.1, 'sine', 0.25, 0.4)
  noise(0.1, 0.25, 0, 1500)
  noise(0.1, 0.25, 0.2, 1500)
  noise(0.15, 0.3, 0.4, 1200)
}

/** 攻击出击：明亮挥击"嗖" */
export function sfxAttack(): void {
  noise(0.1, 0.3, 0, 3000)
  tone(PENTA.a4, 0.08, 'triangle', 0.2, 0, PENTA.e4)
  tone(PENTA.e5, 0.05, 'sine', 0.12, 0.02)
}

/** 命中：清脆撞击"啪" */
export function sfxHit(): void {
  tone(250, 0.08, 'triangle', 0.35, 0, 120)
  tone(600, 0.04, 'sine', 0.2, 0)
  noise(0.06, 0.3, 0, 2000)
}

/** 圣盾破碎：金属"铛"（编钟风） */
export function sfxShield(): void {
  tone(PENTA.a5, 0.25, 'sine', 0.35)
  tone(PENTA.e5 * 2, 0.2, 'sine', 0.2, 0.02)
  tone(PENTA.a5 * 2, 0.15, 'sine', 0.12, 0.04)
  noise(0.08, 0.1, 0, 4000)
}

/** 随从死亡：消散"嘶" */
export function sfxDeath(): void {
  tone(300, 0.2, 'triangle', 0.3, 0, 80)
  noise(0.2, 0.2, 0, 1500)
  tone(150, 0.15, 'sine', 0.15, 0.05, 60)
}

/** 复生：神秘"叮咚"（古琴风） */
export function sfxReborn(): void {
  pluck(PENTA.e4, 0.15, 0.35)
  pluck(PENTA.a4, 0.2, 0.35, 0.1)
  pluck(PENTA.e5, 0.3, 0.3, 0.2)
  // 仙气回响
  tone(PENTA.e5, 0.6, 'sine', 0.08, 0.3)
}

/** 召唤：浮现"呼" */
export function sfxSummon(): void {
  noise(0.15, 0.18, 0, 1500)
  pluck(PENTA.g4, 0.18, 0.25, 0.02)
}

/** 英雄受伤：震撼"轰"（明亮） */
export function sfxHeroDamage(): void {
  tone(150, 0.3, 'triangle', 0.5, 0, 60)
  tone(400, 0.1, 'sine', 0.25, 0)
  noise(0.2, 0.3, 0, 1200)
  tone(80, 0.4, 'sine', 0.25, 0.1, 40)
}

/** 胜利：凯旋五声大三和弦 + 竹笛 */
export function sfxVictory(): void {
  const d = bgmGain ?? sfxGain
  flute(PENTA.c4, 0.2, 0.3, 0, d!)
  flute(PENTA.e4, 0.2, 0.3, 0.15, d!)
  flute(PENTA.g4, 0.2, 0.35, 0.3, d!)
  flute(PENTA.c5, 0.5, 0.4, 0.45, d!)
  // 和弦铺底
  tone(PENTA.c4, 0.8, 'sine', 0.12, 0.45)
  tone(PENTA.e4, 0.8, 'sine', 0.1, 0.45)
  tone(PENTA.g4, 0.8, 'sine', 0.1, 0.45)
}

/** 失败：低沉下降 + 古琴叹息 */
export function sfxDefeat(): void {
  pluck(PENTA.a4, 0.3, 0.3, 0, sfxGain!)
  pluck(PENTA.e4, 0.35, 0.25, 0.2, sfxGain!)
  pluck(PENTA.c4, 0.5, 0.2, 0.4, sfxGain!)
  tone(PENTA.c3, 0.6, 'sine', 0.15, 0.6, PENTA.c3 * 0.5)
}

/** 选中卡牌：轻"嗒" */
export function sfxSelect(): void {
  pluck(PENTA.a4, 0.06, 0.25)
}

// ============ 新增音效 ============

/** 羁绊激活：编钟齐鸣 + 五声琶音 */
export function sfxSynergy(): void {
  tone(PENTA.c5, 0.3, 'sine', 0.25)
  tone(PENTA.e5, 0.3, 'sine', 0.2, 0.05)
  tone(PENTA.g5, 0.25, 'sine', 0.15, 0.1)
  // 编钟泛音
  tone(PENTA.c5 * 2, 0.4, 'sine', 0.08, 0.1)
  tone(PENTA.c5 * 3, 0.3, 'sine', 0.04, 0.15)
}

/** 回合开始：清脆竹笛短句 */
export function sfxTurnStart(): void {
  flute(PENTA.g4, 0.12, 0.25)
  flute(PENTA.a4, 0.1, 0.2, 0.08)
  flute(PENTA.c5, 0.15, 0.25, 0.16)
}

/** 金币入袋：清脆金属碰撞"叮当" */
export function sfxGoldCoin(): void {
  tone(PENTA.e5, 0.06, 'sine', 0.4)
  tone(PENTA.a5, 0.05, 'sine', 0.35, 0.02)
  tone(PENTA.c6, 0.04, 'sine', 0.25, 0.04)
  noise(0.03, 0.15, 0, 8000)
}

/** 三连奖励揭示：神秘渐强 */
export function sfxTripleReveal(): void {
  flute(PENTA.c4, 0.3, 0.15)
  flute(PENTA.e4, 0.3, 0.2, 0.15)
  flute(PENTA.g4, 0.3, 0.25, 0.3)
  flute(PENTA.c5, 0.5, 0.35, 0.45)
  // 和弦渐入
  tone(PENTA.c4, 1.0, 'sine', 0.08, 0.45)
  tone(PENTA.g4, 1.0, 'sine', 0.06, 0.5)
}

/** 拖拽卡牌：轻微摩擦声 */
export function sfxDrag(): void {
  noise(0.06, 0.08, 0, 2000)
}

/** 放置卡牌：落桌"啪" */
export function sfxDrop(): void {
  tone(200, 0.08, 'sine', 0.3, 0, 100)
  noise(0.05, 0.12, 0, 800)
}

/** 羁绊升级（达到新阈值）：编钟 + 上行琶音 */
export function sfxSynergyLevelUp(): void {
  pluck(PENTA.c4, 0.12, 0.3)
  pluck(PENTA.e4, 0.12, 0.3, 0.08)
  pluck(PENTA.g4, 0.12, 0.35, 0.16)
  pluck(PENTA.c5, 0.12, 0.4, 0.24)
  pluck(PENTA.e5, 0.2, 0.35, 0.32)
  // 编钟余韵
  tone(PENTA.c5 * 2, 0.8, 'sine', 0.1, 0.4)
  tone(PENTA.c5 * 3, 0.6, 'sine', 0.05, 0.45)
}

/** 英雄技能触发：仙气缭绕 */
export function sfxHeroPower(): void {
  flute(PENTA.e4, 0.2, 0.2)
  flute(PENTA.g4, 0.2, 0.25, 0.1)
  flute(PENTA.a4, 0.3, 0.3, 0.2)
  tone(PENTA.a4, 0.5, 'sine', 0.08, 0.3)
}

/** 游戏结束（平局）：沉稳鼓声 */
export function sfxDraw(): void {
  tone(80, 0.3, 'sine', 0.4, 0, 60)
  tone(80, 0.3, 'sine', 0.4, 0.3, 60)
  tone(60, 0.5, 'sine', 0.3, 0.6, 40)
}

// ============ 背景音乐（BGM） ============

/** 停止当前 BGM */
export function stopBgm(): void {
  for (const osc of bgmOscillators) {
    try {
      osc.stop()
    } catch {
      /* already stopped */
    }
  }
  bgmOscillators = []
  for (const iv of bgmIntervals) {
    clearInterval(iv)
  }
  bgmIntervals = []
  bgmPlaying = null
}

/** 播放一个 BGM 音符 */
function bgmNote(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  vol = 0.3,
  delay = 0,
): void {
  const c = ensureCtx()
  if (!c || !bgmGain) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + 0.02)
  g.gain.setValueAtTime(vol, t0 + duration - 0.05)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.connect(g)
  g.connect(bgmGain)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
  bgmOscillators.push(osc)
}

/** 招募阶段 BGM：悠扬五声旋律循环（古琴 + 竹笛风） */
export function playRecruitBgm(): void {
  if (bgmPlaying === 'recruit') return
  stopBgm()
  bgmPlaying = 'recruit'
  const c = ensureCtx()
  if (!c) return

  // 主旋律（竹笛风，五声小调）
  const melody = [
    PENTA.a4,
    PENTA.c5,
    PENTA.e5,
    PENTA.g5,
    PENTA.e5,
    PENTA.c5,
    PENTA.a4,
    PENTA.g4,
    PENTA.a4,
    PENTA.e5,
    PENTA.c5,
    PENTA.a4,
    PENTA.g4,
    PENTA.a4,
    PENTA.c5,
    PENTA.e5,
  ]
  // 伴奏和弦（古琴拨弦）
  const chords = [
    [PENTA.a3, PENTA.e4],
    [PENTA.c4, PENTA.g4],
    [PENTA.e4, PENTA.a4],
    [PENTA.g3, PENTA.d4],
  ]

  let beat = 0
  const bpm = 90
  const beatMs = (60 / bpm) * 1000

  const iv = setInterval(() => {
    if (bgmPlaying !== 'recruit') return
    const note = melody[beat % melody.length]
    // 竹笛旋律
    bgmNote(note, (beatMs / 1000) * 0.8, 'sine', 0.2)
    // 每 4 拨一个和弦
    if (beat % 4 === 0) {
      const chord = chords[Math.floor(beat / 4) % chords.length]
      for (const f of chord) {
        bgmNote(f, (beatMs / 1000) * 3.5, 'triangle', 0.08)
      }
    }
    beat++
  }, beatMs)

  bgmIntervals.push(iv)
}

/** 战斗阶段 BGM：紧张节奏循环 */
export function playCombatBgm(): void {
  if (bgmPlaying === 'combat') return
  stopBgm()
  bgmPlaying = 'combat'
  const c = ensureCtx()
  if (!c) return

  const bpm = 140
  const beatMs = (60 / bpm) * 1000

  // 紧张的五声旋律
  const melody = [
    PENTA.e4,
    PENTA.g4,
    PENTA.a4,
    PENTA.c5,
    PENTA.a4,
    PENTA.g4,
    PENTA.e4,
    PENTA.c4,
    PENTA.e4,
    PENTA.a4,
    PENTA.g4,
    PENTA.e4,
    PENTA.c4,
    PENTA.e4,
    PENTA.g4,
    PENTA.a4,
  ]

  let beat = 0
  const iv = setInterval(() => {
    if (bgmPlaying !== 'combat') return
    // 旋律（明亮）
    const note = melody[beat % melody.length]
    bgmNote(note, (beatMs / 1000) * 0.5, 'triangle', 0.18)
    // 鼓点（每拍，明亮短促）
    if (beat % 2 === 0) {
      bgmNote(PENTA.c3, 0.1, 'triangle', 0.2)
      bgmNote(PENTA.c3 * 3, 0.05, 'sine', 0.08)
    }
    // 高音点缀（每 4 拍）
    if (beat % 8 === 0) {
      bgmNote(PENTA.e5, 0.08, 'sine', 0.12)
    }
    beat++
  }, beatMs)

  bgmIntervals.push(iv)
}
