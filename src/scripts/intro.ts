/**
 * 首屏 —— 「剪出来」
 * ---------------------------------------------------------------
 * t=0.00  一张红纸从中央摊开，铺满屏幕          (scaleX 0.02 → 1)
 * t=0.55  纸纤维噪点浮现
 * t=0.95  剪刀从右下入画
 * t=1.20  沿团花外轮廓游走，边走边剪开一道透光的缝   ← 核心 2.0s
 * t=3.20  最后一剪闭合：「咔嚓」，刀口亮起
 * t=3.25  镂空一齐凿开，暖光透进来
 * t=3.45  红纸向中心收拢（clip-path circle），团花放大、淡出
 * t=4.50  正文从镂空处「透」出来
 *
 * 全程可跳过（右下角小剪刀）；reduced-motion 时压缩成 0.4s 淡出。
 */

import gsap from "gsap";
import { ShardField } from "../lib/shards";
import { chime, rustle, snap } from "../lib/audio";

let played = false;
let running = false;
let active: gsap.core.Timeline | null = null;
let field: ShardField | null = null;
let watchdog = 0;

function release(): void {
  window.clearTimeout(watchdog);
  watchdog = 0;
  document.body.classList.remove("is-locked");
  document.documentElement.classList.remove("is-intro");
  window.dispatchEvent(new CustomEvent("pb:reveal"));
}

function finish(root: HTMLElement): void {
  root.remove();
  release();
}

/** 立刻收场：停掉时间线与粒子，把内容交出去（跳过 / 兜底共用） */
function bailNow(): void {
  active?.kill();
  active = null;
  field?.destroy();
  field = null;
  document.getElementById("intro")?.remove();
  running = false;
  played = true;
  release();
}

/**
 * 兜底闸门：首屏是盖住全站的 fixed 层，任何一步出错都不能让内容永远出不来。
 * 9s 内没有正常收场，就无条件放行。
 */
function armWatchdog(): void {
  if (watchdog) return;
  watchdog = window.setTimeout(() => {
    if (!document.documentElement.classList.contains("is-intro")) return;
    bailNow();
  }, 9000);
}

