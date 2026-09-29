/**
 * 昼夜模式 —— 剪纸的灵魂是背光。
 * 日间：正面看纸，红纸实心，投影柔和。
 * 夜间：纸贴在窗上，镂空处透出暖黄灯光，红纸变成暗色剪影。
 *
 * 切换时不「跳变」，而是一圈光晕慢慢扩散开，像有人拧亮了灯。
 */

export type Theme = "day" | "night";

const KEY = "pb:theme";
const AUTO_MS = 5 * 60 * 1000;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "night" ? "night" : "day";
}

function savedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "day" || v === "night" ? v : null;
  } catch {
    return null;
  }
}

/** 晚上 7 点后自动入夜，早上 6 点后回到白天 */
export function themeByClock(): Theme {
  const h = new Date().getHours();
  return h >= 19 || h < 6 ? "night" : "day";
}

export function resolveInitialTheme(): Theme {
  return savedTheme() ?? themeByClock();
}

/** 光晕：从切换按钮的位置扩散出去 */
function bloom(x: number, y: number, toNight: boolean): void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  const el = document.createElement("div");
  el.className = "theme-bloom";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.setProperty(
    "--bloom-color",
    toNight ? "rgba(255, 183, 77, 0.34)" : "rgba(255, 244, 214, 0.7)"
  );
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-on"));
  window.setTimeout(() => el.remove(), 1500);
}

export function setTheme(theme: Theme, origin?: { x: number; y: number }): void {
  const prev = currentTheme();
  if (prev === theme) return;

  const root = document.documentElement;
  root.classList.add("is-theming");
  if (origin) bloom(origin.x, origin.y, theme === "night");
  root.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* 隐私模式下写不进去，无所谓 */
  }
  window.setTimeout(() => root.classList.remove("is-theming"), 1300);
  syncToggles();
}

function syncToggles(): void {
  const night = currentTheme() === "night";
  document.querySelectorAll<HTMLElement>("[data-theme-toggle]").forEach((el) => {
    el.setAttribute("aria-pressed", night ? "true" : "false");
    el.setAttribute("aria-label", night ? "切换到日间模式" : "切换到夜间模式");
    el.dataset.state = night ? "night" : "day";
  });
}

let clockTimer = 0;

export function initTheme(): void {
  const root = document.documentElement;
  if (!root.dataset.theme) root.dataset.theme = resolveInitialTheme();

  document.querySelectorAll<HTMLElement>("[data-theme-toggle]").forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const next: Theme = currentTheme() === "night" ? "day" : "night";
      const r = btn.getBoundingClientRect();
      setTheme(next, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    });
  });

  syncToggles();

  // 用户没有手动选过，就跟着太阳走
  if (!clockTimer) {
    clockTimer = window.setInterval(() => {
      if (savedTheme()) return;
      const want = themeByClock();
      if (want !== currentTheme()) setTheme(want);
    }, AUTO_MS);
  }
}
