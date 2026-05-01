import type { APIRoute } from 'astro';
import { getQueryLogs, clearQueryLogs } from '#/server/dev-log';

export const prerender = false;

export const GET: APIRoute = () =>
  Response.json({ logs: getQueryLogs() });

export const DELETE: APIRoute = () => {
  clearQueryLogs();
  return Response.json({ ok: true });
};
