/**
 * 剪纸纹样生成器
 * ---------------------------------------------------------------
 * 「团花」的本质是折出来的：一张纸对折 k 次，剪几刀，展开就是 k 重旋转对称。
 * 所以这里不硬编码图形，而是把形状定义在「一折之内」（局部坐标，径向为 +x），
 * 再按 k 份旋转复制出去。这是数学上的 D_k 对称群，也是真实剪纸的生成方式。
 *
 * 两条克制的美学原则（也顺便把体积压到 1/4）：
 *   1. 纸的花边是曲线 —— 每个花瓣用两段三次贝塞尔表示，而不是采样成折线。
 *   2. 刀口是直线和弧 —— 内部镂空一律用多边形与圆弧，
 *      这既是剪纸的真实几何，也比平滑样条省得多。
 *
 * 纯函数 + 确定性随机：同一个 seed 永远得到同一张图。
 * 全部在构建期跑，产物是静态 SVG path，客户端零成本。
 */

export type Point = readonly [number, number];

/* ============================================================
   0. 小工具
   ============================================================ */

/** 确定性伪随机（mulberry32） */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 一位小数足够：半径 100 的图上，误差 0.1 = 千分之一，肉眼不可见 */
const N = (v: number): string => {
  const n = Math.round(v * 10) / 10;
  return String(n === 0 ? 0 : n);
};

/**
 * 拼 path。只有必要时才插空格：
 * 下一个 token 以 "-" 开头时可以省略分隔符（M-12.3-4.5）。
 */
function join(tokens: readonly string[]): string {
  let out = "";
  for (const t of tokens) {
    out = out === "" ? t : out + (t.charCodeAt(0) === 45 /* - */ ? t : " " + t);
  }
  return out;
}

const polar = (deg: number, radius: number): Point => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a) * radius, Math.sin(a) * radius];
};

const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k];

/**
 * 月牙弧的张角必须小于它的排列步距，否则相邻的弧会互相咬掉、还会啃到外缘。
 * 所以这里不写死角度，而是按「步距的几分之几」来定。
 */
const spanOf = (count: number, fraction: number): number => (360 / count) * fraction;

/** 绕圆心旋转（点集版本；圆形弧只需旋转端点，所以足够） */
const rot =
  (deg: number) =>
  ([x, y]: Point): Point => {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [x * c - y * s, x * s + y * c];
  };

/** 单位切向量（角度增大方向） */
const tangent = (deg: number): Point => {
  const a = (deg * Math.PI) / 180;
  return [-Math.sin(a), Math.cos(a)];
};

/** 单位径向量 */
const radial = (deg: number): Point => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a)];
};

