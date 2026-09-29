/**
 * 光标 —— 一把合起来的剪刀
 * - 形状始终是合着的：hover 只是微微涨一点，点击「咔嚓」缩一下、亮一下刀口
 * - 划过屏幕留下极淡的划痕（Canvas，几秒后淡出）
 * - 触屏 / 窄屏 / 减少动效 时完全不启用，用系统默认光标
 *
 * ⚠ 站内导航（ClientRouter）会换掉整份 <body>，所以这里每一个元素引用都必须「每次 init 重新取」，
 *   不能闭包缓存 —— 缓存下来的一换页就指向被丢弃的旧节点，剪刀会当场消失。
 *   指针位置也留在模块里：换页后立刻按原位摆好，不会闪一下。
 */

const HOTSPOT = { x: 32, y: 4 };

let tool: HTMLElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let dpr = 1;
let raf = 0;
let running = false;
let bound = false;
/** 划痕用：上一次落笔的位置 */
let last: { x: number; y: number } | null = null;
let pending = false;
let px = -200;
let py = -200;
/** 指针位置：跨页面留着，换页后可以立刻把剪刀摆回去 */
let mx = -200;
let my = -200;
let live = false;

function place(): void {
  if (!tool) return;
  tool.style.transform = `translate3d(${mx - HOTSPOT.x}px, ${my - HOTSPOT.y}px, 0)`;
}

/** 拿到第一个指针位置之前不亮剪刀，避免左上角出现一只幽灵 */
function goLive(): void {
  if (live) return;
  live = true;
  document.documentElement.classList.add("is-live");
  // 同时标在元素自己身上：换页时 <html> 的 class 会被 Astro 换掉，这个属性不会
  if (tool) tool.dataset.live = "1";
}

function resized(): void {
  if (!canvas || !ctx) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** 用 destination-out 一层层擦掉旧笔迹，比逐条管理寿命便宜得多 */
function frame(): void {
  if (!ctx || !canvas) return;
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0, 0, 0, 0.055)";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.globalCompositeOperation = "source-over";

  if (pending && last) {
    ctx.strokeStyle = "rgba(201, 162, 39, 0.26)";
    ctx.lineWidth = 1.15;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    px = last.x;
    py = last.y;
    pending = false;
  }

  if (running) raf = requestAnimationFrame(frame);
}

function wake(): void {
  if (running) return;
  running = true;
  last = null;
  raf = requestAnimationFrame(frame);
}

function sleepSoon(): void {
  window.setTimeout(() => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }, 1400);
}

function interactive(el: Element | null): boolean {
  if (!el) return false;
  return !!el.closest(
    "a[href], button, [role='button'], input, select, textarea, summary, label"
  );
}

export function initCursor(): void {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const wide = window.innerWidth >= 900;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 每次都重新取：换页之后是新节点
  tool = document.querySelector<HTMLElement>("[data-scissor]");
  canvas = document.querySelector<HTMLCanvasElement>("[data-scratch]");
  ctx = canvas ? canvas.getContext("2d") : null;

  if (!fine || !wide || reduce || !tool || !canvas || !ctx) {
    document.documentElement.classList.remove("has-scissor", "is-live");
    tool = null;
    canvas = null;
    ctx = null;
    return;
  }

  document.documentElement.classList.add("has-scissor");
  resized();

  if (!bound) {
    bound = true;

    let queued = false;

    const move = (): void => {
      queued = false;
      goLive();
      if (!tool) return;
      const open = interactive(document.elementFromPoint(mx, my));
      // 「咔嚓」那一瞬间不打断
      tool.dataset.state = tool.dataset.state === "cut" ? "cut" : open ? "hover" : "idle";
      // 清掉 pointerleave 写下的 inline 0 —— 留着它剪刀就再也回不来了
      tool.style.opacity = "";
      place();
      last = { x: mx, y: my };
      if (Math.hypot(mx - px, my - py) > 3.5) wake();
      sleepSoon();
    };

    window.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        mx = e.clientX;
        my = e.clientY;
        if (!queued) {
          queued = true;
          requestAnimationFrame(move);
        }
      },
      { passive: true }
    );

    window.addEventListener("pointerdown", () => {
      if (!tool) return;
      const back = tool.dataset.state === "hover" ? "hover" : "idle";
      tool.dataset.state = "cut";
      window.setTimeout(() => {
        if (tool) tool.dataset.state = back;
      }, 130);
    });

    window.addEventListener("pointerleave", () => {
      // 指针出了窗口：只淡出，不销毁。回来时 pointerenter / 下一次 move 都会立刻复位
      if (tool) tool.style.opacity = "0";
    });
    window.addEventListener("pointerenter", () => {
      goLive();
      if (tool) tool.style.opacity = "1";
    });

    window.addEventListener("resize", resized);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }
    });
  }

  // 换页之后：把上一次的指针位置立刻摆回去，剪刀不会「消失一下再出现」
  if (live) {
    document.documentElement.classList.add("is-live");
    tool.dataset.live = "1";
    tool.style.opacity = "";
    place();
  }
}
