/**
 * 开发用：把各风格的剪纸纹样渲染成一张 HTML，方便肉眼校对。
 * 运行： node tools/preview.ts > preview.html
 */
import { paperCut, type CutStyle, type RimStyle } from "../src/lib/papercut.ts";

const styles: CutStyle[] = ["rosette", "bloom", "wave", "grid", "scroll"];
const rims: RimStyle[] = ["smooth", "scallop", "spike"];

function cell(
  label: string,
  style: CutStyle,
  folds: number,
  seed: number,
  rim?: RimStyle
): string {
  const cut = paperCut({ style, folds, seed, rim, radius: 100 });
  return `<figure>
  <svg viewBox="${cut.viewBox}" width="240" height="240">
    <path d="${cut.d}" fill="#c8102e" fill-rule="evenodd"/>
  </svg>
  <figcaption>${label} · folds=${folds} · seed=${seed}${rim ? ` · rim=${rim}` : ""}</figcaption>
</figure>`;
}

const grid: string[] = [];
for (const s of styles) {
  for (const f of [6, 8, 12]) {
    grid.push(cell(s, s, f, 7));
  }
}
for (const r of rims) {
  grid.push(cell(`rim-${r}`, "rosette", 10, 3, r));
}
for (const seed of [11, 42, 99, 1234]) {
  grid.push(cell(`seed-${seed}`, "rosette", 9, seed));
}

console.log(`<!doctype html>
<html><head><meta charset="utf-8"><title>papercut preview</title>
<style>
  body { margin:0; background:#f5f0e6; font:12px/1.4 system-ui, sans-serif; padding:16px; }
  .grid { display:grid; grid-template-columns:repeat(5, 1fr); gap:14px; }
  figure { margin:0; }
  svg { background:#efe7d8; }
  figcaption { color:#6f665c; padding-top:4px; }
</style></head>
<body><div class="grid">${grid.join("\n")}</div></body></html>
`);
