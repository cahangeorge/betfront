import { z } from 'zod'
import { prisma } from '#/db'

const computeSchema = z.object({
  league: z.string().optional(),
  market: z.string().default('1x2'),
  lookbackDays: z.number().int().min(1).max(3650).default(365),
  minSamples: z.number().int().min(1).max(1000).default(10),
})

export type BrierScore = {
  modelKey: string
  league: string | null
  market: string
  meanBrier: number
  sampleCount: number
}

/**
 * Compute mean Brier score for each modelKey from settled matches.
 * Uses 1x2 market (3-outcome) by default; computes vector Brier
 * = sum_o (p_o - 1[outcome=o])^2 averaged over matches.
 *
 * Only ModelPrediction rows whose Match has homeScore + awayScore set
 * are included. Rows are grouped by (modelKey, league) so per-league
 * weighting is possible.
 */
export async function computeBrierScores(_input: unknown): Promise<BrierScore[]> {
  const data = computeSchema.parse(_input ?? {})
  const since = new Date(Date.now() - data.lookbackDays * 24 * 60 * 60 * 1000)

  const rows = await prisma.modelPrediction.findMany({
    where: {
      market: data.market,
      createdAt: { gte: since },
      run: {
        source: 'single',
        status: 'success',
        ...(data.league ? { league: { contains: data.league } } : {}),
      },
      match: { homeScore: { not: null }, awayScore: { not: null } },
    },
    select: {
      modelKey: true,
      matchId: true,
      outcome: true,
      probability: true,
      match: { select: { homeScore: true, awayScore: true, league: true } },
    },
    take: 50_000,
  })

  type GroupKey = string // `${modelKey}|${league ?? '*'}`
  type MatchAcc = {
    hs: number
    as: number
    league: string | null
    probs: Record<string, number>
  }
  const groups = new Map<GroupKey, Map<number, MatchAcc>>()

  for (const r of rows) {
    const lg = r.match.league
    const key: GroupKey = `${r.modelKey}|${lg ?? '*'}`
    let byMatch = groups.get(key)
    if (!byMatch) {
      byMatch = new Map()
      groups.set(key, byMatch)
    }
    let acc = byMatch.get(r.matchId)
    if (!acc) {
      acc = {
        hs: r.match.homeScore!,
        as: r.match.awayScore!,
        league: lg,
        probs: {},
      }
      byMatch.set(r.matchId, acc)
    }
    acc.probs[r.outcome] = r.probability
  }

  const isThreeWay = data.market === '1x2'
  const results: BrierScore[] = []

  for (const [groupKey, byMatch] of groups) {
    const [modelKey, leagueKey] = groupKey.split('|')
    let sumBrier = 0
    let count = 0

    for (const v of byMatch.values()) {
      let brier: number
      if (isThreeWay) {
        if (v.probs.home == null || v.probs.draw == null || v.probs.away == null) continue
        const actual = v.hs > v.as ? [1, 0, 0] : v.hs === v.as ? [0, 1, 0] : [0, 0, 1]
        brier =
          Math.pow(v.probs.home - actual[0], 2) +
          Math.pow(v.probs.draw - actual[1], 2) +
          Math.pow(v.probs.away - actual[2], 2)
      } else {
        // Two-way (BTTS / OU): outcomes yes/no or over/under.
        const totalGoals = v.hs + v.as
        let pos: number | undefined
        let neg: number | undefined
        let actualPos: number
        if (data.market === 'btts') {
          pos = v.probs.yes
          neg = v.probs.no
          actualPos = v.hs > 0 && v.as > 0 ? 1 : 0
        } else if (data.market.startsWith('ou_')) {
          const line = parseFloat(data.market.slice(3).replace('_', '.'))
          pos = v.probs.over
          neg = v.probs.under
          actualPos = totalGoals > line ? 1 : 0
        } else {
          continue
        }
        if (pos == null || neg == null) continue
        brier =
          Math.pow(pos - actualPos, 2) + Math.pow(neg - (1 - actualPos), 2)
      }
      sumBrier += brier
      count += 1
    }

    if (count >= data.minSamples) {
      results.push({
        modelKey,
        league: leagueKey === '*' ? null : leagueKey,
        market: data.market,
        meanBrier: sumBrier / count,
        sampleCount: count,
      })
    }
  }

  results.sort((a, b) => a.meanBrier - b.meanBrier)
  return results
}

const weightsSchema = z.object({
  league: z.string().optional(),
  market: z.string().default('1x2'),
  modelKeys: z.array(z.string()).min(1),
  lookbackDays: z.number().int().min(1).max(3650).default(365),
  minSamples: z.number().int().min(1).max(1000).default(10),
})

export type EnsembleWeights = {
  weights: Record<string, number>
  scores: Record<string, { meanBrier: number; sampleCount: number } | null>
  fellBackToUniform: boolean
}

/**
 * Inverse-Brier weighting normalised to sum=1.
 * Models without enough samples get the median weight as a soft fallback;
 * if NO model has enough samples, all weights are uniform.
 */
export async function computeEnsembleWeights(_input: unknown): Promise<EnsembleWeights> {
  const data = weightsSchema.parse(_input)
  const scores = await computeBrierScores({
    league: data.league,
    market: data.market,
    lookbackDays: data.lookbackDays,
    minSamples: data.minSamples,
  })

  // Aggregate per modelKey across leagues (mean of mean-Brier).
  const perModel = new Map<string, { sumBrier: number; sumCount: number }>()
  for (const s of scores) {
    const e = perModel.get(s.modelKey) ?? { sumBrier: 0, sumCount: 0 }
    // weight by sampleCount when collapsing leagues
    e.sumBrier += s.meanBrier * s.sampleCount
    e.sumCount += s.sampleCount
    perModel.set(s.modelKey, e)
  }

  const out: EnsembleWeights = { weights: {}, scores: {}, fellBackToUniform: false }
  const inverse: Record<string, number> = {}
  let allMissing = true

  for (const k of data.modelKeys) {
    const e = perModel.get(k)
    if (e && e.sumCount > 0) {
      const meanBrier = e.sumBrier / e.sumCount
      inverse[k] = 1 / (meanBrier + 1e-3)
      out.scores[k] = { meanBrier, sampleCount: e.sumCount }
      allMissing = false
    } else {
      inverse[k] = 0
      out.scores[k] = null
    }
  }

  if (allMissing) {
    const w = 1 / data.modelKeys.length
    for (const k of data.modelKeys) out.weights[k] = w
    out.fellBackToUniform = true
    return out
  }

  // Soft fallback: assign median inverse-weight to missing models.
  const present = Object.values(inverse).filter((v) => v > 0).sort((a, b) => a - b)
  const median = present.length === 0
    ? 1
    : present.length % 2
      ? present[(present.length - 1) >> 1]
      : (present[present.length / 2 - 1] + present[present.length / 2]) / 2
  for (const k of data.modelKeys) {
    if (inverse[k] === 0) inverse[k] = median
  }

  const total = Object.values(inverse).reduce((a, b) => a + b, 0)
  for (const k of data.modelKeys) out.weights[k] = inverse[k] / total

  return out
}
