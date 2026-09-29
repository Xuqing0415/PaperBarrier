/**
 * 「看细节」：放大镜不是普通圆圈，是一片团花。
 *
 * 做法是把同一枚团花按 zoom 放大，再平移，让光标下的那一点始终落在镜心；
 * 镜片本身是一层 mask（团花外轮廓），所以镜子的边界就是刀的边界。
 */

const ZOOM = 2.4;
const LENS = 190;

export function initLens(): void {
  const art = document.querySelector<HTMLElement>("[data-detail-art]");
  if (!art) return;
  if (art.dataset.lensBound === "1") return;
  art.dataset.lensBound = "1";

  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const lens = art.querySelector<HTMLElement>("[data-lens]");
  const inner = art.querySelector<HTMLElement>("[data-lens-inner]");
  if (!lens || !inner) return;

  const half = LENS / 2;
  let queued = false;
  let cx = 0;
  let cy = 0;

  const write = (): void => {
    queued = false;
    const r = art.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    if (!w || !h) return;

    // 光标在作品里的归一化位置
    const fx = (cx - r.left) / w;
    const fy = (cy - r.top) / h;

    // 镜片贴在作品坐标里，镜心跟着光标
    lens.style.left = `${cx - r.left - half}px`;
    lens.style.top = `${cy - r.top - half}px`;

    // 放大的那一份，平移使 (fx, fy) 落在镜心
    inner.style.width = `${w}px`;
    inner.style.height = `${h}px`;
    inner.style.transform = `scale(${ZOOM})`;
    inner.style.left = `${half - fx * w * ZOOM}px`;
    inner.style.top = `${half - fy * h * ZOOM}px`;
  };

  art.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      cx = e.clientX;
      cy = e.clientY;
      art.classList.add("is-zooming");
      if (!queued) {
        queued = true;
        requestAnimationFrame(write);
      }
    },
    { passive: true }
  );

  art.addEventListener("pointerleave", () => {
    art.classList.remove("is-zooming");
  });
}
