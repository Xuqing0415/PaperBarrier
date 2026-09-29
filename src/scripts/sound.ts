/**
 * 音效开关。默认静音 —— 声音必须由用户主动打开。
 */

import { isAudioEnabled, setAudioEnabled, chime, snap } from "../lib/audio";

const KEY = "pb:sound";

function restore(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

function sync(): void {
  const on = isAudioEnabled();
  document.documentElement.dataset.sound = on ? "on" : "off";
  document.querySelectorAll<HTMLElement>("[data-sound-toggle]").forEach((el) => {
    el.setAttribute("aria-pressed", on ? "true" : "false");
    el.setAttribute("aria-label", on ? "关闭音效" : "开启音效（剪刀、纸张）");
  });
}

export function initSound(): void {
  document.querySelectorAll<HTMLElement>("[data-sound-toggle]").forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const next = !isAudioEnabled();
      void setAudioEnabled(next);
      try {
        localStorage.setItem(KEY, next ? "on" : "off");
      } catch {
        /* ignore */
      }
      sync();
      if (next) {
        chime(0.7);
        window.setTimeout(() => snap(0.5), 220);
      }
    });
  });

  if (restore() && !isAudioEnabled()) {
    // 浏览器要求先有用户交互，这里只是标记状态，真正出声要等第一次点击
    void setAudioEnabled(true);
    const arm = (): void => {
      void setAudioEnabled(true);
      document.removeEventListener("pointerdown", arm);
      document.removeEventListener("keydown", arm);
    };
    document.addEventListener("pointerdown", arm, { once: true });
    document.addEventListener("keydown", arm, { once: true });
  }

  sync();
}
