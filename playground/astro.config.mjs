import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  site: 'https://frankkilcommins.github.io',
  base: '/arazzo2openapi',
  build: {
    assets: '_astro',
  },
  vite: {
    resolve: {
      alias: {
        'arazzo2openapi': resolve(__dirname, '../src/index.ts'),
      },
    },
  },
});
