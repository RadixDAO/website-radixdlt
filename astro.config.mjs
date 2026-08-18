import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.radixdlt.com',
  output: 'static',
  // Webflow serves /foo, not /foo/ -- match it exactly so no URL changes at cutover.
  trailingSlash: 'never',
  build: { format: 'file' },
  // The Webflow CSS/JS is pre-built and self-consistent. Do not let Astro touch it.
  vite: { build: { assetsInlineLimit: 0 } },
});