function unit([x, y]: Point): Point {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/* ============================================================
   1. 纸片外轮廓 —— 一条闭合路径，由 folds 个花瓣首尾相接
   ============================================================ */

export type RimStyle = "smooth" | "scallop" | "spike";

/** point: 0 = 圆润（切线连续），1 = 尖利（刀尖一样的锐角） */
const RIM: Record<RimStyle, { v: number; point: number }> = {
  smooth: { v: 0.988, point: 0.06 },
  scallop: { v: 0.855, point: 0.34 },
  spike: { v: 0.62, point: 0.95 },
};

function platePath(folds: number, R: number, rim: RimStyle): string {
  const { v, point } = RIM[rim];
  const step = 360 / folds;
  const half = step / 2;
  const Rv = R * v;

  const start = polar(-half, Rv);
  const t: string[] = ["M", N(start[0]), N(start[1])];

  for (let i = 0; i < folds; i += 1) {
    const aValley0 = i * step - half;
    const aTip = i * step;
    const aValley1 = i * step + half;

    const v0 = polar(aValley0, Rv);
    const v1 = polar(aValley1, Rv);
    const tip = polar(aTip, R);

    const halfArc = (half * Math.PI) / 180;
    const l1 = 0.58 * halfArc * Rv;
    const l2 = Math.hypot(tip[0] - v0[0], tip[1] - v0[1]) * (0.44 - 0.24 * point);

    const tt = tangent(aTip);
    const rt = radial(aTip);

    // 进入 / 离开花尖的方向：point = 0 时都沿切向（圆润），= 1 时近乎反向（尖角）
    const eIn = unit([(1 - point) * tt[0] + point * rt[0], (1 - point) * tt[1] + point * rt[1]]);
    const eOut = unit([(1 - point) * tt[0] - point * rt[0], (1 - point) * tt[1] - point * rt[1]]);

    const t0 = tangent(aValley0);
    const t1 = tangent(aValley1);

    const c1 = add(v0, scale(t0, l1));
    const c2 = add(tip, scale(eIn, -l2));
    const c3 = add(tip, scale(eOut, l2));
    const c4 = add(v1, scale(t1, -l1));

    t.push(
      "C",
      N(c1[0]), N(c1[1]),
      N(c2[0]), N(c2[1]),
      N(tip[0]), N(tip[1]),
      "C",
      N(c3[0]), N(c3[1]),
      N(c4[0]), N(c4[1]),
      N(v1[0]), N(v1[1])
    );
  }

  t.push("Z");
  return join(t);
}

/* ============================================================
   2. 刀口形状 —— 一折之内（径向 = +x）
   ============================================================ */

type Local = readonly Point[];

/** 柳叶形花瓣：两端收尖 */
function leaf(rc: number, len: number, wid: number): Local {
  return [
    [rc + len / 2, 0],
    [rc + len * 0.12, wid * 0.85],
    [rc - len * 0.3, wid * 0.5],
    [rc - len / 2, 0],
    [rc - len * 0.3, -wid * 0.5],
    [rc + len * 0.12, -wid * 0.85],
  ];
}

/** 细长切口：剪刀一划到底 */
function slit(rIn: number, rOut: number, w: number): Local {
  return [
    [rOut, w * 0.2],
    [rIn + w, w],
    [rIn, 0],
    [rIn + w, -w],
    [rOut, -w * 0.2],
  ];
}

/** 三角形缺口（锯齿纹的基本单位） */
function wedge(rMid: number, height: number, halfW: number): Local {
  return [
    [rMid + height / 2, 0],
    [rMid - height / 2, halfW],
    [rMid - height / 2, -halfW],
  ];
}

/** 方孔（回纹 / 窗格感） */
function square(rc: number, size: number): Local {
  const h = size / 2;
  return [
    [rc - h, -h],
    [rc + h, -h],
    [rc + h, h],
    [rc - h, h],
  ];
}

/* ============================================================
   3. 把一折复制成 k 折
   ============================================================ */

/** 多边形：旋转每个顶点即可 */
function emitPoly(
  out: string[],
  count: number,
  offset: number,
  pts: Local,
  jitter = 1
): void {
  for (let i = 0; i < count; i += 1) {
    const tx = rot(offset + (360 / count) * i);
    const tokens: string[] = [];
    for (let k = 0; k < pts.length; k += 1) {
      const p = scale(tx(pts[k]!), jitter);
      tokens.push(k === 0 ? "M" : "L", N(p[0]), N(p[1]));
    }
    tokens.push("Z");
    out.push(join(tokens));
  }
}

/**
 * 圆孔：整圆旋转后还是同一个圆，所以只要旋转圆心，
 * 半径与 sweep 标志都不变 —— 一条 A 命令就够，极其省。
 */
function emitDots(
  out: string[],
  count: number,
  offset: number,
  rc: number,
  r: number
): void {
  for (let i = 0; i < count; i += 1) {
    const c = polar(offset + (360 / count) * i, rc);
    const left = N(c[0] - r);
    const right = N(c[0] + r);
    const cy = N(c[1]);
    const rr = N(r);
    out.push(
      join([
        "M", left, cy,
        "A", rr, rr, "0", "1", "0", right, cy,
        "A", rr, rr, "0", "1", "0", left, cy,
        "Z",
      ])
    );
  }
}

/**
 * 云纹 / 水波：一圈同心弧。
 * 注意弧的圆心必须是花心（radius 就是它到花心的距离），
 * 否则弧会变成一根近似径向的短棍，而不是贴着圈走的月牙。
 */
function emitArcRing(
  out: string[],
  count: number,
  offset: number,
  radius: number,
  thick: number,
  spanFrac: number
): void {
  const span = spanOf(count, spanFrac);
  const rOut = radius + thick / 2;
  const rIn = radius - thick / 2;
  for (let i = 0; i < count; i += 1) {
    const mid = offset + (360 / count) * i;
    const p0 = polar(mid - span / 2, rOut);
    const p1 = polar(mid + span / 2, rOut);
    const p2 = polar(mid + span / 2, rIn);
    const p3 = polar(mid - span / 2, rIn);
    const ro = N(rOut);
    const ri = N(rIn);
    out.push(
      join([
        "M", N(p0[0]), N(p0[1]),
        "A", ro, ro, "0", "0", "1", N(p1[0]), N(p1[1]),
        "L", N(p2[0]), N(p2[1]),
        "A", ri, ri, "0", "0", "0", N(p3[0]), N(p3[1]),
        "Z",
      ])
    );
  }
}

/** 居中的单孔 */
function centerDot(r: number): string {
  return join([
    "M", N(-r), "0",
    "A", N(r), N(r), "0", "1", "0", N(r), "0",
    "A", N(r), N(r), "0", "1", "0", N(-r), "0",
    "Z",
  ]);
}

/* ============================================================
   4. 五种刀法
   ============================================================ */

export type CutStyle = "rosette" | "bloom" | "wave" | "grid" | "scroll";

function interior(
  folds: number,
  R: number,
  style: CutStyle,
  d: number,
  rnd: () => number
): string[] {
  const out: string[] = [];
  const j = () => 1 + (rnd() - 0.5) * 0.14; // 手工感：±7% 抖动

  if (style === "rosette") {
    emitPoly(out, folds, 0, leaf(R * 0.735, R * 0.3 * d, R * 0.086 * d), j());
    emitDots(out, 2 * folds, 180 / folds, R * 0.615, R * 0.03 * d * j());
    emitPoly(out, folds, 180 / folds, slit(R * 0.3 * d, R * 0.5 * d, R * 0.026 * d));
    emitPoly(out, folds, 0, leaf(R * 0.2, R * 0.24 * d, R * 0.062 * d), j());
    out.push(centerDot(R * 0.058 * d * j()));
  }

  if (style === "bloom") {
    emitPoly(out, folds, 0, leaf(R * 0.7, R * 0.44 * d, R * 0.15 * d), j());
    emitPoly(out, 2 * folds, 180 / folds, wedge(R * 0.55, R * 0.1 * d, R * 0.055 * d), j());
    emitPoly(out, folds, 0, leaf(R * 0.34, R * 0.3 * d, R * 0.1 * d), j());
    emitArcRing(out, folds, 180 / folds, R * 0.185 * d, R * 0.05 * d, 0.58);
  }

  if (style === "wave") {
    emitArcRing(out, folds, 0, R * 0.72 * d, R * 0.062 * d, 0.6);
    emitArcRing(out, folds, 180 / folds, R * 0.52 * d, R * 0.05 * d, 0.62);
    emitArcRing(out, folds, 0, R * 0.33 * d, R * 0.042 * d, 0.56);
    emitDots(out, 2 * folds, 0, R * 0.87, R * 0.027 * d * j());
    out.push(centerDot(R * 0.07 * d));
  }

  if (style === "grid") {
    emitPoly(out, folds, 0, slit(R * 0.2 * d, R * 0.64 * d, R * 0.019 * d));
    emitPoly(out, 2 * folds, 180 / folds, square(R * 0.5, R * 0.085 * d), j());
    emitDots(out, 2 * folds, 0, R * 0.855, R * 0.033 * d * j());
    emitDots(out, 2 * folds, 180 / folds, R * 0.755, R * 0.022 * d);
    emitPoly(out, 2 * folds, 180 / folds, wedge(R * 0.32, R * 0.1 * d, R * 0.045 * d), j());
  }

  if (style === "scroll") {
    emitArcRing(out, folds, 0, R * 0.72 * d, R * 0.055 * d, 0.52);
    emitArcRing(out, folds, 180 / folds, R * 0.54 * d, R * 0.045 * d, 0.5);
    emitPoly(out, folds, 180 / folds, slit(R * 0.24 * d, R * 0.44 * d, R * 0.022 * d));
    emitPoly(out, 2 * folds, 0, leaf(R * 0.36 * d, R * 0.14 * d, R * 0.05 * d), j());
    out.push(centerDot(R * 0.075 * d));
    emitDots(out, 2 * folds, 0, R * 0.88, R * 0.026 * d * j());
  }

  return out;
}

/* ============================================================
   5. 对外接口
   ============================================================ */

export interface PaperCutOptions {
  seed?: number;
  /** 折数：旋转对称重数 */
  folds?: number;
  /** 半径（viewBox 为 -R..R） */
  radius?: number;
  style?: CutStyle;
  rim?: RimStyle;
  /** 0.6 疏 ～ 1.4 密 */
  density?: number;
}

export interface PaperCut {
  viewBox: string;
  radius: number;
  folds: number;
  /** 纸片外轮廓（闭合），剪切动画沿它游走 */
  outline: string;
  /** 每一处镂空 */
  holes: string[];
  /** 纸片 + 镂空 合成一条路径（配合 fill-rule: evenodd） */
  d: string;
}

const RIM_BY_STYLE: Record<CutStyle, RimStyle> = {
  rosette: "scallop",
  bloom: "scallop",
  wave: "smooth",
  grid: "smooth",
  scroll: "smooth",
};

export function paperCut(options: PaperCutOptions = {}): PaperCut {
  const seed = options.seed ?? 1;
  const folds = Math.max(4, Math.min(24, Math.round(options.folds ?? 8)));
  const R = options.radius ?? 100;
  const style = options.style ?? "rosette";
  const rim = options.rim ?? RIM_BY_STYLE[style];
  const density = Math.max(0.6, Math.min(1.4, options.density ?? 1));
  const rnd = mulberry32(seed * 2654435761 + folds * 40503);

  const outline = platePath(folds, R, rim);
  const holes = interior(folds, R, style, density, rnd);

  return {
    viewBox: `${-R} ${-R} ${R * 2} ${R * 2}`,
    radius: R,
    folds,
    outline,
    holes,
    d: [outline, ...holes].join(" "),
  };
}

/** 首屏剪切动画：沿外轮廓走一圈 */
export function cutPath(options: PaperCutOptions = {}): {
  d: string;
  viewBox: string;
  radius: number;
} {
  const cut = paperCut(options);
  return { d: cut.outline, viewBox: cut.viewBox, radius: cut.radius };
}
