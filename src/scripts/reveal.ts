/**
 * 入场揭示 —— 全站统一母题「展开」。
 * 用 IntersectionObserver 而不是 GSAP：这个需求太简单，不值得引入时间线。
 */

let observer: IntersectionObserver | null = null;
let bound = false;

/** 首屏剪裁期间先不动，等 intro 放行 */
function gated(): boolean {
  return document.documentElement.classList.contains("is-intro");
}

function show(el: Element): void {
  el.classList.add("is-in");
  window.setTimeout(() => el.classList.remove("is-done"), 0);
  window.setTimeout(() => el.classList.add("is-done"), 1200);
}

function observe(root: ParentNode): void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("IntersectionObserver" in window) || reduce) {
    root.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in"));
    return;
  }
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          show(e.target);
          observer?.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
  }
  root.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => observer?.unobserve(el));
  if (!gated()) {
    root.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => observer?.observe(el));
  }
}

/** 同一组里的元素自动错开，像纸片一片片展开 */
function stagger(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-reveal-group]").forEach((group) => {
    const own = group.hasAttribute("data-reveal") ? [group] : [];
    const kids = Array.from(
      group.querySelectorAll<HTMLElement>("[data-reveal]")
    ).filter((el) => !own.includes(el));
    kids.forEach((el, i) => el.style.setProperty("--d", `${Math.round(i * 70)}ms`));
  });
}

/** intro 结束后放行「此刻真的在视口里」的那些；下面的交给滚动去揭 */
function flush(): void {
  const vh = window.innerHeight;
  document.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < vh * 0.92 && r.bottom > 0) show(el);
  });
}

export function initReveal(): void {
  stagger(document);
  observe(document);

  if (!bound) {
    bound = true;
    window.addEventListener("pb:reveal", () => {
      observe(document);
      flush();
    });
  }
}
