import type { ScoredLeg } from './types'

/** Number of leg keys (matchId|market|outcome) shared between two ticket leg lists. */
export function legOverlap(a: ScoredLeg[], b: ScoredLeg[]): number {
  const keys = new Set(a.map((l) => `${l.matchId}|${l.market}|${l.outcome}`))
  let count = 0
  for (const l of b) if (keys.has(`${l.matchId}|${l.market}|${l.outcome}`)) count += 1
  return count
}

/**
 * Pick `legsPerTicket` legs from `pool` such that no match appears twice within
 * the same ticket (one selection per match) and overlap with previously-built
 * tickets does not exceed `maxOverlap`.
 *
 * Returns null if constraints can't be met.
 */
export function pickDiverseTicket(
  pool: ScoredLeg[],
  legsPerTicket: number,
  built: ScoredLeg[][],
  maxOverlap: number,
  startOffset = 0,
): ScoredLeg[] | null {
  const usedMatches = new Set<number>()
  const picked: ScoredLeg[] = []
  // round-robin start so successive tickets use different "best" legs
  const ordered = [...pool.slice(startOffset), ...pool.slice(0, startOffset)]

  for (const leg of ordered) {
    if (picked.length >= legsPerTicket) break
    if (usedMatches.has(leg.matchId)) continue
    // tentative add — check overlap constraints
    const tentative = [...picked, leg]
    const ok = built.every((existing) => legOverlap(existing, tentative) <= maxOverlap)
    if (!ok) continue
    picked.push(leg)
    usedMatches.add(leg.matchId)
  }

  return picked.length === legsPerTicket ? picked : null
}
