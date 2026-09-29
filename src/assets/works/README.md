# 作品图（实拍）

这里放**已经被抠干净**的剪纸图 —— 由 `tools/cutout.py` 从 `tools/_photos/` 里的照片生成，
不要手动往里丢带背景的原片。在 `src/content/works/*.md` 的 frontmatter 里写文件名引用：

```yaml
image: yun-long.webp               # 封面 + 详情页主图：纯色剪影，红或黑
imageAlt: 云龙——红纸剪纸实拍
gallery: [yun-long-real.webp]      # 详情页下面那排：原色抠图
```

- 文件名要和 frontmatter 里写的**完全一致**（大小写、扩展名都算），写错会在构建时报错并列出这个目录里现有的文件。
- 支持 jpg / jpeg / png / webp / avif / gif；尺寸和格式不用自己管，构建时 Astro 的 `<Image>` 会自动出 webp 和多倍图。
- 两份图的分工：`<slug>.webp` 只保留形状、颜色写死成一种，所以夜间模式能一条 `filter` 把它压成剪影；
  `<slug>-real.webp>` 保留照片本来的红，用来做「实拍 · 原色」。
- 不写 `image` 的作品会退回算法折出来的团花（见 `src/lib/papercut.ts`）。

重新生成：

```bash
python tools/cutout.py            # 全部
python tools/cutout.py yun-long   # 只跑一件
```

换阈值 / 换输出尺寸就改 `tools/cutout.py` 顶部的 `JOBS` 和 `MAX_OUT`。
