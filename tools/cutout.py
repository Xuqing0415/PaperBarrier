# -*- coding: utf-8 -*-
"""
作品照片 -> 剪纸抠图
---------------------------------------------------------------
把照片里的剪纸从背景（木框、卡纸、墙面、桌面、阴影）里剥出来，只留下纸。

输出两种（都写进 src/assets/works/）：
  <slug>.png       纯色剪影：只保留形状，红/黑交给 CSS —— 昼夜模式可以直接换色
  <slug>-real.png  原色抠图：保留照片本来的红，用在详情页的「实拍」位

原图放 tools/_photos/（脚本不改动原图）。
跑： python tools/cutout.py            全部
     python tools/cutout.py yun-long   只跑一件
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps
from scipy import ndimage

try:  # Windows 控制台默认 GBK，中文和 ✓ 会炸
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "_photos"
OUT = ROOT / "src" / "assets" / "works"
SHEET = SRC / "_sheet.png"

RED = (200, 16, 46)      # 与 --red 一致
INK = (26, 22, 20)       # 与 --ink 一致

MAX_OUT = 1400           # 输出长边（够 2x 屏，又不至于让仓库变胖）

# inset：先按比例裁掉一圈边框（只对带木框的照片需要）
# real：是否额外输出原色抠图
JOBS = [
    dict(src="p1-caishen.jpg",  slug="zhaocai-jinbao",    mode="red",  tone="red", name="招财进宝", inset=0.012, real=True,
         title="招财进宝", year=2024, category="传统", lattice="ice",      hover="glow",  cut="rosette", folds=12, seed=7,  density=1.06,
         summary="财神抱着元宝，冠上两枚铜钱是分开剪的，展开时才咬合在一起。",
         tags=["财神", "窗花", "过年的"]),
    dict(src="p2-tiger.jpg",    slug="yin-feng-shan-jun", mode="red",  tone="red", name="山君", inset=0.012, real=True,
         title="山君", year=2025, category="传统", lattice="step",     hover="glow",  cut="bloom",   folds=8,  seed=31, density=1.14,
         summary="虎身上的斑纹全是留出来的线，一刀剪断就散了 —— 最险的地方是尾巴。",
         tags=["生肖", "虎", "斑纹"]),
    dict(src="p5-dragon.jpg",   slug="yun-long",          mode="red",  tone="red", name="云龙", inset=0.0,   real=True,
         title="云龙", year=2025, category="长卷", lattice="wan",      hover="peel",  cut="wave",    folds=6,  seed=44, density=1.0,
         summary="横向铺开的一条龙，鳞片是密密的小方格，胡须和爪尖细到几乎连不住。",
         tags=["龙", "长卷", "鳞片"]),
    dict(src="p4-duo.jpg",      slug="xiang-wang",        mode="red",  tone="red", name="相望", inset=0.0,   real=True,
         title="相望", year=2025, category="现代", lattice="tortoise", hover="tilt",  cut="scroll",  folds=4,  seed=88, density=0.9,
         summary="左边一张女孩的侧脸，右边一张花脸的侧脸，中间隔着一片白。",
         tags=["侧脸", "双联", "留白"]),
    dict(src="p6-cat-rose.jpg", slug="mao-yu-meigui",     mode="red",  tone="red", name="猫与玫瑰", inset=0.0, real=True,
         title="猫与玫瑰", year=2026, category="现代", lattice="lantern", hover="tilt",  cut="bloom",   folds=5,  seed=63, density=1.1,
         summary="猫的背是一整块留红，玫瑰才敢开得那么碎 —— 疏和密得有一个人让路。",
         tags=["猫", "玫瑰", "疏密"]),
    dict(src="p8-lady-b.jpg",   slug="he-feng",           mode="red",  tone="red", name="荷风", inset=0.012, real=True,
         title="荷风", year=2024, category="传统", lattice="lantern", hover="glow",  cut="bloom",   folds=8,  seed=12, density=1.02,
         summary="仕女抱着一枝荷花，裙褶用密线走，荷叶用大块留白接住风。",
         tags=["仕女", "荷花", "衣纹"]),
    dict(src="p3-lady-a.jpg",   slug="nie-hua-shinv",     mode="red",  tone="red", name="拈花仕女", inset=0.012, real=True,
         title="拈花仕女", year=2023, category="传统", lattice="step",  hover="glow",  cut="rosette", folds=10, seed=19, density=0.96,
         summary="一手拈花、一手垂袖。衣带是最难的一处，细得只剩一根线连着。",
         tags=["仕女", "团花", "衣带"]),
    dict(src="p9-black.jpg",    slug="yun-ji",            mode="dark", tone="ink", name="云髻", inset=0.0,   real=True,
         title="云髻", year=2026, category="传统", lattice="tortoise", hover="glow",  cut="rosette", folds=12, seed=5,  density=1.18,
         summary="黑纸剪的一顶髻。夜里贴在窗上，透光的地方全成了星星。",
         tags=["黑纸", "发髻", "背影"]),
]


def read(path, max_side=2200):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    if max(im.size) > max_side:
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    return im


def paper_mask(im, mode, inset=0.0, redness=0.26, sat_min=0.28, val_min=0.30, dark_max=0.42):
    """逐像素判断「这是不是纸」：红纸看偏红程度，黑纸看暗度。
    木框是暗红棕的，偏红程度够不上，所以会被排除。"""
    a = np.asarray(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(2), a.min(2)
    sat = (mx - mn) / np.maximum(mx, 1.0)
    val = mx / 255.0

    if mode == "red":
        warm = (r - np.maximum(g, b)) / 255.0
        m = (warm > redness) & (sat > sat_min) & (val > val_min)
    else:
        m = (val < dark_max) & (sat < 0.55)

    if inset > 0:
        h, w = m.shape
        dy, dx = int(h * inset), int(w * inset)
        keep = np.zeros_like(m)
        keep[dy : h - dy, dx : w - dx] = True
        m &= keep
    return m


def tidy(m, keep_frac=0.03):
    """开运算去噪点、闭运算补针孔，再丢掉碎屑。
    注意：只丢「孤立的碎块」，绝不填洞 —— 镂空才是剪纸的正身。"""
    st = np.ones((3, 3), bool)
    m = ndimage.binary_closing(ndimage.binary_opening(m, st, iterations=1), st, iterations=2)
    lab, n = ndimage.label(m, st)
    if n <= 1:
        return m, n
    sizes = ndimage.sum(m, lab, np.arange(1, n + 1))
    biggest = float(sizes.max())
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= biggest * keep_frac])
    lab2, n2 = ndimage.label(keep, st)
    return keep, n2


def soften(m, sigma=0.62, gain=2.2):
    """二值蒙版 -> 带 1px 过渡的 alpha，缩到卡片尺寸时边缘才不会是狗牙。"""
    a = ndimage.gaussian_filter(m.astype(np.float32), sigma)
    a = np.clip((a - 0.5) * gain + 0.5, 0.0, 1.0)
    return np.round(a * 31) / 31


def bbox(m, pad=6):
    ys, xs = np.nonzero(m)
    if not len(ys):
        return None
    h, w = m.shape
    return (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(w, int(xs.max()) + 1 + pad),
        min(h, int(ys.max()) + 1 + pad),
    )


def fit(im, max_side=MAX_OUT):
    if max(im.size) > max_side:
        im = im.resize(
            (max(1, round(im.width * max_side / im.height)), max_side)
            if im.height >= im.width
            else (max_side, max(1, round(im.height * max_side / im.width))),
            Image.LANCZOS,
        )
    return im


def build(job):
    src = SRC / job["src"]
    im = read(src)
    m = paper_mask(im, job["mode"], job["inset"])
    m, n = tidy(m)
    box = bbox(m)
    if box is None:
        raise SystemExit(f"× {job['slug']}：一个纸像素都没找到，检查 mode / 阈值")
    im = im.crop(box)
    m = m[box[1] : box[3], box[0] : box[2]]
    im = fit(im)
    alpha = np.asarray(fit(Image.fromarray((soften(m) * 255).astype(np.uint8), "L"))).astype(np.float32) / 255.0

    rgb = np.asarray(im).astype(np.float32) * alpha[..., None]   # 蒙版外清零
    tone = INK if job["tone"] == "ink" else RED
    flat = np.zeros_like(rgb)
    flat[...] = tone
    a8 = (alpha * 255).astype(np.uint8)

    OUT.mkdir(parents=True, exist_ok=True)
    sil = Image.fromarray(np.dstack([flat * alpha[..., None], a8]).astype(np.uint8), "RGBA")
    p1 = OUT / f"{job['slug']}.webp"
    sil.save(p1, lossless=True, method=6)

    real = None
    p2 = None
    if job.get("real") and job.get("real_keep", True):
        real_im = im
        if max(real_im.size) > 1100:
            s = 1100 / max(real_im.size)
            real_im = real_im.resize((round(real_im.width * s), round(real_im.height * s)), Image.LANCZOS)
            a2 = np.asarray(Image.fromarray(a8, "L").resize(real_im.size, Image.LANCZOS)).astype(np.float32) / 255.0
        else:
            a2 = alpha
        real = Image.fromarray(
            np.dstack([np.asarray(real_im).astype(np.float32) * a2[..., None],
                       (a2 * 255).astype(np.uint8)]).astype(np.uint8), "RGBA"
        )
        p2 = OUT / f"{job['slug']}-real.webp"
        real.save(p2, quality=86, method=6)

    print(
        f"✓ {job['name']:<5} {job['slug']:<16} {im.width}x{im.height} "
        f"块={n} 覆盖={m.mean() * 100:.1f}%  {p1.stat().st_size // 1024}KB"
        + (f"  +实拍 {p2.stat().st_size // 1024}KB" if p2 else "")
    )
    return sil, real, im.size


def sheet(rows, path=SHEET, box=(250, 330)):
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 17)
    font_s = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)
    day, night, mat = (245, 240, 230), (14, 12, 11), (238, 235, 228)
    tw = box[0] * 3 + 16 + 4
    th = box[1] + 30
    cols = 2
    out = Image.new("RGB", (tw * cols, th * ((len(rows) + cols - 1) // cols)), (228, 220, 206))
    for i, (job, sil, real) in enumerate(rows):
        tile = Image.new("RGB", (tw, th), day)
        panels = [(sil, day), (sil, night), (real, mat)]
        for k, (img, bg) in enumerate(panels):
            cell = Image.new("RGB", box, bg)
            if img is None:
                ImageDraw.Draw(cell).text((8, 8), "（无）", fill=(150, 140, 130), font=font_s)
            else:
                it = ImageOps.contain(img.convert("RGBA"), box, Image.LANCZOS)
                cell.paste(it, ((box[0] - it.width) // 2, (box[1] - it.height) // 2), it)
            tile.paste(cell, (k * (box[0] + 8), 28))
        ImageDraw.Draw(tile).text(
            (2, 4), f"{job['name']} · {job['slug']} · {sil.width}×{sil.height}", fill=(26, 22, 20), font=font
        )
        out.paste(tile, ((i % cols) * tw, (i // cols) * th))
    if max(out.size) > 2400:
        out.thumbnail((2400, 2400), Image.LANCZOS)
    out.save(path)
    print("预览 ->", path, out.size, "（左 白天 / 中 夜间 / 右 实拍原色）")


def main():
    want = set(sys.argv[1:])
    jobs = [j for j in JOBS if not want or j["slug"] in want]
    if not jobs:
        raise SystemExit("没有匹配的作品名：" + "、".join(sorted(want)))
    rows = []
    for job in jobs:
        sil, real, _ = build(job)
        rows.append((job, sil, real))
    sheet(rows)


main()
