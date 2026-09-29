/**
 * 作品详情的「悬浮」感：纸片随鼠标微倾斜 + 位移，投影（背后的光）反向移动。
 * 用 CSS 变量驱动，读写都在一个 rAF 里，避免布局抖动。
 */

export function initHover(): void {
  document.querySelectorAll<HTMLElement>('[data-hover="tilt"]').forEach((card) => {
    if (card.dataset.tiltBound === "1") return;
    card.dataset.tiltBound = "1";

    const link = card.querySelector<HTMLElement>(".work__link");
    const light = card.querySelector<HTMLElement>(".work__light");
    if (!link) return;

    let queued = false;
    let nx = 0;
    let ny = 0;

    const write = (): void => {
      queued = false;
      const px = nx * 16;
      const py = ny * 16;
      link.style.setProperty("--tx", `${(-px).toFixed(2)}px`);
      link.style.setProperty("--ty", `${(-py).toFixed(2)}px`);
      link.style.setProperty("--ry", `${(nx * 8).toFixed(2)}deg`);
      link.style.setProperty("--rx", `${(-ny * 8).toFixed(2)}deg`);
      // 光往反方向走，才有「纸片浮在灯前」的错觉
      light?.style.setProperty("--lx", `${(px * 0.6).toFixed(2)}px`);
      light?.style.setProperty("--ly", `${(py * 0.6).toFixed(2)}px`);
    };

    card.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        const r = card.getBoundingClientRect();
        nx = (e.clientX - r.left) / r.width - 0.5;
        ny = (e.clientY - r.top) / r.height - 0.5;
        card.classList.add("is-live");
        if (!queued) {
          queued = true;
          requestAnimationFrame(write);
        }
      },
      { passive: true }
    );

    const reset = (): void => {
      card.classList.remove("is-live");
      ["--tx", "--ty", "--rx", "--ry", "--lx", "--ly"].forEach((v) => {
        link.style.removeProperty(v);
        light?.style.removeProperty(v);
      });
    };

    card.addEventListener("pointerleave", reset);
    card.addEventListener("blur", reset);
  });
}