function run(): void {
  const root = document.getElementById("intro");
  if (!root) {
    if (document.documentElement.classList.contains("is-intro")) release();
    return;
  }
  if (running) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (played) {
    finish(root);
    return;
  }
  played = true;
  running = true;

  if (reduce) {
    gsap.to(root, {
      opacity: 0,
      duration: 0.4,
      onComplete: () => {
        running = false;
        finish(root);
      },
    });
    return;
  }

  document.body.classList.add("is-locked");
  armWatchdog();

  const paper = root.querySelector<HTMLElement>('[data-intro="paper"]');
  const art = root.querySelector<SVGSVGElement>('[data-intro="art"]');
  const cut = root.querySelector<SVGPathElement>('[data-intro="cut"]');
  const holes = root.querySelector<SVGPathElement>('[data-intro="holes"]');
  const tool = root.querySelector<HTMLElement>('[data-intro="tool"]');
  const noise = root.querySelector<HTMLElement>('[data-intro="noise"]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-intro="shards"]');
  const skip = root.querySelector<HTMLButtonElement>('[data-intro="skip"]');

  if (!paper || !art || !cut || !holes || !tool || !canvas) {
    running = false;
    finish(root);
    return;
  }

  const shards = (field = new ShardField(canvas, {
    capacity: window.innerWidth < 760 ? 90 : 200,
    colors: ["#c8102e", "#e34234", "#8e0b20", "#efe7d8", "#c9a227"],
    scale: window.innerWidth < 760 ? 0.7 : 1,
  }));

  const len = cut.getTotalLength();
  gsap.set(cut, { strokeDasharray: `${len} ${len}`, strokeDashoffset: len });
  gsap.set(holes, { opacity: 0, scale: 0.9, transformOrigin: "center" });

  const onResize = (): void => shards.resize();
  window.addEventListener("resize", onResize);

  const tl = gsap.timeline({
    defaults: { ease: "power2.out" },
    onComplete: () => {
      window.removeEventListener("resize", onResize);
      shards.destroy();
      field = null;
      active = null;
      running = false;
      finish(root);
    },
  });

  active = tl;

  // —— 1. 摊开
  tl.fromTo(
    paper,
    { scaleX: 0.02, autoAlpha: 1 },
    { scaleX: 1, duration: 0.6, ease: "power3.inOut" },
    0
  );

  // —— 2. 纸纹浮现
  if (noise) tl.to(noise, { opacity: 1, duration: 0.9, ease: "sine.out" }, 0.5);

  // —— 3. 剪刀入画
  tl.fromTo(
    tool,
    { autoAlpha: 0, scale: 0.55 },
    { autoAlpha: 1, scale: 1, duration: 0.45, ease: "back.out(2)" },
    0.92
  );

  // —— 4. 沿轮廓剪一圈（匀速，剪刀不会加速）
  const travel = { p: 0 };
  let lastSpawnX = -999;
  let lastSpawnY = -999;

  tl.to(
    travel,
    {
      p: 1,
      duration: 2,
      ease: "none",
      onStart: () => {
        rustle(520, 0.9);
        tool.dataset.state = "hover";
      },
      onUpdate: () => {
        const l = travel.p * len;
        cut.style.strokeDashoffset = String(len - l);

        const ctm = cut.getScreenCTM();
        if (!ctm) return;
        const a = cut.getPointAtLength(l);
        const b = cut.getPointAtLength(Math.min(len, l + 2));
        const p1 = new DOMPoint(a.x, a.y).matrixTransform(ctm);
        const p2 = new DOMPoint(b.x, b.y).matrixTransform(ctm);
        const ang = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;

        tool.style.transform = `translate3d(${p1.x - 32}px, ${p1.y - 5}px, 0) rotate(${ang + 90}deg)`;

        if (Math.hypot(p1.x - lastSpawnX, p1.y - lastSpawnY) > 16) {
          shards.burst(p1.x, p1.y, 2);
          lastSpawnX = p1.x;
          lastSpawnY = p1.y;
        }
      },
    },
    1.2
  );

  // —— 5. 最后一剪：咔嚓
  tl.call(
    () => {
      snap(1);
      tool.dataset.state = "cut";
      shards.burst(window.innerWidth / 2, window.innerHeight / 2, 12);
    },
    undefined,
    3.2
  );
  tl.to(cut, { strokeWidth: 7, duration: 0.14, ease: "power4.out" }, 3.2);
  tl.to(cut, { strokeWidth: 3.2, duration: 0.5, ease: "power2.inOut" }, 3.34);

  // —— 6. 镂空一齐凿开
  tl.to(holes, { opacity: 1, duration: 0.22, ease: "power2.out" }, 3.28);
  tl.to(holes, { scale: 1, duration: 0.6, ease: "back.out(2.2)" }, 3.28);
  tl.call(() => chime(0.9), undefined, 3.34);

  // —— 7. 剪刀退场
  tl.to(tool, { autoAlpha: 0, scale: 0.7, duration: 0.3, ease: "power2.in" }, 3.36);

  // —— 8. 红纸向中心收拢
  tl.to(
    paper,
    { clipPath: "circle(0% at 50% 50%)", duration: 0.72, ease: "power3.inOut" },
    3.46
  );
  tl.call(() => shards.drizzle(window.innerWidth < 760 ? 12 : 26), undefined, 3.5);

  // —— 9. 团花放大、交出主视觉
  tl.to(art, { scale: 1.14, duration: 0.85, ease: "power2.out" }, 3.5);
  tl.to(root, { opacity: 0, duration: 0.6, ease: "sine.in" }, 4.05);

  // —— 跳过
  const bail = (): void => {
    tl.kill();
    active = null;
    window.removeEventListener("resize", onResize);
    shards.drizzle(14);
    gsap.to(root, {
      opacity: 0,
      duration: 0.35,
      onComplete: () => {
        shards.destroy();
        field = null;
        running = false;
        finish(root);
      },
    });
  };
  skip?.addEventListener("click", bail, { once: true });
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== "Escape") return;
    window.removeEventListener("keydown", onKey);
    bail();
  };
  window.addEventListener("keydown", onKey);
}

/** 对外入口：首屏无论哪一步炸了，正文都必须能出来 */
export function runIntro(): void {
  try {
    run();
  } catch (err) {
    console.error("[paperbloom] 首屏失败，直接放行内容：", err);
    bailNow();
  }
}
