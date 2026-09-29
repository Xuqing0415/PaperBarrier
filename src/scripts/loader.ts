/**
 * 团花 Loading —— 只在客户端跳转时出现。
 * 首屏有剪裁动画顶着，不需要再叠一层。
 */

let bound = false;
let timer = 0;

function el(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-loader]");
}

export function initLoader(): void {
  if (bound) return;
  bound = true;

  document.addEventListener("astro:before-preparation", () => {
    window.clearTimeout(timer);
    // 稍微延后一点：几十毫秒内就完成的跳转不必闪一下
    timer = window.setTimeout(() => el()?.classList.add("is-on"), 200);
  });

  document.addEventListener("astro:page-load", () => {
    window.clearTimeout(timer);
    el()?.classList.remove("is-on");
  });
}
