/**
 * 音效（Web Audio 合成，不加载任何音频文件）
 * ---------------------------------------------------------------
 * 只有两个声音是必须的：剪刀「咔嚓」，纸「沙沙」。
 * 默认静音 —— 用户主动打开才算数（浏览器也要求先有交互）。
 */

let ctx: AudioContext | null = null;
let enabled = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

function noise(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function isAudioEnabled(): boolean {
  return enabled;
}

export async function setAudioEnabled(value: boolean): Promise<void> {
  enabled = value;
  const c = ac();
  if (!c) return;
  if (value && c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      /* 用户没交互就静默失败 */
    }
  }
}

/** 剪刀合拢：两段极短的金属噪声 */
export function snap(strength = 1): void {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise(c, 0.09);

  const hp = c.createBiquadFilter();
  hp.type = "bandpass";
  hp.frequency.value = 3600;
  hp.Q.value = 1.1;

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3 * strength, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);

  src.connect(hp).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + 0.1);

  // 第二下：刀口相碰的低频「嗒」
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1850, t + 0.012);
  osc.frequency.exponentialRampToValueAtTime(520, t + 0.07);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t + 0.012);
  og.gain.exponentialRampToValueAtTime(0.09 * strength, t + 0.018);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
  osc.connect(og).connect(c.destination);
  osc.start(t + 0.012);
  osc.stop(t + 0.1);
}

/** 纸张沙沙 / 撕开 */
export function rustle(ms = 420, strength = 1): void {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const dur = ms / 1000;

  const src = c.createBufferSource();
  src.buffer = noise(c, dur + 0.05);
  src.loop = false;

  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(1400, t);
  bp.frequency.linearRampToValueAtTime(3000, t + dur * 0.45);
  bp.frequency.linearRampToValueAtTime(1100, t + dur);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.11 * strength, t + dur * 0.18);
  g.gain.linearRampToValueAtTime(0.05 * strength, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(bp).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** 展开：一声干净的五度轻响 */
export function chime(strength = 1): void {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  [784, 1174.7].forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = c.createGain();
    const peak = (i === 0 ? 0.075 : 0.045) * strength;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 1);
  });
}

/** 揭开新的一层 / 页面转场 */
export function whoosh(strength = 1): void {
  if (!enabled) return;
  rustle(300, 0.7 * strength);
  snap(0.5 * strength);
}
