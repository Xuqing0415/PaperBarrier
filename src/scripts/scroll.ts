/**
 * 平滑滚动（Lenis）+ 多层剪纸视差（GSAP ScrollTrigger）
 * ---------------------------------------------------------------
 * 四层速度：0.2（暗红云纹）/ 0.5（镂空几何）/ 1（正文）/ 1.6（飘落的纸屑）
 * 最近的那层必须 pointer-events: none，否则会挡住点击。
 */

import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Lenis from "lenis";

let lenis: Lenis | null = null;
let registered = false;
const triggers: ScrollTrigger[] = [];

export function getLenis(): Lenis | null {
  return lenis;
}

export function stopScroll(): void {
  lenis?.stop();
}

export function startScroll(): void {
  lenis?.start();
}

function buildLayers(): void {
  triggers.forEach((t) => t.kill());
  triggers.length = 0;

  document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
    const speed = Number(el.dataset.speed ?? "0.3");
    if (!Number.isFinite(speed) || speed === 0) return;
    const tween = gsap.to(el, {
      yPercent: -speed * 100,
      ease: "none",
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        invalidateOnRefresh: true,
      },
    });
    if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
  });
}

export function initScroll(): void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  if (!registered) {
    registered = true;
    gsap.registerPlugin(ScrollTrigger);

    lenis = new Lenis({
      duration: 1.05,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      smoothWheel: true,
      autoRaf: false,
    });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenis?.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  buildLayers();

  // 等新页面布局稳定后再量一次
  requestAnimationFrame(() => {
    lenis?.resize();
    ScrollTrigger.refresh();
  });
}
