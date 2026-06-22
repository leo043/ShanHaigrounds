// 音效系统 - 使用 Web Audio API 合成音效（无需外部音频文件）
// 国风音效：清脆、悠扬，配合水墨主题

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let muted = false

/** 初始化 AudioContext（必须在用户交互后调用） */
function ensureCtx(): AudioContext | null {
  if (muted) return null
  if (!ctx) {
    try {
      // 兼容老版 Safari 的 webkit 前缀，用局部断言避免 any
      const AC =
        window.AudioContext ??
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      // 用局部变量避免 TS 对模块级可变 ctx 的空值收窄丢失
      const audioCtx = new AC()
      const gain = audioCtx.createGain()
      gain.gain.value = 0.35
      gain.connect(audioCtx.destination)
      ctx = audioCtx
      masterGain = gain
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
  return muted
}

/** 获取静音状态 */
export function isMuted(): boolean {
  return muted
}

/** 播放一个简单的振荡器音 */
function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  vol = 0.5,
  delay = 0,
  freqEnd?: number,
): void {
  const c = ensureCtx()
  if (!c || !masterGain) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration)
  }
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.connect(g)
  g.connect(masterGain)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

/** 播放噪声（用于打击、风声等） */
function noise(duration: number, vol = 0.3, delay = 0, filterFreq = 1000): void {
  const c = ensureCtx()
  if (!c || !masterGain) return
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
  g.connect(masterGain)
  src.start(t0)
  src.stop(t0 + duration + 0.05)
}

// ============ 各场景音效 ============

/** 购买随从：清脆"叮"声 */
export function sfxBuy(): void {
  tone(880, 0.12, 'sine', 0.5)
  tone(1320, 0.15, 'sine', 0.3, 0.02)
}

/** 卖出随从：低沉"咚" */
export function sfxSell(): void {
  tone(220, 0.18, 'sine', 0.5, 0, 110)
}

/** 刷新酒馆：旋转"唰" */
export function sfxRefresh(): void {
  noise(0.25, 0.2, 0, 2000)
  tone(440, 0.2, 'triangle', 0.2, 0, 660)
}

/** 冻结酒馆：冰晶"叮" */
export function sfxFreeze(): void {
  tone(1568, 0.3, 'sine', 0.4)
  tone(2093, 0.25, 'sine', 0.2, 0.05)
}

/** 升级酒馆：上升音阶 */
export function sfxUpgrade(): void {
  tone(523, 0.12, 'triangle', 0.4)
  tone(659, 0.12, 'triangle', 0.4, 0.1)
  tone(784, 0.2, 'triangle', 0.5, 0.2)
}

/** 三连达成：华丽上升音阶 */
export function sfxTriple(): void {
  tone(523, 0.1, 'sine', 0.4)
  tone(659, 0.1, 'sine', 0.4, 0.08)
  tone(784, 0.1, 'sine', 0.4, 0.16)
  tone(1047, 0.3, 'sine', 0.5, 0.24)
  tone(1319, 0.3, 'sine', 0.3, 0.24)
}

/** 战斗开始：战鼓"咚咚" */
export function sfxCombatStart(): void {
  tone(100, 0.15, 'sine', 0.6, 0, 80)
  tone(100, 0.15, 'sine', 0.6, 0.2, 80)
  tone(80, 0.3, 'sine', 0.7, 0.4, 60)
}

/** 攻击出击：挥击"嗖" */
export function sfxAttack(): void {
  noise(0.15, 0.25, 0, 800)
  tone(330, 0.12, 'sawtooth', 0.2, 0, 220)
}

/** 命中：闷响"砰" */
export function sfxHit(): void {
  tone(120, 0.15, 'square', 0.4, 0, 60)
  noise(0.1, 0.3, 0, 500)
}

/** 圣盾破碎：金属"铛" */
export function sfxShield(): void {
  tone(1568, 0.2, 'sine', 0.4)
  tone(2349, 0.15, 'sine', 0.3, 0.02)
  tone(3136, 0.1, 'sine', 0.2, 0.04)
}

/** 随从死亡：衰减"嗡" */
export function sfxDeath(): void {
  tone(200, 0.4, 'sawtooth', 0.35, 0, 50)
  noise(0.2, 0.15, 0, 400)
}

/** 复生：神秘"叮咚" */
export function sfxReborn(): void {
  tone(659, 0.12, 'sine', 0.4)
  tone(880, 0.2, 'sine', 0.4, 0.08)
  tone(1047, 0.25, 'sine', 0.3, 0.16)
}

/** 召唤：浮现"呼" */
export function sfxSummon(): void {
  noise(0.2, 0.2, 0, 1200)
  tone(440, 0.2, 'triangle', 0.3, 0, 660)
}

/** 英雄受伤：低沉"轰" */
export function sfxHeroDamage(): void {
  tone(80, 0.5, 'sawtooth', 0.5, 0, 40)
  noise(0.3, 0.25, 0, 300)
}

/** 胜利：凯旋上升大三和弦 */
export function sfxVictory(): void {
  tone(523, 0.15, 'triangle', 0.4)
  tone(659, 0.15, 'triangle', 0.4, 0.12)
  tone(784, 0.15, 'triangle', 0.4, 0.24)
  tone(1047, 0.4, 'triangle', 0.5, 0.36)
}

/** 失败：低沉下降 */
export function sfxDefeat(): void {
  tone(440, 0.3, 'sawtooth', 0.4, 0, 220)
  tone(330, 0.4, 'sawtooth', 0.4, 0.2, 165)
  tone(220, 0.6, 'sawtooth', 0.5, 0.4, 110)
}

/** 选中卡牌：轻"嗒" */
export function sfxSelect(): void {
  tone(660, 0.06, 'sine', 0.3)
}
