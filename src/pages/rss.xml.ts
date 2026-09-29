import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SITE } from "../config";

const escape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL(SITE.url);
  const posts = (await getCollection("posts", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  const items = posts
    .map((post) => {
      const url = new URL(`/posts/${post.id}`, base).href;
      return [
        "    <item>",
        `      <title>${escape(post.data.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${post.data.date.toUTCString()}</pubDate>`,
        `      <description>${escape(post.data.summary)}</description>`,
        ...post.data.tags.map((t) => `      <category>${escape(t)}</category>`),
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE.name} · ${SITE.subtitle}</title>
    <link>${base.href}</link>
    <description>关于折、剪、展开、透光，以及一点代码。</description>
    <language>zh-CN</language>
    <atom:link href="${new URL("/rss.xml", base).href}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
