// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['pdf-lib', 'html-to-image'],
    },
  },
});
