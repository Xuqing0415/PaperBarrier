/**
 * 纸屑粒子（Canvas）
 * ---------------------------------------------------------------
 * 关键不是「多」，是**每一片形状都不一样** —— 真实的碎屑没有两片相同。
 * 所以预置几组不规则四边形/三角形，随机取用，再配上轻微的空气摆动与旋转。
 */

const SHARD_PATHS = [
  "M0 0L9 2L7 8L-1 6Z",
  "M0 0L11 1L8 5L2 7Z",
  "M0 0L6 3L9 9L-2 7Z",
  "M0 0L12 3L5 9Z",
  "M0 0L7 1L10 6L3 8L-1 4Z",
  "M0 0L5 4L8 10L-3 8L-2 3Z",
  "M0 0L8 0L9 7L1 9Z",
];

export interface ShardFieldOptions {
  /** 同时存在的粒子数上限 */
  capacity?: number;
  /** 颜色池 */
  colors?: string[];
  /** 整体速度与尺寸系数，移动端调到 0.6 左右即可减半负担 */
  scale?: number;
  /** 重力（像素 / 帧²） */
  gravity?: number;
}

interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  alpha: number;
  life: number;
  ttl: number;
  path: Path2D;
  color: string;
  sway: number;
  swayFreq: number;
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export class ShardField {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly opts: Required<ShardFieldOptions>;
  private readonly paths: Path2D[];
  private shards: Shard[] = [];
  private w = 0;
  private h = 0;
  private raf = 0;
  private last = 0;

  constructor(canvas: HTMLCanvasElement, opts: ShardFieldOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = {
      capacity: opts.capacity ?? 140,
      colors: opts.colors ?? ["#c8102e", "#e34234", "#8e0b20", "#d8cab0"],
      scale: opts.scale ?? 1,
      gravity: opts.gravity ?? 0.055,
    };
    this.paths = SHARD_PATHS.map((d) => new Path2D(d));
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }

  private make(x: number, y: number, fromEdge = false): Shard {
    const s = this.opts.scale;
    const ttl = rand(1500, 4200);
    return {
      x,
      y: fromEdge ? y : y,
      vx: fromEdge ? rand(-0.5, 0.5) : rand(-2.6, 2.6) * s,
      vy: fromEdge ? rand(0.25, 0.7) * s : rand(-3.4, -0.4) * s,
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.09, 0.09),
      size: rand(0.55, 1.5) * s,
      alpha: 1,
      life: 0,
      ttl,
      path: this.paths[(Math.random() * this.paths.length) | 0]!,
      color: this.opts.colors[(Math.random() * this.opts.colors.length) | 0]!,
      sway: rand(0, Math.PI * 2),
      swayFreq: rand(0.0016, 0.005) * (Math.random() < 0.5 ? -1 : 1),
    };
  }

  /** 在某个点迸发（剪刀剪到哪，碎屑就从哪掉） */
  burst(x: number, y: number, count = 8): void {
    const room = this.opts.capacity - this.shards.length;
    const n = Math.max(0, Math.min(count, room));
    for (let i = 0; i < n; i += 1) this.shards.push(this.make(x, y, false));
    this.clamp();
    this.start();
  }

  /** 从顶部飘落（收尾用，营造余韵） */
  drizzle(count = 24): void {
    const room = this.opts.capacity - this.shards.length;
    const n = Math.max(0, Math.min(count, room));
    for (let i = 0; i < n; i += 1) {
      const s = this.make(rand(0, this.w), rand(-40, 0), true);
      s.vy = rand(0.3, 1.1) * this.opts.scale;
      this.shards.push(s);
    }
    this.start();
  }

  clear(): void {
    this.shards = [];
    this.stop();
    this.draw();
  }

  private clamp(): void {
    const over = this.shards.length - this.opts.capacity;
    if (over > 0) this.shards.splice(0, over);
  }

  private step(dt: number): void {
    const k = Math.min(dt / 16.667, 2.5);
    for (let i = this.shards.length - 1; i >= 0; i -= 1) {
      const s = this.shards[i]!;
      s.life += dt;
      s.vy += this.opts.gravity * k;
      s.vy *= 0.996; // 空气阻尼
      s.sway += s.swayFreq * dt;
      s.x += (s.vx + Math.sin(s.sway) * 0.55) * k;
      s.y += s.vy * k;
      s.rot += s.vr * k;

      const fadeStart = s.ttl * 0.62;
      s.alpha = s.life > fadeStart ? Math.max(0, 1 - (s.life - fadeStart) / (s.ttl - fadeStart)) : 1;

      if (s.y > this.h + 40 || s.life > s.ttl) this.shards.splice(i, 1);
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);
    for (const s of this.shards) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.scale(s.size, s.size);
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.fill(s.path);
      ctx.restore();
    }
  }

  private tick = (now: number): void => {
    const dt = this.last ? now - this.last : 16.7;
    this.last = now;
    this.step(dt);
    this.draw();
    if (this.shards.length > 0) {
      this.raf = requestAnimationFrame(this.tick);
    } else {
      this.raf = 0;
      this.last = 0;
      this.draw();
    }
  };

  start(): void {
    if (this.raf) return;
    this.last = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = 0;
  }

  destroy(): void {
    this.stop();
    this.shards = [];
  }
}

export const SHARD_PATH_COUNT = SHARD_PATHS.length;
