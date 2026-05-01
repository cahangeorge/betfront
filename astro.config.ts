// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { devToolbarApps } from './src/toolbar/integration';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(), devToolbarApps()],
  server: { host: '0.0.0.0', port: 3000 },
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      // Native module — must not be bundled by Vite SSR
      external: ['better-sqlite3', '@prisma/client', '@prisma/adapter-better-sqlite3'],
    },
  },
});
