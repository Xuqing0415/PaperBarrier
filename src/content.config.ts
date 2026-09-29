import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/**
 * 作品 —— 每件作品的「图形」不是图片，而是由参数描述的剪纸算法。
 * 这样一张 5KB 的 SVG 就能顶掉几百 KB 的位图，还能随昼夜模式一起变色。
 */
const works = defineCollection({
  // 只收 works/ 这一层的 md：`_` 开头的子目录（比如 _studies/）是留档，不进画廊
  loader: glob({ pattern: "*.md", base: "./src/content/works" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    year: z.number().int(),
    /** 纸张：红纸 / 黑纸 —— 有实拍的作品会显示在「材质」一栏 */
    material: z.string().optional(),
    /** 传统 / 现代 / 长卷 —— 决定 hover 的透光方式 */
    category: z.enum(["传统", "现代", "长卷"]),
    /** 刀法 */
    cut: z.enum(["rosette", "bloom", "wave", "grid", "scroll"]).default("rosette"),
    /** 花边 */
    rim: z.enum(["smooth", "scallop", "spike"]).optional(),
    /** 折数（旋转对称重数） */
    folds: z.number().int().min(4).max(24).default(8),
    seed: z.number().int().default(1),
    density: z.number().min(0.6).max(1.4).default(1),
    /** 贴在哪种窗棂上 */
    lattice: z.enum(["ice", "step", "wan", "tortoise", "lantern"]).default("ice"),
    /** hover 行为：透光 / 翘起 / 揭开 */
    hover: z.enum(["glow", "tilt", "peel"]).default("glow"),
    /** 实拍封面：只写文件名，文件放在 src/assets/works/。不写就用算法生成的团花 */
    image: z.string().optional(),
    /** 封面图的可访问文字 */
    imageAlt: z.string().optional(),
    /** 详情页下面那排实拍图 */
    gallery: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    order: z.number().default(99),
  }),
});

/** 手记 —— 普通的博客文章 */
const posts = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { works, posts };
