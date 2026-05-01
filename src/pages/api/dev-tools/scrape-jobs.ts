import type { APIRoute } from 'astro';
import { prisma } from '#/db';

export const prerender = false;

export const GET: APIRoute = async () => {
  const jobs = await prisma.scrapeJob.findMany({
    orderBy: { startedAt: 'desc' },
    take: 30,
    select: {
      id: true,
      command: true,
      sport: true,
      league: true,
      date: true,
      season: true,
      status: true,
      startedAt: true,
      finishedAt: true,
    },
  });
  return Response.json({ jobs });
};
