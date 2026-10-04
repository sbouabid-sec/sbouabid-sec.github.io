import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The production GitHub Pages URL; SITE_URL can override it for a future domain.
export default defineConfig({
  site: process.env.SITE_URL || 'https://sbouabid-sec.github.io',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-default' },
    },
  },
});
