import type { APIRoute } from 'astro';
import { getBridgeLogs, clearBridgeLogs } from '#/server/dev-log';

export const prerender = false;

export const GET: APIRoute = () =>
  Response.json({ logs: getBridgeLogs() });

export const DELETE: APIRoute = () => {
  clearBridgeLogs();
  return Response.json({ ok: true });
};
