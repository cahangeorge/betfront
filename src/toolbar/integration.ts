import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export function devToolbarApps(): AstroIntegration {
  return {
    name: 'betfront-dev-toolbar',
    hooks: {
      'astro:config:setup': ({ addDevToolbarApp }) => {
        addDevToolbarApp({
          id: 'betfront-bridge-logs',
          name: 'Bridge logs',
          icon: '🐍',
          entrypoint: path.join(here, 'bridge-logs.ts'),
        });
        addDevToolbarApp({
          id: 'betfront-prisma-queries',
          name: 'Prisma queries',
          icon: '🗃️',
          entrypoint: path.join(here, 'prisma-queries.ts'),
        });
        addDevToolbarApp({
          id: 'betfront-scrape-jobs',
          name: 'Scrape jobs',
          icon: '🕸️',
          entrypoint: path.join(here, 'scrape-jobs.ts'),
        });
      },
    },
  };
}
