import { PrismaClient, Prisma } from './generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { pushQuery } from './server/dev-log';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
});

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV !== 'production';

export const prisma =
  globalThis.__prisma ||
  new PrismaClient({
    adapter,
    log: isDev ? [{ emit: 'event', level: 'query' }] : undefined,
  });

if (isDev && !globalThis.__prisma) {
  (prisma as unknown as {
    $on: (e: 'query', cb: (event: Prisma.QueryEvent) => void) => void;
  }).$on('query', (event) => {
    pushQuery({
      ts: Date.now(),
      query: event.query,
      params: event.params,
      durationMs: event.duration,
    });
  });
  globalThis.__prisma = prisma;
}
