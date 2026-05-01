import type { GenerateBatchInput, LegCandidate, ScoredLeg, Strategy } from './types'

/**
 * Score legs per strategy. Higher score = preferred.
 * Returns a NEW sorted array; does not mutate input.
 */
export function scoreLegs(strategy: Strategy, legs: LegCandidate[], input: GenerateBatchInput): ScoredLeg[] {
  const scored: ScoredLeg[] = legs.map((l) => ({ ...l, score: 0 }))

  switch (strategy) {
    case 'highest-prob':
      for (const l of scored) l.score = l.modelProb
      break
    case 'highest-odds':
      for (const l of scored) l.score = l.odds
      break
    case 'highest-ev':
      for (const l of scored) l.score = l.ev
      break
    case 'value':
      for (const l of scored) {
        l.score = l.edge >= input.edgeThreshold ? l.edge : -1
      }
      break
    case 'kelly': {
      // Kelly fraction f* = (b·p − q) / b, where b = odds−1, q = 1−p
      for (const l of scored) {
        const b = l.odds - 1
        const f = b > 0 ? (b * l.modelProb - (1 - l.modelProb)) / b : -1
        l.score = Math.max(0, Math.min(input.kellyCap, f))
      }
      break
    }
    case 'edge-conf':
      for (const l of scored) l.score = Math.max(0, l.edge) * l.modelProb
      break
    case 'weighted-rand': {
      // softmax(EV / T) sampling weight
      const T = Math.max(0.05, input.randomTemperature)
      const exps = scored.map((l) => Math.exp(l.ev / T))
      const sum = exps.reduce((a, b) => a + b, 0) || 1
      for (let i = 0; i < scored.length; i++) {
        // jitter so equal weights still produce ordering variation
        scored[i].score = (exps[i] / sum) * (0.5 + Math.random())
      }
      break
    }
    case 'arbitrage':
      // Single-bookmaker leg can't arbitrage; just rank by lowest implied prob spread.
      // Real cross-book arb is handled by strategies/arbitrage.ts.
      for (const l of scored) l.score = l.ev
      break
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.filter((l) => l.score > -0.5)
}
