/**
 * 页面转场 & 导航
 * - 把点击位置写进 --vt-x / --vt-y，转场的「剪开」就从那儿裂开
 * - 支持 View Transitions 的浏览器自动生效，不支持的自动退化为普通跳转
 */

import { isAudioEnabled, whoosh } from "../lib/audio";

let bound = false;

function markOrigin(x: number, y: number): void {
  const root = document.documentElement;
  root.style.setProperty("--vt-x", `${Math.round(x)}px`);
  root.style.setProperty("--vt-y", `${Math.round(y)}px`);
}

export function initNav(): void {
  if (!bound) {
    bound = true;

    document.addEventListener(
      "click",
      (e) => {
        const target = e.target as Element | null;
        const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
        if (!link) return;
        const href = link.getAttribute("href") ?? "";
        if (
          !href ||
          href.startsWith("#") ||
          href.startsWith("mailto:") ||
          link.target === "_blank" ||
          link.hasAttribute("download") ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        ) {
          return;
        }
        let x = e.clientX;
        let y = e.clientY;
        if (!x && !y) {
          const r = link.getBoundingClientRect();
          x = r.left + r.width / 2;
          y = r.top + r.height / 2;
        }
        markOrigin(x, y);
      },
      true
    );

    document.addEventListener("astro:before-preparation", () => {
      if (isAudioEnabled()) whoosh(0.8);
    });

    // 键盘跳转没有点击坐标，退回页面中心
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const r = link.getBoundingClientRect();
      markOrigin(r.left + r.width / 2, r.top + r.height / 2);
    });
  }
}
