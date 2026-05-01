import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    SERVER_URL: z.string().url().optional(),
    DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  },

  /**
   * Astro exposes only variables prefixed with `PUBLIC_` to the client.
   * https://docs.astro.build/en/guides/environment-variables/
   */
  clientPrefix: 'PUBLIC_',

  client: {
    PUBLIC_APP_TITLE: z.string().min(1).optional(),
  },

  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
