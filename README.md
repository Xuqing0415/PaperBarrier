# 纸上生花 · Paperbloom

一个剪纸主题的个人博客，兼一个小作品集。首页先摆**最近写的手记**，往下才是画廊 —— 笔记本在前，成果在后。
画廊里挂的是**真的纸**：红纸、黑纸，拍下来一张张抠干净，只留形状。
首屏那朵团花、背后的窗棂、看细节用的镜片则是**算出来的** —— 由「折数、刀法、疏密、种子」四个参数在构建期折成 SVG。
动效只有四种 —— **折 · 剪 · 展开 · 透光**，归不进这四类的效果一律删掉。

签名功能是**昼夜模式**：日间看纸的正面（红纸实心、投影柔和），夜间纸贴在窗上（背景变暗、镂空处透出暖黄灯光）。

---

## 快速开始

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # 静态输出到 dist/
npm run preview    # 本地预览构建产物
npm run check      # astro check（类型 + 内容集合校验）
```

纯静态输出，零运行时框架。JS 只用在动效上：GSAP + ScrollTrigger（视差与首屏时间线）、Lenis（平滑滚动）、原生 Canvas（纸屑、划痕）。

## 目录

```
src/
├─ pages/            index · works · work/[slug] · posts · posts/[slug] · about · 404 · rss.xml.ts
├─ layouts/Base.astro  head、无闪切换主题、ClientRouter、转场关键帧、启动脚本
├─ components/       IntroCut · LatticeGallery · WorkCard · PaperCut · LatticeDefs
│                    ParallaxBackdrop · ScissorCursor · ThemeToggle · SoundToggle
│                    FlowerLoader · PaperNoise · SectionTitle · SiteHeader/Footer
├─ scripts/          intro · reveal · scroll · theme · cursor · hover · lens · nav · loader · sound
├─ lib/              papercut（纹样生成）· lattice（窗棂）· shards（纸屑）· audio（合成音效）
├─ styles/           tokens.css（昼夜两套变量）· global.css（底座、母题动效、prose）
└─ content/          works/*.md · posts/*.md
tools/
├─ cutout.py         照片 → 剪纸抠图（纯色剪影 + 原色各一份）
├─ _photos/          作品原图（脚本不改动它们）+ 抠图三联预览 _sheet.png
├─ preview.ts        单独渲染一张「刀法样张」，用来肉眼校图形
└─ qa.mjs            无头 Edge + CDP 的截图/取状态工具（见文末）
```

## 全站母题

| 动作 | 出现在哪 |
|---|---|
| **折** | 页面转场从点击处裂开；卡片翻面；长卷类作品层层揭开 |
| **剪** | 首屏沿轮廓游走一圈；标题「凸起」；光标是一把**合着**的小剪刀 |
| **展开** | 所有内容入场：`scaleX(0.04→1)` 或 `clip-path` 从中间拉开 |
| **透光** | hover 时灯亮起；昼夜模式；作品详情把纸凑到灯前 |

统一节奏：微交互 400–600ms，转场 700–1200ms，`prefers-reduced-motion` 下全部降级。

---

## 设计令牌与昼夜模式

两套变量都在 `src/styles/tokens.css`，切换只改 `<html data-theme>`：

| | 日间 `day` | 夜间 `night` |
|---|---|---|
| 纸 | `--paper: #f5f0e6` 宣纸米白 | `--paper: #0e0c0b` 深墨 |
| 墨 | `--ink: #1a1614` | `--ink: #ece4d4` |
| 红 | `--red: #c8102e` 中国红 | `--red: #7a0a1c` 暗红剪影 |
| 窗棂 | `--lattice: #8b7355` | `--lattice: #453a31` |
| 灯 | `--glow-alpha: 0`（背后无光） | `--glow-alpha: 1`（镂空处透光） |

背光不是画上去的，是**同一个变量在同一张 SVG 上换一种读法**：纸是 `--red`，镂空处透出的是背后的 `--glow`。
所有「透光」元素（`.hero__light`、`.about__lamp`、`.detail__lamp`、`.work__light`）的强度都写成 `calc(var(--glow-alpha) * k)`，所以日间它们自动消失，不需要第二条样式规则。

主题判定顺序：`localStorage["pb:theme"]` → 系统时间（19:00–06:00 入夜）→ 每 5 分钟复查一次，用户手动切过就不再自动跳。
切换时会从按钮位置扩散一圈光晕（`.theme-bloom`，1.3s），像有人把灯拧亮，而不是瞬间跳色。

## 剪纸生成器

`src/lib/papercut.ts` 是全站图形的来源。核心是折纸的对称性：

> 把圆纸对折 k 次，手上是一块 360/2^k 度的楔形。**在这块楔形上下的每一刀，展开后都会以圆心为中心重复 2^k 次。**

所以生成器只做三件事：在一个楔形里画出「花边 + 花瓣 + 镂空」，然后旋转重复 `k` 次。团的对称群是 D_k，不是「随便画一朵花再复制」。

```ts
import { paperCut } from "./src/lib/papercut";

const art = paperCut({
  seed: 21,          // 一颗种子决定这一朵的随机细节
  folds: 12,         // 折数（旋转对称重数）
  cut: "rosette",    // 刀法：rosette | bloom | wave | grid | scroll
  rim: "scallop",    // 花边：smooth | scallop | spike
  density: 1.02,     // 疏密
  radius: 100,
});

art.viewBox;  // "-100 -100 200 200"
art.outline;  // 只有外轮廓（作品详情的团花形放大镜拿它当 mask）
art.d;        // 外轮廓 + 全部镂空，一条 path，配 fill-rule="evenodd" 成孔
```

图形只做两件事：整数化到一位小数、尽量用最少的点。一朵十二折团花大约 2–6 KB，能跟着昼夜模式一起变色，也不需要任何位图资源。

想校图形时跑 `npx tsx tools/preview.ts`，它会渲染一张包含全部刀法的样张。

### 窗棂

`src/lib/lattice.ts` 里是五种中式窗棂（冰裂纹、步步锦、万字纹、龟背锦、灯笼锦），每个都是边长经过挑选、能在 tile 边界接上的 SVG `<pattern>`。
`LatticeDefs.astro` 把 `<defs>` 渲染一次，之后任何地方 `fill="url(#lattice-ice)"` 就能平铺 —— 一个 `rect` 的代价。

> 注意：窗棂的 `<path>` 必须 `fill:none`（`.lattice-line` 已经统一给了）。path 默认是黑色填充，少了这一句每根窗棂都会变成一块黑多边形。

## 首屏时间轴

`src/scripts/intro.ts`（全程约 4.6s，可点右下角「跳过」或按 Esc）：

| t | 动作 |
|---|---|
| 0.00 | 红纸从中央摊开铺满屏幕 |
| 0.55 | 纸纤维噪点浮现 |
| 0.92 | 剪刀入画 |
| 1.20 | 沿团花外轮廓游走一圈，边走边掉纸屑（**匀速**，剪刀不会加速） |
| 3.20 | 最后一剪「咔嚓」，刀口亮起 |
| 3.28 | 镂空一齐凿开，暖光透进来 |
| 3.46 | 红纸向中心收拢（`clip-path: circle`） |
| 4.05 | 团花放大、淡出，正文从镂空处透出来 |

纸屑是 Canvas（`src/lib/shards.ts`）：7 种不规则碎屑随机取用，带空气摆动、旋转和阻尼。
首屏期间 `is-intro` 会按住全站的入场动画，结束时派发 `pb:reveal` 放行。
**任何一步出错都不会把内容挡住**：`runIntro()` 有 try/catch，另有一个 9 秒兜底闸门会无条件收场。

## 加一件作品

作品分两种：**实拍**（照片抠成图，放进 `src/assets/works/`）和**算法习作**（不给图片，纹样由参数折出来）。
在 `src/content/works/` 丢一个 `.md`（文件名就是 URL：`/work/<文件名>`），frontmatter 由 `src/content.config.ts` 校验：

```yaml
---
title: 云龙
summary: 一句话说明，用于卡片。（作品卡上显示）
year: 2025
material: 红纸         # 纸张；有实拍的作品会显示在「材质」一栏
category: 长卷         # 传统 | 现代 | 长卷
cut: wave              # 刀法：rosette | bloom | wave | grid | scroll
rim: smooth            # 花边：smooth | scallop | spike
folds: 6               # 折数 = 旋转对称重数（4–24），也决定详情页镜片的形状
seed: 44               # 换个种子就是另一朵
density: 1.0           # 疏密 0.6–1.4
lattice: wan           # 窗棂：ice | step | wan | tortoise | lantern
hover: peel            # 卡片交互：glow（灯从背后亮起）| tilt（翘起视差）| peel（层层揭开）
image: yun-long.webp              # 实拍封面，文件放 src/assets/works/
imageAlt: 云龙——红纸剪纸实拍
gallery: [yun-long-real.webp]     # 详情页下面那排（这里是原色那份）
tags: [龙, 长卷, 鳞片]
featured: true         # 是否上首页
order: 3               # 排序
---
正文用 Markdown……
```

- 有 `image` 就以照片为准：卡片和详情页都用它，`folds` / `cut` 只再负责详情页那个团花形的放大镜。
- 不给 `image` 就回到算法折出来的那一朵：样子完全由参数决定，改完 `git diff` 里只有一行数字。
- 卡片 hover 方式建议和类型对齐：团花生肖用 `glow`，现代抽象用 `tilt`，长卷组图用 `peel`。
- 早先那 8 件纯算法的习作留档在 `src/content/works/_studies/`：内容集合只收 `works/` 这一层的 `.md`，
  想放回画廊把文件移上来即可。

## 作品照片怎么抠

`tools/cutout.py` —— 把照片里的剪纸从背景（木框、卡纸、墙面、阴影）里剥出来，只留下纸。

```bash
python tools/cutout.py             # 全部
python tools/cutout.py yun-long    # 只跑一件
```

每件产出两份，都写进 `src/assets/works/`：

| 文件 | 内容 | 用在哪 |
|---|---|---|
| `<slug>.webp` | **纯色剪影**：只有形状，一种红或一种黑（无损 webp，颜色写死，alpha 保留） | 卡片 + 详情页主图 —— 夜里一条 `brightness(.44)` 就把它压成剪影 |
| `<slug>-real.webp` | **原色抠图**：保留照片本来的红 | 详情页「实拍 · 原色」那一排 |

几条硬规矩：

1. **按颜色分纸**：红纸看 `(r - max(g,b))/255 > 0.26` 加饱和度门槛，黑纸看暗度。暗红棕的木框够不上这个门槛，天然被排除。
2. **只去碎屑，绝不填洞** —— 镂空才是剪纸的正身。`tidy()` 只丢小于最大块 3% 的孤立块。
3. **蒙版外 RGB 一律清零**：否则夜间调色、混合时，白卡纸会从边缘渗出来。
4. **边缘留 1px 过渡**（`soften()`：高斯模糊后把阈值拉回中间），缩到卡片尺寸才没有狗牙。
5. 输出长边 ≤ 1400px；`tools/_photos/_sheet.png` 是「白天 / 夜间 / 实拍」三联预览，用来肉眼校对。
6. 原图放 `tools/_photos/`，脚本不改动它们 —— 想换阈值就重跑。

> 逐张调参在 `cutout.py` 顶部的 `JOBS`：`mode`（red / dark）、`tone`（红或黑）、`inset`（先裁掉多少边框）、
> `real`（要不要出原色那份）。

## 加一篇手记

`src/content/posts/*.md`：`title · date · summary · tags`，另有 `draft: true` 可临时不上线。
正文走 `.prose` 样式（表格、引用、`code`、`hr` 都有），RSS 在 `/rss.xml`。

## 动效参数

| 场景 | 属性 | 时长 | 缓动 |
|---|---|---|---|
| 内容入场 | `scaleX` / `clip-path` / `translateY` | 600ms | `cubic-bezier(.65,0,.35,1)` |
| 剪刀游走 | `stroke-dashoffset` | 2000ms | `linear`（必须匀速） |
| 卡片抬起 | `translateY` + `transform` | 500ms | `cubic-bezier(.34,1.56,.64,1)` |
| 背光点亮 | `opacity` | 450ms | `ease-out` |
| 页面转场 | `clip-path: polygon()`（12 个顶点的锯齿） | 760ms | `cubic-bezier(.65,0,.35,1)` |
| 昼夜切换 | CSS 变量 + 光晕 | 1200ms | `ease-in-out` |
| 标题凸起 | `translateY` + `filter` | 400ms | `ease-out` |
| 滚动视差 | `translateY` | 跟随滚动 | 四层 0.2 / 0.5 / 1 / 1.6 倍速 |

页面转场用 View Transitions API，切点就是鼠标点击的位置（`--vt-x` / `--vt-y`），不支持该 API 的浏览器自动退化为普通跳转。

> **改转场前先看这一条**：`::view-transition-new(root)` 的「剪开」动画写在 `Base.astro` 的行内 `<style>` 里，
> 而这段样式在 `<head>` 里排在打包出来的 CSS **之前**。全局样式表里那句
> `::view-transition-old(root), ::view-transition-new(root) { animation: none }` 会把它整个盖掉 ——
> 结果就是转场静悄悄退化成「旧页淡淡叠在新页上」，看起来又糊又卡。
> 所以 `Base.astro` 里那两条选择器都多挂了一层 `:root` 提权。改的时候别把它删了。
最近的一层视差（飘落的纸屑）永远是 `pointer-events: none`。

## 性能与降级

- 动画只碰 `transform` / `opacity` / `clip-path`，不碰布局属性；`drop-shadow` 不做连续动画（背光一律走伪元素 `opacity`）。
- `prefers-reduced-motion: reduce`：首屏压缩成 0.4s 淡出，视差与剪刀光标整体关闭，转场不做动画，内容直接可见。
- 触屏 / 窄屏（<900px）：剪刀光标与划痕画布不启用，纸屑数量减半，视差层从 4 层减到 2 层。
- 光标是一把**合着**的剪刀，刀尖朝左上（`ScissorCursor.astro` + `scripts/cursor.ts`），任何位置都看得见：那一圈描边（halo）是**烘进 SVG 的第二层图形**，不是 `drop-shadow` —— 静态图形 + 只动 `transform` / `scale`，跟着鼠标跑的元素上一个滤镜都不挂。日间描边是纸白、夜间是墨黑。
- ⚠ **别把 `scale` 和 `transform` 写在同一层**。按 CSS Transforms L2，独立的 `scale` 是乘在 `transform` **外面**的：`.scissor` 那一层既然用 `translate3d(x, y)` 定位，再在同层挂 `scale: 1.09`，位移就会被一起放大 9% —— x≈1200 时剪刀瞬间偏出 100px，鼠标一碰到能点的东西就「跳」一下（在页头那两个按钮上来回蹭就是一串抖动）。所以位置只由 `.scissor` 的 `transform` 负责（纯 translate、**不带过渡**，鼠标才跟手），涨缩挪到里面的 `svg` 上，原点仍是刀尖 `(32, 4)`，缩放时刀尖钉在指针上。
- 页头的两个开关（昼夜 / 音效）是自己在 `global.css` 里画的 `.icon-btn`，第一件事就是 `appearance: none`：不去掉原生外观，鼠标划过时 Chromium 要走系统主题引擎重绘那颗按钮，那一帧会明显地掉。命中区也给足 34×34 —— 太小的目标会让剪刀在 hover / idle 之间来回横跳，看上去就是一卡一卡的。抬起只作用在里面的 `svg` 上（`pointer-events: none`），按钮盒子不动，命中区才是稳定的。
- ≤460px 时页头折成两行（品牌 + 开关一行、四个栏目一行）：挤在一行里的话站名会被从中间掰断、栏目名竖着排，还不如多给一行。
- 剪刀的每个形状都写了 `fill` / `stroke` / `stroke-width` **兜底属性**（CSS 会盖掉它们）。这是必需的：SVG 默认填充是**纯黑**，一旦样式表没生效（dev server 用了旧样式、缓存对不上），没有兜底就会画出一坨实心黑 —— 而 `.scissor__spark` 那个 r=17 的圆会变成最大的一块。
- `cursor: none` 只写在 `html.has-scissor.is-live` 上 —— 只有剪刀真的画出来了，系统光标才让位；在那之前（首帧、关掉动效、触屏）系统光标一直在，不会出现「一个光标都没有」的空窗。
- 页头**不用 `backdrop-filter`**：磨砂玻璃在鼠标划过时要逐帧重算背后的模糊，剪刀压在导航上就会顿。整片实色纸更便宜，也更贴剪纸的题材。
- 站内导航靠 `transition:persist` 保住剪刀与划痕节点，`cursor.ts` 每次 `initCursor()` 都重新查询 `[data-scissor]` / `[data-scratch]`，不缓存 DOM 节点；「已经现身」这个状态记在元素的 `data-live` 上而不是 `<html>` 的 class 上（Astro 换页会把 `<html>` 的 class 整个换掉），所以换页后剪刀原地不动、不闪不掉。
- 纸纹是 `feTurbulence` 生成的 data URI，不是图片；噪点在夜间用 `screen`、日间用 `multiply`。

## 音效

`src/lib/audio.ts` 用 Web Audio 合成剪刀「咔嚓」、纸张「沙沙」、展开的一声轻响，**不加载任何音频文件**。
默认静音，必须由用户点右上角的喇叭打开（浏览器也要求先有交互）。

## 开发工具

`tools/qa.mjs` —— 无头 Edge + CDP 的截图／取状态工具，用来在没有肉眼的环境里校版式（Windows 下写死了 Edge 路径）：

```bash
node tools/qa.mjs --url http://localhost:4399/works/ --out shot.png --w 1280 --h 900 --full
node tools/qa.mjs --url http://localhost:4399/ --out night.png --init "localStorage.setItem('pb:theme','night')"
node tools/qa.mjs --url http://localhost:4399/ --out scrolled.png --wheel 1800 \
  --eval2 "document.querySelectorAll('[data-reveal].is-in').length"
node tools/qa.mjs --url http://localhost:4399/work/yun-long/ --out lens.png --mouse-sel ".detail__art"
```

常用开关：`--wait`（导航后等待，首屏要 7000 以上）、`--eval` / `--eval2`（前后取状态）、`--full`（整页截图）、
`--clip x,y,w,h --scale 2`（局部放大）、`--mouse-sel <选择器>`（派发真实鼠标移动来触发 hover）、`--wheel <像素>`（滚动）。

> 不要用 `--virtual-time-budget` 截动画：那个模式下 requestAnimationFrame 几乎不跑，GSAP 时间线会停在原地，看起来像页面坏了。
