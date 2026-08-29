import { describe, expect, it, vi } from 'vitest'
import { fetchTrainingMatches, fetchTargetMatches } from './engine'
import { prisma } from '#/db'

vi.mock('#/db', () => ({
  prisma: {
    match: {
      findMany: vi.fn(),
    },
  },
}))

describe('Prediction Engine Data Fetching', () => {
  it('fetchTrainingMatches returns matches in chronological order', async () => {
    const mockMatches = [
      { id: 1, homeTeam: 'A', awayTeam: 'B', homeScore: 1, awayScore: 0, matchDate: '2026-01-01', league: 'EPL', sport: 'football', jobId: 1, matchUrl: null, createdAt: new Date() },
      { id: 2, homeTeam: 'C', awayTeam: 'D', homeScore: 2, awayScore: 2, matchDate: '2026-01-02', league: 'EPL', sport: 'football', jobId: 1, matchUrl: null, createdAt: new Date() },
    ]
    vi.mocked(prisma.match.findMany).mockResolvedValue(mockMatches)

    const input = {
      sport: 'football',
      league: 'Premier League',
      trainingLimit: 100,
    } as any

    const result = await fetchTrainingMatches(input)

    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sport: 'football',
          league: { contains: 'Premier League' },
          homeScore: { not: null },
        }),
        orderBy: expect.arrayContaining([{ matchDate: 'asc' }]),
      })
    )
    expect(result).toEqual(mockMatches)
  })

  it('fetchTargetMatches returns future matches when targetMode is future', async () => {
    const mockMatches = [
      { id: 1, homeTeam: 'A', awayTeam: 'B', matchDate: '2026-06-01', league: 'EPL', sport: 'football', jobId: 1, matchUrl: null, homeScore: null, awayScore: null, createdAt: new Date() },
    ]
    vi.mocked(prisma.match.findMany).mockResolvedValue(mockMatches)

    const input = {
      sport: 'football',
      league: 'Premier League',
      targetMode: 'future',
      targetLimit: 10,
    } as any

    const result = await fetchTargetMatches(input)

    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          homeScore: null,
        }),
      })
    )
    expect(result).toEqual(mockMatches)
  })

  it('fetchTargetMatches returns historical matches when targetMode is history', async () => {
    const mockMatches = [
      { id: 1, homeTeam: 'A', awayTeam: 'B', matchDate: '2026-01-01', league: 'EPL', sport: 'football', jobId: 1, matchUrl: null, homeScore: 1, awayScore: 0, createdAt: new Date() },
    ]
    vi.mocked(prisma.match.findMany).mockResolvedValue(mockMatches)

    const input = {
      sport: 'football',
      league: 'Premier League',
      targetMode: 'history',
      targetLimit: 10,
    } as any

    const result = await fetchTargetMatches(input)

    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          homeScore: { not: null },
        }),
      })
    )
    expect(result).toEqual(mockMatches)
  })
})
