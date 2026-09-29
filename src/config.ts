/**
 * 站点身份 —— 站名、域名、署名只在这里写一遍。
 * 以后想换名字，改这个文件就够了（页头、页脚、各页 title、RSS 都从这里取）。
 */

export const SITE = {
  /** 站名（中文） */
  name: "纸上生花",
  /** 站名（拉丁字母，用在页头小字与 RSS） */
  nameEn: "Paperbloom",
  /** 副标题：出现在首页 title 里 */
  subtitle: "剪纸手记",
  /** 页头的红印章 */
  seal: "剪",
  /** 全站母题，页脚与首屏都在用 */
  tagline: "折 · 剪 · 展开 · 透光",
  /** 默认 meta description */
  description: "剪纸主题的个人博客：作品是实拍的红纸与黑纸，首屏团花与窗棂由折数、刀法算出来；昼夜两种背光，动效只有折、剪、展开、透光四种。",
  /** 换成你自己的域名，RSS 与 sitemap 会用它拼绝对地址 */
  url: "https://paperbloom.example",
  /** RSS 里的署名 */
  author: "纸上生花",
} as const;

/** 「作品 · 纸上生花」这种页面标题 */
export const pageTitle = (...parts: string[]): string => [...parts, SITE.name].join(" · ");

/** 首页标题：「纸上生花 · 剪纸手记」 */
export const homeTitle = `${SITE.name} · ${SITE.subtitle}`;
