import { defineConfig } from 'astro/config';

export default defineConfig({
  // 换成你自己的域名：RSS 靠它拼绝对地址
  site: 'https://paperbloom.example',
  trailingSlash: 'ignore',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  build: {
    inlineStylesheets: 'auto',
  },
  devToolbar: {
    enabled: false,
  },
});
