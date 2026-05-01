import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '#/lib/query'
import {
  Button,
  Card,
  Input,
  Label,
  MultiSelect,
  Select,
  Spinner,
} from '#/components/ui'
import {
  getLeagueCatalog,
  getJobById,
  getJobOutput,
  getRunningJobs,
  cancelJob,
  runUpcoming,
  runHistoric,
  type LeagueCatalogItem,
} from '#/lib/client-actions/scraper'
import {
  getEspnSchedule,
  getSoccerDataCatalog,
  getSofascoreSchedule,
  type SoccerDataCatalog,
} from '#/lib/client-actions/soccerdata'
import {
  getPenaltyblogHistoricalMatches,
  countHistoricalMatches,
  runPenaltyblogOperation,
  type PenaltyblogHistoricalMatch,
} from '#/lib/client-actions/penaltyblog'
import {
  hydratePayloadWithHistory,
} from '#/components/penaltyblogPanel.helpers'
import {
  findValueBets,
  saveTicket,
  getPredictionLeagues,
  getMatchesForTickets,
  type ValueBet,
  type TicketSelection,
} from '#/lib/client-actions/tickets'
import { cn } from '#/lib/cn'
import { savePredictionSession } from '#/lib/client-actions/predictions'
import { OddsHarvesterFilters } from '#/components/OddsHarvesterFilters'
import {
  currentSeasonStartYear,
  seasonOptions,
  getCountryOptions,
  type MarketEntry,
} from '#/lib/oddsHarvesterShared'

// ─── Constants ────────────────────────────────────────────────────────────────

const PREDICTION_MODELS = [
  { label: 'Classic Poisson', value: 'PoissonGoalsModel' },
  { label: 'Dixon-Coles Recommended', value: 'DixonColesGoalModel' },
  { label: 'Bivariate Poisson', value: 'BivariatePoissonGoalModel' },
  { label: 'Negative Binomial', value: 'NegativeBinomialGoalModel' },
  { label: 'Zero-Inflated Poisson', value: 'ZeroInflatedPoissonGoalsModel' },
  { label: 'Weibull Copula', value: 'WeibullCopulaGoalsModel' },
  { label: 'Bayesian Dixon-Coles Slow', value: 'BayesianGoalModel' },
  { label: 'Hierarchical Bayesian Very Slow', value: 'HierarchicalBayesianGoalModel' },
]

const PREDICTION_MODEL_GROUPS = [
  {
    label: 'Fast standard models',
    options: PREDICTION_MODELS.filter((option) => [
      'PoissonGoalsModel',
      'DixonColesGoalModel',
      'BivariatePoissonGoalModel',
      'NegativeBinomialGoalModel',
      'ZeroInflatedPoissonGoalsModel',
      'WeibullCopulaGoalsModel',
    ].includes(option.value)),
  },
  {
    label: 'Advanced slow models',
    options: PREDICTION_MODELS.filter((option) => [
      'BayesianGoalModel',
      'HierarchicalBayesianGoalModel',
    ].includes(option.value)),
  },
]

const MODEL_SPEED_BADGES: Record<string, string> = {
  Fast: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Medium: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  Slow: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'Very slow': 'bg-rose-500/15 text-rose-400 border-rose-500/30',
}

const MARKET_BADGES: Record<string, string> = {
  '1X2':       'bg-sky-500/15 text-sky-400 border-sky-500/30',
  'DC':        'bg-violet-500/15 text-violet-400 border-violet-500/30',
  'DNB':       'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  'Over/Under':'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'BTTS':      'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'Asian HCP': 'bg-rose-500/15 text-rose-400 border-rose-500/30',
}

const PREDICTION_MODEL_DESCRIPTIONS: Record<string, { name: string; family: string; speed: 'Fast' | 'Medium' | 'Slow' | 'Very slow'; when: string; how: string; use: string; markets: Array<{ market: string; note: string }> }> = {
  PoissonGoalsModel: {
    name: 'Classic Poisson',
    family: 'Penaltyblog goal model',
    speed: 'Fast',
    when: 'Large dataset — want a fast, simple baseline.',
    how: 'Models home and away goals as independent Poisson processes fit from historical goal counts.',
    use: 'Sanity-check or default starting point. Works across any league.',
    markets: [
      { market: '1X2',       note: 'Reliable in balanced matches; slightly underestimates home wins in lopsided games.' },
      { market: 'DC',        note: 'Derived by summing 1X2 pairs — accurate but inherits any 1X2 bias.' },
      { market: 'DNB',       note: 'Derived from 1X2 — accurate but carries the same home-win bias.' },
      { market: 'Over/Under',note: 'Tends to over-estimate Over 2.5% in low-scoring leagues; all scorelines weighted equally.' },
      { market: 'BTTS',      note: 'Accurate when both teams score regularly; weaker for very defensive sides.' },
      { market: 'Asian HCP', note: 'Consistent ±2–3% error; safe for favourites, less reliable for heavy underdogs.' },
    ],
  },
  DixonColesGoalModel: {
    name: 'Dixon-Coles Recommended',
    family: 'Penaltyblog goal model',
    speed: 'Fast',
    when: 'General-purpose predictions. Recommended default.',
    how: 'Extends Poisson with a low-score correction for 0-0, 1-0, 0-1 and 1-1 results.',
    use: 'Realistic scoreline probabilities and reliable market odds across top and mid-level leagues.',
    markets: [
      { market: '1X2',       note: 'Most accurate — low-score fix raises Draw % and lowers Home Win % by ~2–4% vs plain Poisson.' },
      { market: 'DC',        note: 'Highly reliable; 1X and X2 % boosted correctly where draws are likely.' },
      { market: 'DNB',       note: 'Small uplift for home/away win % at the expense of the draw being discounted.' },
      { market: 'Over/Under',note: 'Well-calibrated; 0-0 and 1-0 no longer underweighted, so all Over/Under lines are reliable.' },
      { market: 'BTTS',      note: 'Slightly lower Yes % than plain Poisson, matching observed BTTS rates better.' },
      { market: 'Asian HCP', note: 'Most trustworthy for HCP markets; ±0.5 percentages close to bookmaker implied probs.' },
    ],
  },
  BivariatePoissonGoalModel: {
    name: 'Bivariate Poisson',
    family: 'Penaltyblog goal model',
    speed: 'Medium',
    when: 'Home and away goals are correlated (e.g. attack-heavy derbies).',
    how: 'Models goals jointly with a shared Poisson component capturing within-match synergy.',
    use: 'Cup games or high-profile matches where both teams pressing strongly skews the distribution.',
    markets: [
      { market: '1X2',       note: 'Draw % often 1–3% lower than Dixon-Coles; probability shifts toward high-scoring outcomes.' },
      { market: 'DC',        note: '12 (home-or-away) % tends to be elevated, reflecting attacks cancelling each other.' },
      { market: 'DNB',       note: 'Home/away win % slightly inflated vs a plain model.' },
      { market: 'Over/Under',note: 'Over 2.5/3.5 notably higher when both teams attack strongly — best for high-tempo derby Over bets.' },
      { market: 'BTTS',      note: 'Most generous Yes % of all models; use with care in one-sided matches.' },
      { market: 'Asian HCP', note: 'Less reliable for defensive teams; can over-price the favourite.' },
    ],
  },
  NegativeBinomialGoalModel: {
    name: 'Negative Binomial',
    family: 'Penaltyblog goal model',
    speed: 'Medium',
    when: 'Leagues with high goal variance or small history datasets.',
    how: 'Replaces Poisson with a Negative Binomial distribution that allows over-dispersion (variance > mean).',
    use: 'When Poisson or Dixon-Coles produces overconfident probabilities for over/under markets.',
    markets: [
      { market: '1X2',       note: 'Close to Dixon-Coles; Draw % slightly wider as variance spreads probability across more scorelines.' },
      { market: 'DC',        note: 'Reliable, particularly when the league has many unexpected results.' },
      { market: 'DNB',       note: 'Home/away win % slightly diluted by the broader score distribution.' },
      { market: 'Over/Under',note: 'Wider spreads — Under 2.5 and Over 3.5 both get a boost; avoids overconfident Over 2.5 readings.' },
      { market: 'BTTS',      note: 'Yes % more conservative than Poisson; extra variance goes to 0-goal outcomes.' },
      { market: 'Asian HCP', note: 'Safer for volatile leagues; spreads % more evenly between HCP outcomes.' },
    ],
  },
  ZeroInflatedPoissonGoalsModel: {
    name: 'Zero-Inflated Poisson',
    family: 'Penaltyblog goal model',
    speed: 'Medium',
    when: 'Defensive leagues or cup competitions with many 0-0 draws.',
    how: 'Adds extra probability mass at zero on top of Poisson, modelling goalless matches far more reliably.',
    use: 'When Under 1.5 goals or 0-0 correct-score bets are the main focus.',
    markets: [
      { market: '1X2',       note: 'Draw % significantly higher than any other model (+5–10%); Home/Away Win % proportionally reduced.' },
      { market: 'DC',        note: '1X and X2 % highest across all models — ideal for backing strong favourites who might only draw.' },
      { market: 'DNB',       note: 'Home/away win % shrinks; more probability allocated to the inflated 0-0 draw.' },
      { market: 'Over/Under',note: 'Over 1.5 lowest Yes % of all models (strong Under 1.5 signal); Over 2.5/3.5 markedly conservative.' },
      { market: 'BTTS',      note: 'Lowest Yes % of all models; BTTS No is a strong signal when this model is selected.' },
      { market: 'Asian HCP', note: 'Inflated 0-0 compresses win margins, making HCP lines less reliable — use cautiously.' },
    ],
  },
  WeibullCopulaGoalsModel: {
    name: 'Weibull Copula',
    family: 'Penaltyblog goal model',
    speed: 'Medium',
    when: 'You want a more flexible score distribution than Poisson-based models.',
    how: 'Uses Weibull goal counts plus a copula dependence structure to model scoreline shape more flexibly.',
    use: 'Alternative advanced model for matches where goal patterns look asymmetric or non-Poisson.',
    markets: [
      { market: '1X2', note: 'Can capture more nuanced win/draw splits when standard Poisson models feel too rigid.' },
      { market: 'DC', note: 'Usually solid when scoreline dependence matters more than simple goal averages.' },
      { market: 'DNB', note: 'Useful when you want a less rigid draw adjustment than standard Poisson-derived prices.' },
      { market: 'Over/Under', note: 'Often handles tail behavior better than plain Poisson, especially in uneven scoring environments.' },
      { market: 'BTTS', note: 'Can improve BTTS calibration when scoring dependence is not well explained by independence assumptions.' },
      { market: 'Asian HCP', note: 'Worth checking on complex matches, but still validate against market prices before trusting large edges.' },
    ],
  },
  BayesianGoalModel: {
    name: 'Bayesian Dixon-Coles',
    family: 'Penaltyblog Bayesian model',
    speed: 'Slow',
    when: 'You want uncertainty-aware estimates and can accept a much slower run.',
    how: 'Uses Bayesian inference and MCMC sampling instead of a single point estimate.',
    use: 'Best for deeper analysis on a small number of matches, not large batch runs.',
    markets: [
      { market: '1X2', note: 'Useful when you care about uncertainty around Home/Draw/Away probabilities, not just point estimates.' },
      { market: 'DC', note: 'More conservative where posterior uncertainty is high; helpful when draw uncertainty matters.' },
      { market: 'DNB', note: 'Can reduce overconfidence by reflecting uncertainty in underlying home/away win rates.' },
      { market: 'Over/Under', note: 'Good for comparing confidence bands, but slower than the standard models for routine totals pricing.' },
      { market: 'BTTS', note: 'Useful when BTTS edges are marginal and you want more uncertainty awareness.' },
      { market: 'Asian HCP', note: 'Better for careful analysis than fast batch screening; expect noticeably slower prediction time.' },
    ],
  },
  HierarchicalBayesianGoalModel: {
    name: 'Hierarchical Bayesian',
    family: 'Penaltyblog Bayesian model',
    speed: 'Very slow',
    when: 'You have sparse or noisy team data and want stronger regularization across the league.',
    how: 'Extends the Bayesian model with hierarchical priors so team strengths borrow information from league-wide structure.',
    use: 'Deep-dive model for very small batches where calibration matters more than speed.',
    markets: [
      { market: '1X2', note: 'Can stabilize probabilities when limited match history would otherwise produce noisy team strengths.' },
      { market: 'DC', note: 'Useful when draw/home-away uncertainty needs shrinkage rather than aggressive point estimates.' },
      { market: 'DNB', note: 'Helps avoid overreacting to small samples, especially for mid-table teams with thin data.' },
      { market: 'Over/Under', note: 'Better for careful, sparse-data analysis than fast totals screening.' },
      { market: 'BTTS', note: 'Can improve robustness in low-sample leagues, but is too slow for routine mass prediction.' },
      { market: 'Asian HCP', note: 'Only use when you intentionally want a slower, more regularized model for a few matches.' },
    ],
  },
}

const HISTORY_SOURCES = [
  { label: 'Frontbet (scraped data)', value: 'frontbet' },
  { label: 'SoccerData (MatchHistory)', value: 'soccerdata' },
]

const PREDICTION_PREP_OPTIONS = [
  { label: 'Load auto history', value: 'load-auto-history' },
  { label: 'Scrape auto fallback', value: 'scrape-auto' },
]

const MATCH_SOURCES = [
  { label: 'Frontbet DB (upcoming with odds)', value: 'frontbet' },
  { label: 'ESPN Schedule', value: 'espn' },
  { label: 'Sofascore Schedule', value: 'sofascore' },
]

const TICKET_BUILD_STRATEGIES = [
  { label: 'Chronological', value: 'chronological' },
  { label: 'Highest edge first', value: 'highest-edge-first' },
  { label: 'Balanced mix', value: 'balanced-mix' },
]

const TICKET_GENERATION_SOURCES = [
  { label: 'One best bet per match', value: 'best-per-match' },
  { label: 'Use selected value bets', value: 'selected-value-bets' },
]

const ALL_LEAGUES_VALUE = '__all__'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchHistorySeasonOptions(count = 9) {
  const y = currentSeasonStartYear() - 1
  return Array.from({ length: count }, (_, i) => {
    const start = y - (count - 1 - i)
    return {
      label: `${start}/${start + 1}`,
      value: `${String(start).slice(-2)}${String(start + 1).slice(-2)}`,
    }
  })
}

function espnSeasonOptions(count = 9) {
  const y = currentSeasonStartYear()
  return Array.from({ length: count }, (_, i) => {
    const year = y - (count - 1 - i)
    return { label: String(year), value: String(year) }
  })
}

function getSoccerdataLeagueOptions(catalog: SoccerDataCatalog) {
  // Use all league sources combined for predictions
  const all = new Map<string, string>()
  for (const l of catalog.espnLeagues) all.set(l.value, l.label)
  for (const l of catalog.matchHistoryLeagues) all.set(l.value, l.label)
  for (const l of catalog.sofascoreLeagues) all.set(l.value, l.label)
  return [...all.entries()]
    .map(([value, label]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// Static country slug → soccerdata 2-4 letter code mapping shared across the component.
const OH_TO_SD: Record<string, string> = {
  england: 'ENG', spain: 'ESP', italy: 'ITA', germany: 'GER', france: 'FRA',
  portugal: 'POR', netherlands: 'NED', scotland: 'SCO', turkey: 'TUR',
  belgium: 'BEL', russia: 'RUS', greece: 'GRE', sweden: 'SWE',
  denmark: 'DEN', norway: 'NOR', poland: 'POL', switzerland: 'SUI',
  austria: 'AUT', croatia: 'CRO', czechia: 'CZE', romania: 'ROU',
  ukraine: 'UKR', serbia: 'SRB', brazil: 'BRA', argentina: 'ARG',
  usa: 'USA', mexico: 'MEX', japan: 'JPN', china: 'CHN',
}

function getLocalLeagueQuery(league: string) {
  if (league === ALL_LEAGUES_VALUE) return ''
  return league.replace(/^[A-Z]{2,4}-/, '').trim()
}

function findOddsHarvesterLeague(league: string, catalog: LeagueCatalogItem[]): string | null {
  if (league === ALL_LEAGUES_VALUE) return null
  const leagueName = getLocalLeagueQuery(league).toLowerCase()
  const match = catalog.find(
    (item) =>
      item.sport === 'football' &&
      item.leagueLabel.toLowerCase() === leagueName,
  )
  if (match) return match.league
  // Fuzzy: check if slug contains all words from the league name
  const words = leagueName.split(/\s+/)
  return (
    catalog.find(
      (item) =>
        item.sport === 'football' &&
        words.every((w) => item.league.includes(w.toLowerCase())),
    )?.league ?? null
  )
}

function getMatchTimestamp(date: string) {
  const ts = Date.parse(date)
  return Number.isNaN(ts) ? null : ts
}

function isUpcomingMatch(date: string) {
  const ts = getMatchTimestamp(date)
  if (ts != null) {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    return ts >= startOfToday.getTime()
  }

  return date.slice(0, 10) >= new Date().toISOString().slice(0, 10)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Next Sunday on-or-after today (or today if today is Sunday) */
function nextSundayIso() {
  const d = new Date()
  const day = d.getDay() // 0=Sun, 1=Mon … 6=Sat
  d.setDate(d.getDate() + ((7 - day) % 7))
  return d.toISOString().slice(0, 10)
}

function isInDateRange(matchDate: string, from: string, to: string) {
  const d = matchDate.slice(0, 10)
  return d >= from && d <= to
}

type UpcomingMatch = {
  id: string
  homeTeam: string
  awayTeam: string
  date: string
  league: string
}

type PredictionPreparationMode = 'load-auto-history' | 'scrape-auto'

// ─── Active Process Tracking ──────────────────────────────────────
type ActiveProcess = {
  id: string
  label: string
  status: 'running' | 'done' | 'error'
  progress: number // 0-100
  detail?: string
  startedAt: number
}

function ProcessPanel({
  processes,
  onDismiss,
  logs,
  onClearLogs,
}: {
  processes: ActiveProcess[]
  onDismiss: (id: string) => void
  logs: string[]
  onClearLogs: () => void
}) {
  // Tick every second to update elapsed time
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    if (processes.some((p) => p.status === 'running')) {
      const iv = setInterval(() => setTick((t) => t + 1), 1000)
      return () => clearInterval(iv)
    }
  }, [processes])

  if (processes.length === 0 && logs.length === 0) return null

  return (
    <div className="sticky top-4 w-72 shrink-0 space-y-3">
      {/* Active processes */}
      {processes.length > 0 && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]">
            Active Processes
          </p>
          <div className="space-y-2.5">
            {processes.map((p) => {
              const elapsed = Math.round((Date.now() - p.startedAt) / 1000)
              const minutes = Math.floor(elapsed / 60)
              const seconds = elapsed % 60
              const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--sea-ink)]">
                      {p.status === 'running' && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--lagoon)]" />}
                      {p.status === 'done' && <span className="text-emerald-500">✓</span>}
                      {p.status === 'error' && <span className="text-red-500">✗</span>}
                      {p.label}
                    </span>
                    {p.status !== 'running' && (
                      <button
                        type="button"
                        onClick={() => onDismiss(p.id)}
                        className="text-[10px] text-[var(--sea-ink-soft)]/50 hover:text-[var(--sea-ink-soft)]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {p.status === 'running' && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--sand)]">
                      <div
                        className="h-full rounded-full bg-[var(--lagoon-deep)] transition-all duration-500"
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] text-[var(--sea-ink-soft)]">
                    <span>{p.detail || (p.status === 'running' ? 'In progress…' : p.status === 'done' ? 'Completed' : 'Failed')}</span>
                    <span>{p.status === 'running' ? `${p.progress}% · ${timeStr}` : p.status === 'done' ? '✓' : ''}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Compact log panel */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
          <div className="flex items-center justify-between px-3 pt-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]">Log</p>
            <button
              type="button"
              className="text-[10px] text-[var(--sea-ink-soft)]/50 hover:text-[var(--sea-ink-soft)]"
              onClick={onClearLogs}
            >
              Clear
            </button>
          </div>
          <LogPanel logs={logs} />
        </div>
      )}
    </div>
  )
}

type TicketBatchResult = {
  ticketIds: number[]
  generatedCount: number
  requestedCount: number
  matchesPerTicket: number
  selectedMatchesCount: number
}

type TicketBuildStrategy = 'chronological' | 'highest-edge-first' | 'balanced-mix'
type TicketGenerationSource = 'best-per-match' | 'selected-value-bets'

// ─── Log helpers ──────────────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function LogPanel({ logs }: { logs: string[] }) {
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState(160)
  const drag = React.useRef({ active: false, startY: 0, startH: 0 })

  React.useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [logs])

  function onHandleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    drag.current = { active: true, startY: e.clientY, startH: height }
    const onMove = (ev: MouseEvent) => {
      if (!drag.current.active) return
      setHeight(Math.max(60, Math.min(600, drag.current.startH + ev.clientY - drag.current.startY)))
    }
    const onUp = () => {
      drag.current.active = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (logs.length === 0) return null
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)]">
      <div
        ref={bodyRef}
        style={{ height }}
        className="overflow-y-auto bg-[var(--sand)]/60 p-2 font-mono"
      >
        {logs.map((line, i) => {
          const isError = line.toLowerCase().includes('error')
          // Parse: "<timestamp> [Tag] <message>"
          const tagMatch = line.match(/^(.+?) (\[(History|Matches)\]) (.*)$/)
          if (tagMatch) {
            const [, ts, tag, tagName, msg] = tagMatch
            return (
              <div key={i} className={`text-[11px] leading-5 ${isError ? 'text-red-400' : 'text-[var(--sea-ink-soft)]'}`}>
                <span className="opacity-50">{ts} </span>
                <span className={tagName === 'History' ? 'text-sky-400' : 'text-emerald-400'}>{tag}</span>
                {' '}{msg}
              </div>
            )
          }
          // No tag — plain log line
          return (
            <div key={i} className={`text-[11px] leading-5 ${isError ? 'text-red-400' : 'text-[var(--sea-ink-soft)]/70'}`}>
              {line}
            </div>
          )
        })}
      </div>
      <div
        onMouseDown={onHandleMouseDown}
        title="Drag to resize"
        className="flex h-3.5 cursor-row-resize select-none items-center justify-center border-t border-[var(--line)] bg-[var(--sand)] transition hover:bg-[var(--line)]/60"
      >
        <div className="h-0.5 w-10 rounded-full bg-[var(--sea-ink-soft)]/40" />
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PredictionsPanel() {
  // ─── State: Filters ─────────────────────────────────────────────
  const [sports, setSports] = React.useState<string[]>(['football'])
  const [countries, setCountries] = React.useState<string[]>([])
  const [leagues, setLeagues] = React.useState<string[]>([])
  const hasAllLeagues = leagues.includes(ALL_LEAGUES_VALUE)
  const leaguesKey = leagues.slice().sort().join('|')
  const [season, setSeason] = React.useState(`${currentSeasonStartYear()}`)

  // ─── State: History ─────────────────────────────────────────────
  const [historySource, setHistorySource] = React.useState<'frontbet' | 'soccerdata'>('frontbet')
  const [historySeason, setHistorySeason] = React.useState(
    `${String(currentSeasonStartYear() - 1).slice(-2)}${String(currentSeasonStartYear()).slice(-2)}`,
  )
  const [historySeasons, setHistorySeasons] = React.useState<string[]>([
    `${String(currentSeasonStartYear() - 1).slice(-2)}${String(currentSeasonStartYear()).slice(-2)}`,
  ])
  const [historyLimit, setHistoryLimit] = React.useState('200')
  const [historyYears, setHistoryYears] = React.useState('2')
  const [historyMonths, setHistoryMonths] = React.useState('')
  const [historyWeeks, setHistoryWeeks] = React.useState('')
  const [historyDays, setHistoryDays] = React.useState('')
  const historyDateTo = React.useMemo(() => new Date().toISOString().slice(0, 10), [])
  const historyDateFrom = React.useMemo(() => {
    const d = new Date()
    if (historyYears) d.setFullYear(d.getFullYear() - Number(historyYears))
    if (historyMonths) d.setMonth(d.getMonth() - Number(historyMonths))
    if (historyWeeks) d.setDate(d.getDate() - Number(historyWeeks) * 7)
    if (historyDays) d.setDate(d.getDate() - Number(historyDays))
    return d.toISOString().slice(0, 10)
  }, [historyYears, historyMonths, historyWeeks, historyDays])
  const [historyDbCount, setHistoryDbCount] = React.useState<number | null>(null)
  const [history, setHistory] = React.useState<PenaltyblogHistoricalMatch[]>([])
  const [processLogs, setProcessLogs] = React.useState<string[]>([])
  const [marketEntries, setMarketEntries] = React.useState<MarketEntry[]>([
    { value: '1x2', period: 'all' },
    { value: 'btts', period: 'all' },
    { value: 'double_chance', period: 'all' },
    { value: 'dnb', period: 'all' },
  ])
  const scrapeMarketsString = React.useMemo(
    () => marketEntries.map((e) => e.value).join(','),
    [marketEntries],
  )
  const [scrapeHistoricProgress, setScrapeHistoricProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [scrapeOddsProgress, setScrapeOddsProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [activeProcesses, setActiveProcesses] = React.useState<ActiveProcess[]>([])
  const activeProcessesRef = React.useRef<ActiveProcess[]>([])
  activeProcessesRef.current = activeProcesses

  const upsertProcess = React.useCallback((id: string, patch: Partial<ActiveProcess>) => {
    setActiveProcesses((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      if (idx === -1) return prev
      const updated = [...prev]
      updated[idx] = { ...updated[idx], ...patch }
      return updated
    })
  }, [])

  const addProcess = React.useCallback((proc: ActiveProcess) => {
    setActiveProcesses((prev) => [...prev, proc])
  }, [])

  const dismissProcess = React.useCallback((id: string) => {
    setActiveProcesses((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const [historyAutoLoadedForLeague, setHistoryAutoLoadedForLeague] = React.useState<string | null>(null)
  const [predictionPreparationMode, setPredictionPreparationMode] = React.useState<PredictionPreparationMode>('scrape-auto')

  // ─── State: Matches ─────────────────────────────────────────────
  const [matchSource, setMatchSource] = React.useState('frontbet')
  const [matchUpcomingOnly, setMatchUpcomingOnly] = React.useState(true)
  const [matchDateFrom, setMatchDateFrom] = React.useState(todayIso)
  const [matchDateTo, setMatchDateTo] = React.useState(nextSundayIso)
  const [upcomingMatches, setUpcomingMatches] = React.useState<UpcomingMatch[]>([])
  const [selectedMatches, setSelectedMatches] = React.useState<string[]>([])
  const [showOnlyInRange, setShowOnlyInRange] = React.useState(false)
  const [matchesAutoLoadedForLeague, setMatchesAutoLoadedForLeague] = React.useState<string | null>(null)

  // Derived: visible matches respecting the "in range only" filter
  const visibleMatches = React.useMemo(
    () =>
      upcomingMatches.filter((m) => {
        if (!showOnlyInRange) return true
        return isInDateRange(m.date, matchDateFrom, matchDateTo) && isUpcomingMatch(m.date)
      }),
    [upcomingMatches, showOnlyInRange, matchDateFrom, matchDateTo],
  )
  const allVisibleSelected = visibleMatches.length > 0 && visibleMatches.every((m) => selectedMatches.includes(m.id))
  const someVisibleSelected = visibleMatches.some((m) => selectedMatches.includes(m.id))

  // ─── State: Prediction ──────────────────────────────────────────
  const [model, setModel] = React.useState('DixonColesGoalModel')
  const [predictions, setPredictions] = React.useState<PredictionResult[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [periodByMatch, setPeriodByMatch] = React.useState<Record<number, 'ft' | '1h' | '2h'>>({})

  // ─── State: Ticket Generation ────────────────────────────────────
  const qc = useQueryClient()
  const [valueBets, setValueBets] = React.useState<ValueBet[]>([])
  const [minEdgePct, setMinEdgePct] = React.useState('3')
  const [selectedBetKeys, setSelectedBetKeys] = React.useState<Set<string>>(new Set())
  const [tkName, setTkName] = React.useState('')
  const [tkStake, setTkStake] = React.useState('10')
  const [tkCurrency, setTkCurrency] = React.useState('€')
  const [tkSavedId, setTkSavedId] = React.useState<number | null>(null)
  const [selectedCandidateKeys, setSelectedCandidateKeys] = React.useState<Set<string>>(new Set())
  const [generateTicketsEnabled, setGenerateTicketsEnabled] = React.useState(false)
  const [ticketCount, setTicketCount] = React.useState('2')
  const [matchesPerTicket, setMatchesPerTicket] = React.useState('4')
  const [ticketBuildStrategy, setTicketBuildStrategy] = React.useState<TicketBuildStrategy>('chronological')
  const [ticketGenerationSource, setTicketGenerationSource] = React.useState<TicketGenerationSource>('best-per-match')
  const [useAllSelectedMatches, setUseAllSelectedMatches] = React.useState(false)
  const [ticketBatchResult, setTicketBatchResult] = React.useState<TicketBatchResult | null>(null)

  // ─── State: Save to History ──────────────────────────────────────
  const [historySavedId, setHistorySavedId] = React.useState<number | null>(null)
  const [isAutoSaving, setIsAutoSaving] = React.useState(false)

  // ─── Log helpers ─────────────────────────────────────────────────
  const addLog = (tag: 'History' | 'Matches', msg: string) =>
    setProcessLogs((prev) => [...prev, `${ts()} [${tag}] ${msg}`])
  const addHistoryLog = (msg: string) => addLog('History', msg)
  const addMatchLog = (msg: string) => addLog('Matches', msg)

  // ─── Shared: poll a scrape job, streaming output lines ──────────
  async function pollJob(
    jobId: number,
    maxPollMs: number,
    log: (msg: string) => void,
  ): Promise<number> {
    const start = Date.now()
    let lastOutputLen = 0
    let lastHeartbeat = Date.now()
    while (Date.now() - start < maxPollMs) {
      await new Promise((r) => setTimeout(r, 2000))
      const jobStatus = await getJobOutput({ data: jobId })
      if (!jobStatus) throw new Error('Scrape job not found')
      const currentOutput = jobStatus.output ?? ''
      if (currentOutput.length > lastOutputLen) {
        const newText = currentOutput.slice(lastOutputLen)
        lastOutputLen = currentOutput.length
        lastHeartbeat = Date.now()
        for (const raw of newText.split('\n')) {
          const line = raw.trim()
          if (!line) continue
          const m = line.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d+ - ([\w.]+) - \w+ - (.+)$/)
          log(m ? `[${m[1]}] ${m[2]}` : line)
        }
      } else if (Date.now() - lastHeartbeat >= 8000) {
        lastHeartbeat = Date.now()
        log(`Running… ${Math.round((Date.now() - start) / 1000)}s elapsed`)
      }
      if (jobStatus.status === 'success') {
        const finalJob = await getJobById({ data: jobId })
        return finalJob?.matches?.length ?? 0
      }
      if (jobStatus.status === 'failed') {
        throw new Error(jobStatus.output ?? 'scrape failed')
      }
    }
    await cancelJob({ data: jobId }).catch(() => {})
    throw new Error(`Scrape timed out after ${Math.round(maxPollMs / 60000)} minutes`)
  }

  // ─── Shared: run async tasks with concurrency limit ─────────────
  async function runConcurrent<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number,
  ): Promise<T[]> {
    const results: T[] = new Array(tasks.length)
    let next = 0
    async function worker() {
      while (next < tasks.length) {
        const idx = next++
        results[idx] = await tasks[idx]()
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()))
    return results
  }

  // ─── Resume running jobs after page refresh ────────────────────
  const resumedRef = React.useRef(false)
  React.useEffect(() => {
    if (resumedRef.current) return
    resumedRef.current = true

    ;(async () => {
      try {
        const running = await getRunningJobs()
        if (!running || running.length === 0) return

        for (const job of running) {
          const procId = `job-${job.id}`
          const label = job.command === 'historic'
            ? `History: ${job.league || 'unknown'}`
            : `Odds: ${job.league || 'unknown'}`

          addProcess({
            id: procId,
            label,
            status: 'running',
            progress: 0,
            detail: 'Resumed after refresh',
            startedAt: new Date(job.startedAt).getTime(),
          })

          const logFn = (msg: string) => addLog(job.command === 'historic' ? 'History' : 'Matches', msg)

          // Resume polling in background — with progress tracking from output
          const pollWithProgress = async () => {
            const start = Date.now()
            let lastOutputLen = 0
            let lastHeartbeat = Date.now()
            let totalMatches = 0
            let processedMatches = 0

            while (Date.now() - start < 25 * 60_000) {
              await new Promise((r) => setTimeout(r, 2000))
              const jobStatus = await getJobOutput({ data: job.id })
              if (!jobStatus) throw new Error('Scrape job not found')

              const currentOutput = jobStatus.output ?? ''
              if (currentOutput.length > lastOutputLen) {
                const newText = currentOutput.slice(lastOutputLen)
                lastOutputLen = currentOutput.length
                lastHeartbeat = Date.now()

                for (const raw of newText.split('\n')) {
                  const line = raw.trim()
                  if (!line) continue
                  const m = line.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d+ - ([\w.]+) - \w+ - (.+)$/)
                  logFn(m ? `[${m[1]}] ${m[2]}` : line)

                  // Parse progress from output
                  const totalMatch = line.match(/Total unique matches to process:\s*(\d+)/)
                  if (totalMatch) totalMatches = parseInt(totalMatch[1], 10)
                  const scrapedMatch = line.match(/Successfully scraped match/)
                  if (scrapedMatch) processedMatches++
                }

                if (totalMatches > 0) {
                  const pct = Math.min(99, Math.round((processedMatches / totalMatches) * 100))
                  upsertProcess(procId, { progress: pct, detail: `${processedMatches}/${totalMatches} matches` })
                }
              } else if (Date.now() - lastHeartbeat >= 8000) {
                lastHeartbeat = Date.now()
                logFn(`Running… ${Math.round((Date.now() - start) / 1000)}s elapsed`)
              }

              if (jobStatus.status === 'success') {
                const finalJob = await getJobById({ data: job.id })
                return finalJob?.matches?.length ?? 0
              }
              if (jobStatus.status === 'failed') {
                throw new Error(jobStatus.output?.slice(-200) ?? 'scrape failed')
              }
            }
            await cancelJob({ data: job.id }).catch(() => {})
            throw new Error('Timed out after 25 minutes')
          }

          pollWithProgress()
            .then((matchCount) => {
              upsertProcess(procId, { status: 'done', progress: 100, detail: `${matchCount} matches` })
              logFn(`✓ ${job.league || 'Job'} finished — ${matchCount} matches`)
            })
            .catch((err) => {
              upsertProcess(procId, { status: 'error', detail: err instanceof Error ? err.message : 'Failed' })
              logFn(`Error: ${err instanceof Error ? err.message : 'Failed'}`)
            })
        }
      } catch {
        // non-critical
      }
    })()
  }, [])

  const saveHistoryMut = useMutation({
    mutationFn: async () => {
      const successPreds = predictions.filter((p) => !p.error)
      return savePredictionSession({
        data: {
          league: leagues.join(', ') || 'Unknown',
          source: 'penaltyblog',
          model,
          predictions: successPreds.map((p) => ({
            homeTeam: p.match.homeTeam,
            awayTeam: p.match.awayTeam,
            matchDate: p.match.date ?? null,
            league: p.match.league ?? null,
            homeWinProb: p.homeWin,
            drawProb: p.draw,
            awayWinProb: p.awayWin,
            predictedGoalsHome: p.homeGoalExp,
            predictedGoalsAway: p.awayGoalExp,
            dc1X: p.dc1X,
            dcX2: p.dcX2,
            dc12: p.dc12,
            dnbHome: p.dnbHome,
            dnbAway: p.dnbAway,
            over15: p.over15,
            under15: p.under15,
            over25: p.over25,
            under25: p.under25,
            over35: p.over35,
            under35: p.under35,
            bttsYes: p.bttsYes,
            bttsNo: p.bttsNo,
            ahHome: p.ahHome,
            ahAway: p.ahAway,
            predictedOutcome:
              p.homeWin != null && p.draw != null && p.awayWin != null
                ? p.homeWin >= p.draw && p.homeWin >= p.awayWin
                  ? '1'
                  : p.awayWin >= p.draw
                    ? '2'
                    : 'X'
                : null,
            confidence:
              p.homeWin != null && p.draw != null && p.awayWin != null
                ? Math.max(p.homeWin, p.draw, p.awayWin)
                : null,
          })),
        },
      })
    },
    onSuccess: (res) => {
      setHistorySavedId(res.sessionId)
      qc.invalidateQueries({ queryKey: ['prediction-sessions'] })
    },
  })

  // ─── Queries ────────────────────────────────────────────────────
  const catalogQ = useQuery({
    queryKey: ['league-catalog'],
    queryFn: () => getLeagueCatalog(),
    staleTime: 10 * 60_000,
  })
  const sdCatalogQ = useQuery({
    queryKey: ['soccerdata-catalog'],
    queryFn: () => getSoccerDataCatalog(),
    staleTime: 10 * 60_000,
  })
  const localLeagueQ = useQuery({
    queryKey: ['prediction-local-leagues'],
    queryFn: () => getPredictionLeagues(),
    staleTime: 60_000,
  })

  const ohCatalog = catalogQ.data ?? []
  const sdCatalog = sdCatalogQ.data
  const localLeagues = localLeagueQ.data ?? []

  const countryOptions = getCountryOptions(sports, ohCatalog)
  const leagueOptions = React.useMemo(() => {
    const merged = new Map<string, string>()

    if (sdCatalog) {
      for (const option of getSoccerdataLeagueOptions(sdCatalog)) {
        merged.set(option.value, option.label)
      }
    }

    for (const leagueName of localLeagues) {
      merged.set(leagueName, merged.get(leagueName) ?? leagueName)
    }

    // Add OddsHarvester catalog leagues not already covered by soccerdata.
    // This ensures leagues like "Championship", "League One" etc. appear when
    // their country is selected, even if soccerdata's LEAGUE_DICT doesn't list them.
    // Known abbreviations that should stay uppercase in league names
    const UPPERCASE_ABBREVS = new Set(['fa', 'atp', 'wta', 'nba', 'nfl', 'mls', 'dfb', 'nhl', 'khl', 'npl', 'wsl', 'u18', 'u21', 'u23'])
    const slugToTitle = (s: string) =>
      s.split('-').filter(Boolean).map((part) => {
        const lower = part.toLowerCase()
        return UPPERCASE_ABBREVS.has(lower) ? lower.toUpperCase() : lower.charAt(0).toUpperCase() + lower.slice(1)
      }).join(' ')
    for (const item of ohCatalog) {
      if (item.sport !== 'football') continue
      const sdCode = OH_TO_SD[item.country]
      // Use urlLeague (e.g. "championship") not leagueLabel ("England Championship")
      const leagueSlug = item.urlLeague || item.league.replace(new RegExp(`^${item.country}-`), '')
      const leagueTitle = slugToTitle(leagueSlug)
      const value = sdCode ? `${sdCode}-${leagueTitle}` : item.league
      if (!merged.has(value)) merged.set(value, value)
    }

    return [
      { value: ALL_LEAGUES_VALUE, label: 'All leagues (Frontbet DB)' },
      ...[...merged.entries()]
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    ]
  }, [localLeagues, ohCatalog, sdCatalog])

  // Set of league values that are compatible with the soccerdata bridge (espn/sofascore).
  const sdLeagueValues = React.useMemo(
    () => new Set(sdCatalog ? getSoccerdataLeagueOptions(sdCatalog).map((l) => l.value) : []),
    [sdCatalog],
  )

  // Filter league options by selected countries using OddsHarvester catalog
  // Filter league options by selected countries using OddsHarvester catalog.
  //
  // Two-pronged strategy:
  // 1. Soccerdata-prefixed options ("ENG-Premier League", "GER-Bundesliga", …):
  //    use a hard-coded code→country map so that e.g. selecting Austria does NOT
  //    pull in "GER-Bundesliga" just because both countries share the slug "bundesliga".
  // 2. DB options (no prefix): match against the OddsPortal URL-path league slug
  //    (`item.urlLeague`, stored as pathname[2] of the oddsportal URL), which is
  //    more precise than the dict-key slug. E.g. "brazil-serie-a" uses dict key
  //    "serie-a" but the actual URL is "serie-a-betano", matching "Serie A Betano".
  const filteredLeagueOptions = React.useMemo(() => {
    if (countries.length === 0) return leagueOptions

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

    // Soccerdata country-code prefix → OddsHarvester country slug.
    // Expanded to cover all countries from OH_TO_SD so their leagues
    // appear correctly when a country filter is active.
    const SD_CODE_TO_OH_COUNTRY: Record<string, string> = {
      ENG: 'england', ESP: 'spain', ITA: 'italy', GER: 'germany', FRA: 'france',
      POR: 'portugal', NED: 'netherlands', SCO: 'scotland', TUR: 'turkey',
      BEL: 'belgium', RUS: 'russia', GRE: 'greece', SWE: 'sweden',
      DEN: 'denmark', NOR: 'norway', POL: 'poland', SUI: 'switzerland',
      AUT: 'austria', CRO: 'croatia', CZE: 'czechia', ROU: 'romania',
      UKR: 'ukraine', SRB: 'serbia', BRA: 'brazil', ARG: 'argentina',
      USA: 'usa', MEX: 'mexico', JPN: 'japan', CHN: 'china',
    }

    // Build normalised set from the OddsPortal URL path slug (urlLeague) for the
    // selected countries. Also include the dict-key slug as a fallback for any
    // catalog entries where urlLeague is empty or identical.
    const matchingNorm = new Set<string>()
    for (const item of ohCatalog) {
      if (item.sport !== 'football' || !countries.includes(item.country)) continue
      if (item.urlLeague) matchingNorm.add(normalize(item.urlLeague))
      // fallback: dict key minus country prefix (e.g. "laliga" from "spain-laliga")
      const countryPrefix = item.country + '-'
      const keySlug = item.league.startsWith(countryPrefix)
        ? item.league.slice(countryPrefix.length)
        : item.league
      matchingNorm.add(normalize(keySlug))
    }

    return leagueOptions.filter((l) => {
      if (l.value === ALL_LEAGUES_VALUE) return true

      const prefixMatch = l.label.match(/^([A-Z]{2,4})-/)
      if (prefixMatch) {
        const code = prefixMatch[1]
        const ohCountry = SD_CODE_TO_OH_COUNTRY[code]
        if (ohCountry) {
          // Strict: only show this soccerdata entry for the explicitly mapped country.
          // This prevents e.g. "GER-Bundesliga" from appearing when Austria is selected.
          return countries.includes(ohCountry)
        }
        // INT-* and any unrecognised codes fall through to slug matching below.
      }

      // For DB entries (no prefix) and unrecognised-prefix entries:
      // match against the normalised URL-slug set built above.
      const stripped = l.label.replace(/^[A-Z]{2,4}-/, '').trim()
      return matchingNorm.has(normalize(stripped)) || matchingNorm.has(normalize(l.label))
    })
  }, [countries, leagueOptions, ohCatalog])

  // One "All [Country] leagues" convenience option per selected country.
  const countryGroupOptions = React.useMemo(() => {
    if (countries.length === 0) return []
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
    return countries
      .filter((c) => OH_TO_SD[c])
      .map((c) => ({ value: `__country_${c}__`, label: `All ${capitalize(c)} leagues` }))
  }, [countries])

  // Grouped league options: "Select by country", "Featured" (All), "Classic" (soccerdata-compatible), "Extended" (OH-only).
  const filteredLeagueOptionGroups = React.useMemo(() => {
    const allLeaguesOpts = filteredLeagueOptions.filter((l) => l.value === ALL_LEAGUES_VALUE)
    const sdOpts = filteredLeagueOptions.filter((l) => l.value !== ALL_LEAGUES_VALUE && sdLeagueValues.has(l.value))
    const ohOpts = filteredLeagueOptions.filter((l) => l.value !== ALL_LEAGUES_VALUE && !sdLeagueValues.has(l.value))
    return [
      ...(countryGroupOptions.length ? [{ label: 'Select by country', options: countryGroupOptions }] : []),
      ...(allLeaguesOpts.length ? [{ label: 'Featured', options: allLeaguesOpts }] : []),
      ...(sdOpts.length ? [{ label: 'Classic (Soccerdata — history + schedule)', options: sdOpts }] : []),
      ...(ohOpts.length ? [{ label: 'Extended (OddsHarvester — scrape only)', options: ohOpts }] : []),
    ]
  }, [filteredLeagueOptions, sdLeagueValues, countryGroupOptions])

  // When "All leagues (Frontbet DB)" is selected BUT specific countries are
  // chosen, resolve the DB league names that belong to those countries so we
  // don't accidentally load history/matches from unrelated leagues.
  const countryFilteredLocalLeagues = React.useMemo(() => {
    if (!hasAllLeagues || countries.length === 0) return null

    // OH league slugs belonging to the selected countries
    const countryOhSlugs = new Set(
      ohCatalog
        .filter((item) => item.sport === 'football' && countries.includes(item.country))
        .map((item) => item.league),
    )

    return localLeagues.filter((dbName) => {
      const lower = dbName.toLowerCase()
      const words = lower.split(/\s+/)
      // Check if any OH league from the selected countries matches this DB name
      for (const item of ohCatalog) {
        if (item.sport !== 'football' || !countryOhSlugs.has(item.league)) continue
        if (item.leagueLabel.toLowerCase() === lower) return true
        if (words.length > 0 && words.every((w) => item.league.includes(w))) return true
      }
      return false
    })
  }, [hasAllLeagues, countries, localLeagues, ohCatalog])

  // Wrap setLeagues so that clicking an "All [Country] leagues" bucket expands it
  // to all individual leagues for that country in the current filtered options.
  function handleLeagueChange(newValues: string[]) {
    const buckets = newValues.filter((v) => v.startsWith('__country_') && v.endsWith('__'))
    if (buckets.length === 0) {
      setLeagues(newValues)
      return
    }
    const base = newValues.filter((v) => !v.startsWith('__country_'))
    const expanded = [...base]
    for (const bucket of buckets) {
      const country = bucket.slice('__country_'.length, -2)
      const code = OH_TO_SD[country]
      if (!code) continue
      const prefix = `${code}-`
      for (const opt of filteredLeagueOptions) {
        if (opt.value !== ALL_LEAGUES_VALUE && opt.value.startsWith(prefix) && !expanded.includes(opt.value)) {
          expanded.push(opt.value)
        }
      }
    }
    setLeagues(expanded)
  }

  async function fetchHistoryBySource(source: 'frontbet' | 'soccerdata', leagueValue: string) {
    return getPenaltyblogHistoricalMatches({
      data: {
        source,
        sport: 'football',
        league: source === 'soccerdata' ? leagueValue : getLocalLeagueQuery(leagueValue) || undefined,
        season: source === 'soccerdata' ? historySeason : undefined,
        seasons: source === 'soccerdata' && historySeasons.length > 1 ? historySeasons : undefined,
        limit: Number(historyLimit) || 200,
        dateFrom: source === 'frontbet' ? historyDateFrom : undefined,
        dateTo: source === 'frontbet' ? historyDateTo : undefined,
        refresh: false,
      },
    }) as Promise<PenaltyblogHistoricalMatch[]>
  }

  function getSeasonForMatchSource(source: string) {
    if (source === 'espn') {
      return /^\d{4}$/.test(season) ? season : String(currentSeasonStartYear())
    }

    if (source === 'sofascore') {
      return /^\d{4}-\d{4}$/.test(season)
        ? season
        : `${currentSeasonStartYear()}-${currentSeasonStartYear() + 1}`
    }

    return season
  }

  async function fetchMatchesBySource(source: string, leagueValue: string, refresh = false) {
    if (!leagueValue && source !== 'frontbet') throw new Error('Select a league first')

    if (source === 'frontbet') {
      const res = await getMatchesForTickets({
        data: {
          sport: 'football',
          league: getLocalLeagueQuery(leagueValue) || undefined,
          upcomingOnly: matchUpcomingOnly,
        },
      })

      return res.map((match) => ({
        id: `db-${match.id}`,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        date: match.matchDate ?? '',
        league: match.league ?? getLocalLeagueQuery(leagueValue),
      }))
    }

    const sourceSeason = getSeasonForMatchSource(source)

    if (source === 'espn') {
      const res = await getEspnSchedule({
        data: { league: leagueValue, season: sourceSeason, limit: 100, refresh },
      })
      return (res.rows ?? []).map((row: any) => ({
        id: `${row.homeTeam}-vs-${row.awayTeam}-${row.date}`,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        date: row.date ?? '',
        league: row.league ?? leagueValue,
      }))
    }

    const res = await getSofascoreSchedule({
      data: { league: leagueValue, season: sourceSeason, refresh },
    })
    return (res.rows ?? []).map((row: any) => ({
      id: `${row.homeTeam ?? row.home_team}-vs-${row.awayTeam ?? row.away_team}-${row.date}`,
      homeTeam: row.homeTeam ?? row.home_team ?? '',
      awayTeam: row.awayTeam ?? row.away_team ?? '',
      date: row.date ?? '',
      league: row.league ?? leagueValue,
    }))
  }

  function sortUpcomingMatches(data: UpcomingMatch[]) {
    return [...data].sort((a, b) => {
      const aFuture = isUpcomingMatch(a.date) ? 0 : 1
      const bFuture = isUpcomingMatch(b.date) ? 0 : 1
      if (aFuture !== bFuture) return aFuture - bFuture
      return (getMatchTimestamp(a.date) ?? Number.MAX_SAFE_INTEGER)
        - (getMatchTimestamp(b.date) ?? Number.MAX_SAFE_INTEGER)
    })
  }

  function getHistorySourcesForMode() {
    if (predictionPreparationMode === 'load-auto-history') {
      return [historySource]
    }

    return [historySource, ...(!hasAllLeagues ? (['frontbet', 'soccerdata'] as const) : [])]
      .filter((source, index, all) => all.indexOf(source) === index)
  }

  function getMatchSourcesForMode() {
    if (predictionPreparationMode === 'load-auto-history') {
      return [matchSource]
    }

    return [matchSource, ...(!hasAllLeagues ? ['frontbet', 'espn', 'sofascore'] : [])]
      .filter((source, index, all) => all.indexOf(source) === index)
  }

  async function loadHistoryFromSources(sources: Array<'frontbet' | 'soccerdata'>) {
    let lastError: Error | null = null
    const effectiveLeagues = hasAllLeagues
      ? (countryFilteredLocalLeagues && countryFilteredLocalLeagues.length > 0 ? countryFilteredLocalLeagues : [''])
      : leagues

    for (const source of sources) {
      try {
        // The soccerdata source only supports leagues in the bridge LEAGUE_DICT.
        // Skip leagues the bridge would reject to avoid noisy errors.
        const sourceLeagues = source === 'frontbet'
          ? effectiveLeagues
          : effectiveLeagues.filter((l) => !l || sdLeagueValues.has(l))
        if (sourceLeagues.length === 0) continue
        const allMatches: PenaltyblogHistoricalMatch[] = []
        const results = await Promise.allSettled(
          sourceLeagues.map((leagueValue) => fetchHistoryBySource(source, leagueValue)),
        )
        for (const r of results) {
          if (r.status === 'fulfilled') allMatches.push(...r.value)
        }
        if (allMatches.length > 0) {
          return { matches: allMatches, source }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Failed to load history')
      }
    }

    if (lastError) throw lastError
    throw new Error(
      predictionPreparationMode === 'scrape-auto'
        ? 'No historical data available. Scrape completed matches or enable soccerdata fallback.'
        : 'No local historical data available for the selected source.',
    )
  }

  async function loadMatchesFromSources(sources: string[], refresh = false) {
    let lastError: Error | null = null
    const effectiveLeagues = hasAllLeagues
      ? (countryFilteredLocalLeagues && countryFilteredLocalLeagues.length > 0 ? countryFilteredLocalLeagues : [''])
      : leagues

    for (const source of sources) {
      try {
        // Non-frontbet sources (espn, sofascore) only understand soccerdata-compatible leagues.
        // Skip leagues the bridge would reject to avoid noisy errors.
        const sourceLeagues = source === 'frontbet'
          ? effectiveLeagues
          : effectiveLeagues.filter((l) => !l || sdLeagueValues.has(l))
        if (sourceLeagues.length === 0) continue
        const allMatches: UpcomingMatch[] = []
        const matchResults = await Promise.allSettled(
          sourceLeagues.map((leagueValue) => fetchMatchesBySource(source, leagueValue, refresh)),
        )
        for (const r of matchResults) {
          if (r.status === 'fulfilled') allMatches.push(...r.value)
        }
        if (allMatches.length > 0) {
          const seen = new Set<string>()
          const deduped = allMatches.filter((m) => {
            const key = `${m.homeTeam}|${m.awayTeam}|${m.date.slice(0, 16)}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          return { matches: sortUpcomingMatches(deduped), source }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Failed to load matches')
      }
    }

    if (lastError) throw lastError
    throw new Error(
      predictionPreparationMode === 'scrape-auto'
        ? 'No upcoming matches available for prediction.'
        : 'No local upcoming matches available for the selected source.',
    )
  }

  async function prepareHistoryForPrediction() {
    // In scrape-auto mode: check DB count first, auto-scrape if insufficient
    if (predictionPreparationMode === 'scrape-auto' && historySource === 'frontbet' && !hasAllLeagues && leagues.length > 0) {
      const leagueQuery = getLocalLeagueQuery(leagues[0])
      const { count } = await countHistoricalMatches({
        data: { sport: 'football', league: leagueQuery || undefined, dateFrom: historyDateFrom, dateTo: historyDateTo },
      })
      setHistoryDbCount(count)

      if (count < 30 && leagues.some((l) => findOddsHarvesterLeague(l, ohCatalog))) {
        addHistoryLog('Not enough data in DB — auto-scraping historic matches…')
        await scrapeHistoricMut.mutateAsync()
        return history
      }
    }

    const { matches, source } = await loadHistoryFromSources(getHistorySourcesForMode())
    setHistory(matches)
    setHistoryAutoLoadedForLeague(leaguesKey || null)
    addHistoryLog(
      source === 'frontbet'
        ? `Loaded ${matches.length} historical matches from frontbet automatically.`
        : `Loaded ${matches.length} historical matches from soccerdata automatically.`,
    )
    return matches
  }

  async function prepareMatchesForPrediction() {
    const { matches, source } = await loadMatchesFromSources(getMatchSourcesForMode())
    setUpcomingMatches(matches)
    setSelectedMatches(matches.filter((m) => isUpcomingMatch(m.date)).slice(0, 10).map((m) => m.id))
    setMatchesAutoLoadedForLeague(leaguesKey || null)
    addMatchLog(`Loaded ${matches.length} matches from ${source} automatically.`)
    return matches
  }

  React.useEffect(() => {
    if (!hasAllLeagues) return

    if (historySource !== 'frontbet') setHistorySource('frontbet')
    if (matchSource !== 'frontbet') setMatchSource('frontbet')
  }, [historySource, hasAllLeagues, matchSource])

  // Reset season format when match source changes
  React.useEffect(() => {
    if (matchSource === 'espn') {
      setSeason(String(currentSeasonStartYear()))
    } else if (matchSource !== 'frontbet') {
      setSeason(`${currentSeasonStartYear()}-${currentSeasonStartYear() + 1}`)
    }
  }, [matchSource])

  // ─── Load History ───────────────────────────────────────────────
  const loadHistoryMut = useMutation({
    mutationFn: async () => {
      setProcessLogs((prev) => prev.length ? [...prev, `${ts()} [History] ─── Refresh ───`] : [])
      return loadHistoryFromSources(getHistorySourcesForMode())
    },
    onSuccess: (data) => {
      const result = data as { matches: PenaltyblogHistoricalMatch[]; source: 'frontbet' | 'soccerdata' }
      setHistory(result.matches)
      setHistoryAutoLoadedForLeague(leaguesKey || null)
      addHistoryLog(`Loaded ${result.matches.length} historical matches from ${result.source}.`)
    },
    onError: (err) => {
      setHistoryAutoLoadedForLeague(leaguesKey || null)
      addHistoryLog(`Error: ${err instanceof Error ? err.message : 'Failed'}`)
    },
  })

  // ─── Check DB count when league/dates change ───────────────────
  React.useEffect(() => {
    if (leagues.length === 0 || hasAllLeagues) {
      setHistoryDbCount(null)
      return
    }
    let cancelled = false
    const checkCount = async () => {
      try {
        const leagueQuery = getLocalLeagueQuery(leagues[0])
        const { count } = await countHistoricalMatches({
          data: {
            sport: 'football',
            league: leagueQuery || undefined,
            dateFrom: historyDateFrom,
            dateTo: historyDateTo,
          },
        })
        if (!cancelled) setHistoryDbCount(count)
      } catch {
        if (!cancelled) setHistoryDbCount(null)
      }
    }
    checkCount()
    return () => { cancelled = true }
  }, [leaguesKey, historyDateFrom, historyDateTo])

  // ─── Scrape Historical Matches via OddsHarvester ───────────────
  const scrapeHistoricMut = useMutation({
    mutationFn: async () => {
      // Build a map from OH slug → original DB league name for correct count queries
      const ohLeagueToDb = new Map<string, string>()
      for (const l of leagues) {
        const oh = findOddsHarvesterLeague(l, ohCatalog)
        if (oh) ohLeagueToDb.set(oh, l)
      }
      const ohLeagues = [...ohLeagueToDb.keys()]
      if (ohLeagues.length === 0) throw new Error('No matching OddsHarvester league found.')

      // Derive ALL seasons that overlap with the selected date range
      const fromD = new Date(historyDateFrom)
      const toD = new Date(historyDateTo)
      const firstSeasonStart = fromD.getMonth() >= 6 ? fromD.getFullYear() : fromD.getFullYear() - 1
      const lastSeasonStart = toD.getMonth() >= 6 ? toD.getFullYear() : toD.getFullYear() - 1
      const ohSeasons: string[] = []
      for (let y = firstSeasonStart; y <= lastSeasonStart; y++) {
        ohSeasons.push(`${y}-${y + 1}`)
      }

      // Skip leagues that already have enough historic data (≥50 completed matches)
      const MIN_HISTORIC = 50
      const leaguesToScrape: string[] = []
      for (const ohLeague of ohLeagues) {
        const dbLeague = ohLeagueToDb.get(ohLeague) ?? ohLeague.replace(/^[a-z]+-/, '').replace(/-/g, ' ')
        const { count: existing } = await countHistoricalMatches({
          data: { sport: 'football', league: dbLeague, dateFrom: historyDateFrom, dateTo: historyDateTo },
        })
        if (existing >= MIN_HISTORIC) {
          addHistoryLog(`⏭ Skipping ${ohLeague} — already ${existing} matches in DB`)
        } else {
          leaguesToScrape.push(ohLeague)
        }
      }

      if (leaguesToScrape.length === 0) {
        addHistoryLog('✓ All leagues already have enough historic data.')
        // Reload history from DB
        const { matches } = await loadHistoryFromSources(['frontbet'])
        setHistory(matches)
        setHistoryAutoLoadedForLeague(leaguesKey || null)
        return { matchCount: 0, loadedCount: matches.length }
      }

      // Build task list: one per (league, season) pair
      const taskItems = leaguesToScrape.flatMap((ohLeague) =>
        ohSeasons.map((season) => ({ ohLeague, season })),
      )
      const totalTasks = taskItems.length

      const procId = `scrape-historic-${Date.now()}`
      addProcess({ id: procId, label: `History: ${leaguesToScrape.length} league(s) × ${ohSeasons.length} season(s)`, status: 'running', progress: 0, startedAt: Date.now() })
      addHistoryLog(`Scraping ${leaguesToScrape.length} league(s) × ${ohSeasons.length} season(s) = ${totalTasks} job(s) — seasons: ${ohSeasons.join(', ')}`)
      setScrapeHistoricProgress({ done: 0, total: totalTasks })

      let completedCount = 0
      const tasks = taskItems.map(({ ohLeague, season }) => async () => {
        addHistoryLog(`⏳ Starting ${ohLeague} (${season})…`)
        const { jobId } = await runHistoric({
          data: { sport: 'football', league: ohLeague, season, markets: scrapeMarketsString || '1x2', headless: true, previewOnly: true },
        })
        addHistoryLog(`Job #${jobId} for ${ohLeague} (${season})`)
        const count = await pollJob(jobId, 25 * 60_000, addHistoryLog)
        completedCount++
        const pct = Math.round((completedCount / totalTasks) * 100)
        setScrapeHistoricProgress({ done: completedCount, total: totalTasks })
        upsertProcess(procId, { progress: pct, detail: `${completedCount}/${totalTasks} jobs` })
        addHistoryLog(`✓ ${ohLeague} (${season}) — ${count} matches`)
        // Refresh DB count after each league completes
        const leagueQuery = getLocalLeagueQuery(leagues[0])
        const { count: freshCount } = await countHistoricalMatches({
          data: { sport: 'football', league: leagueQuery || undefined, dateFrom: historyDateFrom, dateTo: historyDateTo },
        })
        setHistoryDbCount(freshCount)
        return count
      })

      try {
        const counts = await runConcurrent(tasks, 5)
        const totalMatchCount = counts.reduce((a, b) => a + b, 0)

        // Reload history from DB
        const { matches } = await loadHistoryFromSources(['frontbet'])
        setHistory(matches)
        setHistoryAutoLoadedForLeague(leaguesKey || null)

        // Refresh DB count
        const leagueQuery = getLocalLeagueQuery(leagues[0])
        const { count } = await countHistoricalMatches({
          data: { sport: 'football', league: leagueQuery || undefined, dateFrom: historyDateFrom, dateTo: historyDateTo },
        })
        setHistoryDbCount(count)

        upsertProcess(procId, { status: 'done', progress: 100, detail: `${totalMatchCount} matches` })
        return { matchCount: totalMatchCount, loadedCount: matches.length }
      } catch (err) {
        upsertProcess(procId, { status: 'error', detail: err instanceof Error ? err.message : 'Failed' })
        throw err
      }
    },
    onSuccess: (result) => {
      setScrapeHistoricProgress(null)
      addHistoryLog(`Scraped ${result.matchCount} historic + loaded ${result.loadedCount} matches.`)
    },
    onError: (err) => {
      setScrapeHistoricProgress(null)
      addHistoryLog(`Error: ${err instanceof Error ? err.message : 'Historic scrape failed'}`)
    },
  })

  // ─── Load Upcoming Matches ─────────────────────────────────────
  const loadMatchesMut = useMutation({
    mutationFn: async (opts?: { refresh?: boolean }) =>
      loadMatchesFromSources(getMatchSourcesForMode(), opts?.refresh ?? false),
    onSuccess: (data) => {
      const result = data as { matches: UpcomingMatch[]; source: string }
      setUpcomingMatches(result.matches)
      setSelectedMatches(result.matches.filter((m) => isUpcomingMatch(m.date)).slice(0, 10).map((m) => m.id))
      setMatchesAutoLoadedForLeague(leaguesKey || null)
      addMatchLog(`Loaded ${result.matches.length} matches from ${result.source}.`)
    },
    onError: (err) => {
      setMatchesAutoLoadedForLeague(leaguesKey || null)
      addMatchLog(`Error: ${err instanceof Error ? err.message : 'Failed to load matches'}`)
    },
  })

  // ─── OddsHarvester Scrape ──────────────────────────────────────
  const scrapeOddsMut = useMutation({
    mutationFn: async () => {
      // Find OH leagues for all selected leagues
      const ohLeagues = leagues
        .map((l) => findOddsHarvesterLeague(l, ohCatalog))
        .filter((l): l is string => l != null)
      if (ohLeagues.length === 0) throw new Error('No matching OddsHarvester league found for this selection.')

      // Skip leagues that already have enough upcoming matches with odds (≥5)
      const MIN_UPCOMING = 5
      const oddsLeaguesToScrape: string[] = []
      for (const ohLeague of ohLeagues) {
        const dbLeague = ohLeague.replace(/^[a-z]+-/, '').replace(/-/g, ' ')
        const existingMatches = upcomingMatches.filter(
          (m) => m.league?.toLowerCase().includes(dbLeague.toLowerCase()) && isUpcomingMatch(m.date)
        )
        if (existingMatches.length >= MIN_UPCOMING) {
          addMatchLog(`⏭ Skipping ${ohLeague} — already ${existingMatches.length} upcoming matches`)
        } else {
          oddsLeaguesToScrape.push(ohLeague)
        }
      }

      if (oddsLeaguesToScrape.length === 0) {
        addMatchLog('✓ All leagues already have enough upcoming matches.')
        return { matchCount: 0, loadedCount: upcomingMatches.length }
      }

      const procId = `scrape-odds-${Date.now()}`
      addProcess({ id: procId, label: `Odds: ${oddsLeaguesToScrape.length} leagues`, status: 'running', progress: 0, startedAt: Date.now() })
      addMatchLog(`Scraping ${oddsLeaguesToScrape.length}/${ohLeagues.length} league(s) — up to 5 in parallel (${ohLeagues.length - oddsLeaguesToScrape.length} skipped)…`)
      setScrapeOddsProgress({ done: 0, total: oddsLeaguesToScrape.length })

      let completedOdds = 0
      const tasks = oddsLeaguesToScrape.map((ohLeague) => async () => {
        addMatchLog(`⏳ Starting ${ohLeague}…`)
        const { jobId } = await runUpcoming({
          data: { sport: 'football', league: ohLeague, markets: scrapeMarketsString || '1x2', headless: true, previewOnly: true },
        })
        addMatchLog(`Job #${jobId} for ${ohLeague}`)
        const count = await pollJob(jobId, 15 * 60_000, addMatchLog)
        completedOdds++
        const pct = Math.round((completedOdds / oddsLeaguesToScrape.length) * 100)
        setScrapeOddsProgress({ done: completedOdds, total: oddsLeaguesToScrape.length })
        upsertProcess(procId, { progress: pct, detail: `${completedOdds}/${oddsLeaguesToScrape.length} leagues` })
        addMatchLog(`✓ ${ohLeague} — ${count} matches`)
        return count
      })

      try {
        const counts = await runConcurrent(tasks, 5)
        const totalMatchCount = counts.reduce((a, b) => a + b, 0)

        addMatchLog(`Scraped ${totalMatchCount} matches. Reloading…`)
        // Reload matches from Frontbet DB
        const { matches } = await loadMatchesFromSources(['frontbet'])
        setUpcomingMatches(matches)
        setSelectedMatches(matches.filter((m) => isUpcomingMatch(m.date)).slice(0, 10).map((m) => m.id))
        setMatchesAutoLoadedForLeague(leaguesKey || null)

        upsertProcess(procId, { status: 'done', progress: 100, detail: `${totalMatchCount} matches` })
        return { matchCount: totalMatchCount, loadedCount: matches.length }
      } catch (err) {
        upsertProcess(procId, { status: 'error', detail: err instanceof Error ? err.message : 'Failed' })
        throw err
      }
    },
    onSuccess: (result) => {
      setScrapeOddsProgress(null)
      addMatchLog(`Done — scraped ${result.matchCount} matches, loaded ${result.loadedCount} with odds.`)
    },
    onError: (err) => {
      setScrapeOddsProgress(null)
      addMatchLog(`Error: ${err instanceof Error ? err.message : 'Scrape failed'}`)
    },
  })

  // ─── Scrape History for Selected Matches ───────────────────────
  const [scrapeHistoryForMatchesProgress, setScrapeHistoryForMatchesProgress] = React.useState<{ done: number; total: number } | null>(null)
  const scrapeHistoryForMatchesMut = useMutation({
    mutationFn: async () => {
      // Extract unique leagues from selected matches
      const selected = upcomingMatches.filter((m) => selectedMatches.includes(m.id))
      const uniqueLeagueNames = [...new Set(selected.map((m) => m.league).filter(Boolean))]
      if (uniqueLeagueNames.length === 0) throw new Error('Selected matches have no league info.')

      // Build a map from OH slug → original DB league name for correct count queries
      const ohLeagueToDb = new Map<string, string>()
      for (const name of uniqueLeagueNames) {
        const oh = findOddsHarvesterLeague(name, ohCatalog)
        if (oh) ohLeagueToDb.set(oh, name)
      }
      const ohLeagues = [...ohLeagueToDb.keys()]
      if (ohLeagues.length === 0) throw new Error('No matching OddsHarvester league found for the selected matches.')

      // Derive seasons from the history date range
      const fromD = new Date(historyDateFrom)
      const toD = new Date(historyDateTo)
      const firstSeasonStart = fromD.getMonth() >= 6 ? fromD.getFullYear() : fromD.getFullYear() - 1
      const lastSeasonStart = toD.getMonth() >= 6 ? toD.getFullYear() : toD.getFullYear() - 1
      const ohSeasons: string[] = []
      for (let y = firstSeasonStart; y <= lastSeasonStart; y++) {
        ohSeasons.push(`${y}-${y + 1}`)
      }

      // Skip leagues that already have enough historic data
      const MIN_HISTORIC = 50
      const leaguesToScrape: string[] = []
      for (const ohLeague of ohLeagues) {
        const dbLeague = ohLeagueToDb.get(ohLeague) ?? ohLeague.replace(/^[a-z]+-/, '').replace(/-/g, ' ')
        const { count: existing } = await countHistoricalMatches({
          data: { sport: 'football', league: dbLeague, dateFrom: historyDateFrom, dateTo: historyDateTo },
        })
        if (existing >= MIN_HISTORIC) {
          addHistoryLog(`⏭ Skipping ${ohLeague} — already ${existing} matches in DB`)
        } else {
          leaguesToScrape.push(ohLeague)
        }
      }

      if (leaguesToScrape.length === 0) {
        addHistoryLog('✓ All selected match leagues already have enough historic data.')
        const { matches } = await loadHistoryFromSources(['frontbet'])
        setHistory(matches)
        setHistoryAutoLoadedForLeague(leaguesKey || null)
        return { matchCount: 0, loadedCount: matches.length }
      }

      const taskItems = leaguesToScrape.flatMap((ohLeague) =>
        ohSeasons.map((season) => ({ ohLeague, season })),
      )
      const totalTasks = taskItems.length

      const procId = `scrape-hist-matches-${Date.now()}`
      addProcess({ id: procId, label: `History (selected): ${leaguesToScrape.length} league(s) × ${ohSeasons.length} season(s)`, status: 'running', progress: 0, startedAt: Date.now() })
      addHistoryLog(`Scraping history for selected matches: ${leaguesToScrape.length} league(s) × ${ohSeasons.length} season(s) = ${totalTasks} job(s)`)
      setScrapeHistoryForMatchesProgress({ done: 0, total: totalTasks })

      let completedCount = 0
      const tasks = taskItems.map(({ ohLeague, season }) => async () => {
        addHistoryLog(`⏳ Starting ${ohLeague} (${season})…`)
        const { jobId } = await runHistoric({
          data: { sport: 'football', league: ohLeague, season, markets: scrapeMarketsString || '1x2', headless: true, previewOnly: true },
        })
        addHistoryLog(`Job #${jobId} for ${ohLeague} (${season})`)
        const count = await pollJob(jobId, 25 * 60_000, addHistoryLog)
        completedCount++
        const pct = Math.round((completedCount / totalTasks) * 100)
        setScrapeHistoryForMatchesProgress({ done: completedCount, total: totalTasks })
        upsertProcess(procId, { progress: pct, detail: `${completedCount}/${totalTasks} jobs` })
        if (count > 0) {
          addHistoryLog(`✓ ${ohLeague} (${season}) — ${count} matches`)
        } else {
          addHistoryLog(`⚠ ${ohLeague} (${season}) — 0 matches (no data on OddsPortal?)`)
        }
        return count
      })

      try {
        const counts = await runConcurrent(tasks, 5)
        const totalMatchCount = counts.reduce((a, b) => a + b, 0)
        const zeroCount = counts.filter((c) => c === 0).length

        const { matches } = await loadHistoryFromSources(['frontbet'])
        setHistory(matches)
        setHistoryAutoLoadedForLeague(leaguesKey || null)

        const detail = zeroCount > 0
          ? `${totalMatchCount} matches (${zeroCount} empty)`
          : `${totalMatchCount} matches`
        upsertProcess(procId, { status: 'done', progress: 100, detail })
        return { matchCount: totalMatchCount, loadedCount: matches.length }
      } catch (err) {
        upsertProcess(procId, { status: 'error', detail: err instanceof Error ? err.message : 'Failed' })
        throw err
      }
    },
    onSuccess: (result) => {
      setScrapeHistoryForMatchesProgress(null)
      addHistoryLog(`Scraped ${result.matchCount} historic matches for selected leagues, loaded ${result.loadedCount}.`)
    },
    onError: (err) => {
      setScrapeHistoryForMatchesProgress(null)
      addHistoryLog(`Error: ${err instanceof Error ? err.message : 'Historic scrape for selected matches failed'}`)
    },
  })

  // ─── Run Predictions ───────────────────────────────────────────
  const predictMut = useMutation({
    mutationFn: async () => {
      let preparedHistory = history
      if (preparedHistory.length === 0) {
        preparedHistory = await prepareHistoryForPrediction()
      }

      let preparedUpcomingMatches = upcomingMatches
      if (preparedUpcomingMatches.length === 0) {
        preparedUpcomingMatches = await prepareMatchesForPrediction()
      }

      const effectiveSelectedMatches = selectedMatches.length > 0
        ? selectedMatches
        : preparedUpcomingMatches.filter((m) => isUpcomingMatch(m.date)).slice(0, 10).map((m) => m.id)

      if (selectedMatches.length === 0 && effectiveSelectedMatches.length > 0) {
        setSelectedMatches(effectiveSelectedMatches)
      }

      const matchesToPredict = effectiveSelectedMatches.length > 0
        ? preparedUpcomingMatches.filter((m) => effectiveSelectedMatches.includes(m.id))
        : preparedUpcomingMatches.filter((m) => isUpcomingMatch(m.date)).slice(0, 10)

      if (matchesToPredict.length === 0) {
        throw new Error('No matches selected for prediction')
      }

      const procId = `predict-${Date.now()}`
      addProcess({ id: procId, label: `Predict: ${matchesToPredict.length} matches`, status: 'running', progress: 0, startedAt: Date.now() })

      const results: PredictionResult[] = []
      setPredictionProgress(0)

      for (let idx = 0; idx < matchesToPredict.length; idx++) {
        const match = matchesToPredict[idx]
        const pct = Math.round(((idx) / matchesToPredict.length) * 100)
        setPredictionProgress(pct)
        upsertProcess(procId, { progress: pct, detail: `${idx}/${matchesToPredict.length} matches` })
        const basePayload = {
          operation: 'model_fit_predict',
          payload: {
            model,
            prediction: {
              home_team: match.homeTeam,
              away_team: match.awayTeam,
              max_goals: 8,
            },
          },
        }

        const hydrated = hydratePayloadWithHistory(
          'model_fit_predict',
          basePayload.payload,
          preparedHistory,
        )

        try {
          const res: any = await runPenaltyblogOperation({
            data: { operation: 'model_fit_predict', payload: hydrated },
          })

          const pred = res?.result?.prediction
          const predHT = res?.result?.predictionFirstHalf
          const predSH = res?.result?.predictionSecondHalf
          const resWarnings: string[] = [
            ...(res?.result?.teamWarnings ?? []),
            ...(res?.result?.warnings ?? []),
          ]

          const mapPeriod = (p: any): PeriodMarkets | null => {
            if (!p) return null
            return {
              homeWin: p?.homeWin ?? null,
              draw: p?.draw ?? null,
              awayWin: p?.awayWin ?? null,
              homeGoalExp: p?.homeGoalExpectation ?? null,
              awayGoalExp: p?.awayGoalExpectation ?? null,
              dc1X: p?.doubleChance?.['1X'] ?? null,
              dcX2: p?.doubleChance?.['X2'] ?? null,
              dc12: p?.doubleChance?.['12'] ?? null,
              dnbHome: p?.drawNoBet?.home ?? null,
              dnbAway: p?.drawNoBet?.away ?? null,
              over15: p?.totals?.over_1_5 ?? null,
              under15: p?.totals?.under_1_5 ?? null,
              over25: p?.totals?.over_2_5 ?? null,
              under25: p?.totals?.under_2_5 ?? null,
              over35: p?.totals?.over_3_5 ?? null,
              under35: p?.totals?.under_3_5 ?? null,
              bttsYes: p?.bttsYes ?? null,
              bttsNo: p?.bttsNo ?? null,
              ahHome: p?.asianHandicap?.['home_-0_5'] ?? null,
              ahAway: p?.asianHandicap?.['away_+0_5'] ?? null,
            }
          }

          const ft = mapPeriod(pred)!
          results.push({
            match,
            model,
            ...ft,
            firstHalf: mapPeriod(predHT),
            secondHalf: mapPeriod(predSH),
            error: null,
            warnings: resWarnings.length > 0 ? resWarnings : null,
            dataQuality: res?.result?.dataQuality ?? null,
          })
        } catch (err) {
          results.push({
            match,
            model,
            homeWin: null,
            draw: null,
            awayWin: null,
            homeGoalExp: null,
            awayGoalExp: null,
            dc1X: null,
            dcX2: null,
            dc12: null,
            dnbHome: null,
            dnbAway: null,
            over15: null,
            under15: null,
            over25: null,
            under25: null,
            over35: null,
            under35: null,
            bttsYes: null,
            bttsNo: null,
            ahHome: null,
            ahAway: null,
            firstHalf: null,
            secondHalf: null,
            error: err instanceof Error ? err.message : 'Prediction failed',
            warnings: null,
            dataQuality: null,
          })
        }
      }

      setPredictionProgress(100)
      upsertProcess(procId, { status: 'done', progress: 100, detail: `${results.length} predictions` })
      return results
    },
    onSuccess: (data) => {
      setPredictions(data)
      setError(null)
      setValueBets([])
      setSelectedBetKeys(new Set())
      setSelectedCandidateKeys(new Set())
      setGenerateTicketsEnabled(false)
      setTicketBatchResult(null)
      setTkSavedId(null)
      setHistorySavedId(null)

      // Auto-save to prediction history immediately using fresh result data
      const successPreds = data.filter((p) => !p.error)
      if (successPreds.length > 0) {
        setIsAutoSaving(true)
        savePredictionSession({
          data: {
            league: leagues.join(', ') || 'Unknown',
            source: 'penaltyblog',
            model,
            predictions: successPreds.map((p) => ({
              homeTeam: p.match.homeTeam,
              awayTeam: p.match.awayTeam,
              matchDate: p.match.date ?? null,
              league: p.match.league ?? null,
              homeWinProb: p.homeWin,
              drawProb: p.draw,
              awayWinProb: p.awayWin,
              predictedGoalsHome: p.homeGoalExp,
              predictedGoalsAway: p.awayGoalExp,
              dc1X: p.dc1X,
              dcX2: p.dcX2,
              dc12: p.dc12,
              dnbHome: p.dnbHome,
              dnbAway: p.dnbAway,
              over15: p.over15,
              under15: p.under15,
              over25: p.over25,
              under25: p.under25,
              over35: p.over35,
              under35: p.under35,
              bttsYes: p.bttsYes,
              bttsNo: p.bttsNo,
              ahHome: p.ahHome,
              ahAway: p.ahAway,
              htHomeWinProb: p.firstHalf?.homeWin ?? null,
              htDrawProb: p.firstHalf?.draw ?? null,
              htAwayWinProb: p.firstHalf?.awayWin ?? null,
              htGoalsHome: p.firstHalf?.homeGoalExp ?? null,
              htGoalsAway: p.firstHalf?.awayGoalExp ?? null,
              htDc1X: p.firstHalf?.dc1X ?? null,
              htDcX2: p.firstHalf?.dcX2 ?? null,
              htDc12: p.firstHalf?.dc12 ?? null,
              htDnbHome: p.firstHalf?.dnbHome ?? null,
              htDnbAway: p.firstHalf?.dnbAway ?? null,
              htOver15: p.firstHalf?.over15 ?? null,
              htUnder15: p.firstHalf?.under15 ?? null,
              htOver25: p.firstHalf?.over25 ?? null,
              htUnder25: p.firstHalf?.under25 ?? null,
              htOver35: p.firstHalf?.over35 ?? null,
              htUnder35: p.firstHalf?.under35 ?? null,
              htBttsYes: p.firstHalf?.bttsYes ?? null,
              htBttsNo: p.firstHalf?.bttsNo ?? null,
              htAhHome: p.firstHalf?.ahHome ?? null,
              htAhAway: p.firstHalf?.ahAway ?? null,
              shHomeWinProb: p.secondHalf?.homeWin ?? null,
              shDrawProb: p.secondHalf?.draw ?? null,
              shAwayWinProb: p.secondHalf?.awayWin ?? null,
              shGoalsHome: p.secondHalf?.homeGoalExp ?? null,
              shGoalsAway: p.secondHalf?.awayGoalExp ?? null,
              shDc1X: p.secondHalf?.dc1X ?? null,
              shDcX2: p.secondHalf?.dcX2 ?? null,
              shDc12: p.secondHalf?.dc12 ?? null,
              shDnbHome: p.secondHalf?.dnbHome ?? null,
              shDnbAway: p.secondHalf?.dnbAway ?? null,
              shOver15: p.secondHalf?.over15 ?? null,
              shUnder15: p.secondHalf?.under15 ?? null,
              shOver25: p.secondHalf?.over25 ?? null,
              shUnder25: p.secondHalf?.under25 ?? null,
              shOver35: p.secondHalf?.over35 ?? null,
              shUnder35: p.secondHalf?.under35 ?? null,
              shBttsYes: p.secondHalf?.bttsYes ?? null,
              shBttsNo: p.secondHalf?.bttsNo ?? null,
              shAhHome: p.secondHalf?.ahHome ?? null,
              shAhAway: p.secondHalf?.ahAway ?? null,
              predictedOutcome:
                p.homeWin != null && p.draw != null && p.awayWin != null
                  ? p.homeWin >= p.draw && p.homeWin >= p.awayWin
                    ? '1'
                    : p.awayWin >= p.draw
                      ? '2'
                      : 'X'
                  : null,
              confidence:
                p.homeWin != null && p.draw != null && p.awayWin != null
                  ? Math.max(p.homeWin, p.draw, p.awayWin)
                  : null,
            })),
          },
        })
          .then((res) => {
            setHistorySavedId(res.sessionId)
            qc.invalidateQueries({ queryKey: ['prediction-sessions'] })
          })
          .catch(() => { /* non-critical */ })
          .finally(() => setIsAutoSaving(false))
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Prediction failed')
      // Mark any running predict processes as errored
      setActiveProcesses((prev) => prev.map((p) => p.id.startsWith('predict-') && p.status === 'running' ? { ...p, status: 'error' as const, detail: 'Failed' } : p))
    },
  })

  React.useEffect(() => {
    if (leagues.length === 0) return
    if (loadHistoryMut.isPending || predictMut.isPending) return
    if (historyAutoLoadedForLeague === leaguesKey) return
    if (history.length > 0) return

    loadHistoryMut.mutate()
  }, [history.length, historyAutoLoadedForLeague, leagues.length, leaguesKey, loadHistoryMut, predictMut.isPending])

  React.useEffect(() => {
    if (leagues.length === 0) return
    if (loadMatchesMut.isPending || predictMut.isPending) return
    if (matchesAutoLoadedForLeague === leaguesKey) return
    if (upcomingMatches.length > 0) return

    loadMatchesMut.mutate({})
  }, [leagues.length, leaguesKey, loadMatchesMut, matchesAutoLoadedForLeague, predictMut.isPending, upcomingMatches.length])

  // ─── Find Value Bets ────────────────────────────────────────────
  const findBetsMut = useMutation({
    mutationFn: () => {
      const successPreds = predictions.filter((p) => !p.error)
      return findValueBets({
        data: {
          predictions: successPreds.map((p) => ({
            homeTeam: p.match.homeTeam,
            awayTeam: p.match.awayTeam,
            matchDate: p.match.date || null,
            homeWin: p.homeWin,
            draw: p.draw,
            awayWin: p.awayWin,
            over15: p.over15,
            under15: p.under15,
            over25: p.over25,
            under25: p.under25,
            over35: p.over35,
            under35: p.under35,
            bttsYes: p.bttsYes,
            bttsNo: p.bttsNo,
            dc1X: p.dc1X,
            dcX2: p.dcX2,
            dc12: p.dc12,
            dnbHome: p.dnbHome,
            dnbAway: p.dnbAway,
            ahHome: p.ahHome,
            ahAway: p.ahAway,
          })),
        },
      })
    },
    onSuccess: (bets) => {
      const dedupedBets = Array.from(new Map(bets.map((bet) => [bet.key, bet])).values())
      setValueBets(dedupedBets)
      const threshold = (parseFloat(minEdgePct) || 3) / 100
      setSelectedBetKeys(new Set(dedupedBets.filter((b) => b.edge >= threshold).map((b) => b.key)))
      setTicketBatchResult(null)
    },
  })

  // ─── Save Ticket from Predictions ───────────────────────────────
  const saveTicketMut = useMutation({
    mutationFn: () => {
      const selected = valueBets.filter((b) => selectedBetKeys.has(b.key))
      if (selected.length === 0) throw new Error('No bets selected')
      return saveTicket({
        data: {
          name: tkName.trim() || undefined,
          currency: tkCurrency,
          stake: parseFloat(tkStake) || 10,
          bankroll: 1000,
          selections: selected.map((b) => ({
            matchId: b.matchId,
            homeTeam: b.homeTeam,
            awayTeam: b.awayTeam,
            matchDate: b.matchDate,
            sport: b.sport,
            league: b.league,
            market: b.market,
            submarket: b.submarket,
            outcome: b.outcome,
            label: b.label,
            odds: b.bestOdds,
            bookmaker: b.bookmaker,
          })),
        },
      })
    },
    onSuccess: (data) => {
      setTkSavedId(data.id)
      qc.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const ticketCandidates = React.useMemo(() => {
    if (ticketGenerationSource === 'selected-value-bets') {
      return valueBets.filter((bet) => selectedBetKeys.has(bet.key))
    }

    return getTicketCandidates(valueBets)
  }, [selectedBetKeys, ticketGenerationSource, valueBets])
  const selectedTicketCandidates = React.useMemo(
    () => ticketCandidates.filter((bet) => selectedCandidateKeys.has(bet.key)),
    [selectedCandidateKeys, ticketCandidates],
  )
  const orderedTicketCandidates = React.useMemo(
    () => orderTicketCandidates(selectedTicketCandidates, ticketBuildStrategy),
    [selectedTicketCandidates, ticketBuildStrategy],
  )
  const requestedTicketCount = Math.max(1, Number(ticketCount) || 1)
  const requestedMatchesPerTicket = Math.max(1, Number(matchesPerTicket) || 1)
  const maxTicketCountAvailable = React.useMemo(() => {
    if (orderedTicketCandidates.length === 0) return 0
    if (useAllSelectedMatches) {
      return Math.ceil(orderedTicketCandidates.length / requestedMatchesPerTicket)
    }
    return Math.floor(orderedTicketCandidates.length / requestedMatchesPerTicket)
  }, [orderedTicketCandidates.length, requestedMatchesPerTicket, useAllSelectedMatches])
  const previewTicketBatches = React.useMemo(
    () => createTicketBatches(orderedTicketCandidates, requestedMatchesPerTicket, requestedTicketCount, useAllSelectedMatches),
    [orderedTicketCandidates, requestedMatchesPerTicket, requestedTicketCount, useAllSelectedMatches],
  )
  const previewTicketBatchStats = React.useMemo(
    () => previewTicketBatches.map((batch) => calcPreviewTicketStats(batch, parseFloat(tkStake) || 10)),
    [previewTicketBatches, tkStake],
  )
  const previewMatchesUsed = React.useMemo(
    () => previewTicketBatches.reduce((total, batch) => total + batch.length, 0),
    [previewTicketBatches],
  )
  const previewMatchesUnused = Math.max(orderedTicketCandidates.length - previewMatchesUsed, 0)
  const duplicateTicketMatches = React.useMemo(() => {
    const counts = new Map<number, { label: string; count: number }>()

    for (const bet of selectedTicketCandidates) {
      const label = `${bet.homeTeam} vs ${bet.awayTeam}`
      const existing = counts.get(bet.matchId)
      if (existing) {
        existing.count += 1
      } else {
        counts.set(bet.matchId, { label, count: 1 })
      }
    }

    return [...counts.values()].filter((item) => item.count > 1)
  }, [selectedTicketCandidates])

  React.useEffect(() => {
    const threshold = (parseFloat(minEdgePct) || 3) / 100
    setSelectedCandidateKeys(
      new Set(ticketCandidates.filter((bet) => bet.edge >= threshold).map((bet) => bet.key)),
    )
  }, [minEdgePct, ticketCandidates])

  const generateBatchTicketsMut = useMutation({
    mutationFn: async () => {
      const requestedCount = requestedTicketCount
      const perTicket = requestedMatchesPerTicket
      const selectedCandidates = orderedTicketCandidates

      if (selectedCandidates.length === 0) {
        throw new Error('Select at least one match from the generated list first')
      }

      const maxTickets = useAllSelectedMatches
        ? Math.ceil(selectedCandidates.length / perTicket)
        : Math.floor(selectedCandidates.length / perTicket)
      if (maxTickets === 0) {
        throw new Error(`Select at least ${perTicket} matches to generate one ticket`)
      }

      const actualCount = Math.min(requestedCount, maxTickets)
      const batches = previewTicketBatches.slice(0, actualCount)
      const ticketIds: number[] = []

      for (let index = 0; index < batches.length; index += 1) {
        const selections: TicketSelection[] = batches[index].map((bet) => ({
          matchId: bet.matchId,
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          matchDate: bet.matchDate,
          sport: bet.sport,
          league: bet.league,
          market: bet.market,
          submarket: bet.submarket,
          outcome: bet.outcome,
          label: bet.label,
          odds: bet.bestOdds,
          bookmaker: bet.bookmaker,
          modelProb: bet.modelProb,
        }))

        const response = await saveTicket({
          data: {
            name: `${tkName.trim() || leagues.join(', ') || 'Prediction'} Ticket ${index + 1}`,
            currency: tkCurrency,
            stake: parseFloat(tkStake) || 10,
            bankroll: 1000,
            selections,
          },
        })

        ticketIds.push(response.id)
      }

      return {
        ticketIds,
        generatedCount: ticketIds.length,
        requestedCount,
        matchesPerTicket: perTicket,
        selectedMatchesCount: selectedCandidates.length,
      } satisfies TicketBatchResult
    },
    onSuccess: (result) => {
      setTicketBatchResult(result)
      setTkSavedId(result.ticketIds[result.ticketIds.length - 1] ?? null)
      qc.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to generate tickets'),
  })

  // ─── Step tracking ───────────────────────────────────────────
  const step1Done = leagues.length > 0
  const step2Done = history.length > 0
  const step3Done = selectedMatches.length > 0
  const [predictionProgress, setPredictionProgress] = React.useState(0)
  const historyAutoReady = historyAutoLoadedForLeague === leaguesKey && history.length > 0
  const matchesAutoReady = matchesAutoLoadedForLeague === leaguesKey && upcomingMatches.length > 0

  React.useEffect(() => {
    setHistory([])
    setProcessLogs([])
    setHistoryAutoLoadedForLeague(null)
    setUpcomingMatches([])
    setSelectedMatches([])
    setMatchesAutoLoadedForLeague(null)
    setPredictions([])
    setValueBets([])
    setSelectedBetKeys(new Set())
    setSelectedCandidateKeys(new Set())
    setGenerateTicketsEnabled(false)
    setUseAllSelectedMatches(false)
    setTkSavedId(null)
    setHistorySavedId(null)
    setTicketBatchResult(null)
    setError(null)
    setPredictionProgress(0)
  }, [leaguesKey, predictionPreparationMode])

  return (
    <div className="flex items-start gap-6">
    <div className="min-w-0 flex-1 space-y-6">
      {/* Progress Stepper */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: 'League', done: step1Done },
          { n: 2, label: 'History', done: step2Done },
          { n: 3, label: 'Matches', done: step3Done },
          { n: 4, label: 'Predict', done: predictions.length > 0 },
        ].map((s, i, arr) => (
          <React.Fragment key={s.n}>
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                  s.done
                    ? 'bg-[var(--lagoon-deep)] text-white'
                    : 'bg-[var(--sand)] text-[var(--sea-ink-soft)] border border-[var(--line)]'
                }`}
              >
                {s.done ? '✓' : s.n}
              </span>
              <span className={`text-xs font-medium ${s.done ? 'text-[var(--lagoon-deep)]' : 'text-[var(--sea-ink-soft)]'}`}>
                {s.label}
              </span>
            </div>
            {i < arr.length - 1 && (
              <div
                className={`h-0.5 flex-1 rounded ${
                  s.done ? 'bg-[var(--lagoon-deep)]' : 'bg-[var(--line)]'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      {/* Step 1: Select League & Filters */}
      <Card className="relative z-40 space-y-5">
        <h2 className="text-lg font-bold text-[var(--sea-ink)]">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--lagoon)]/15 text-xs font-bold text-[var(--lagoon-deep)]">1</span>
          Select League
        </h2>

        <OddsHarvesterFilters
          sports={sports}
          onSportsChange={setSports}
          countries={countries}
          onCountriesChange={setCountries}
          countryOptions={countryOptions}
          leagues={leagues}
          onLeaguesChange={handleLeagueChange}
          leagueOptions={filteredLeagueOptions}
          leagueOptionGroups={filteredLeagueOptionGroups}
          leagueExclusiveValues={[ALL_LEAGUES_VALUE]}
          marketEntries={marketEntries}
          onMarketEntriesChange={setMarketEntries}
          showMarkets={false}
        />
      </Card>

      {/* Step 2: Load Historical Data */}
      <Card className="relative z-30 space-y-5">
        <h2 className="text-lg font-bold text-[var(--sea-ink)]">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--lagoon)]/15 text-xs font-bold text-[var(--lagoon-deep)]">2</span>
          Load Historical Data
        </h2>
        <p className="text-xs text-[var(--sea-ink-soft)]">
          Historical match data is used to train the prediction model. More data = better predictions.
        </p>

        {/* Tutorial guidance */}
        <details className="group rounded-lg border border-[var(--lagoon)]/20 bg-[var(--lagoon)]/5">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[var(--lagoon-deep)] select-none">
            📖 How to get accurate predictions (click to expand)
          </summary>
          <div className="space-y-2 px-3 pb-3 pt-1 text-[11px] text-[var(--sea-ink-soft)]">
            <p><strong>Minimum data:</strong> The Dixon-Coles model needs at least <strong>10-20 matches per team</strong> to produce reliable estimates. With fewer than 5 matches per team, predictions are essentially random.</p>
            <p><strong>Ideal data:</strong> Load <strong>2-3 full seasons</strong> (50-100+ matches per league). Top 5 European leagues have the most data and produce the best predictions.</p>
            <p><strong>Lower divisions</strong> (e.g. Saudi Div 2, UAE lower leagues) typically have very sparse data — treat those predictions with extra caution or avoid them.</p>
            <p><strong>Best sources:</strong> Use <em>soccerdata</em> for major leagues (more historical depth). Use <em>frontbet</em> (OddsHarvester scraped) for leagues not in soccerdata, but scrape multiple seasons first.</p>
            <p><strong>Most reliable markets:</strong> BTTS (Both Teams To Score) tends to be the most accurate. 1X2 outcomes are hardest to predict — avoid betting on close calls where the top 2 probabilities are within 5%.</p>
          </div>
        </details>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <Label>Prediction Data Mode</Label>
            <Select
              value={predictionPreparationMode}
              onValueChange={(value) => setPredictionPreparationMode(value as PredictionPreparationMode)}
              placeholder="Select preparation mode"
              options={PREDICTION_PREP_OPTIONS}
            />
          </div>
          <div className="space-y-1">
            <Label>Source</Label>
            <Select
              value={historySource}
              onValueChange={(v) => setHistorySource(v as 'frontbet' | 'soccerdata')}
              placeholder="Select source"
              options={HISTORY_SOURCES}
              disabled={hasAllLeagues}
            />
          </div>
          {historySource === 'soccerdata' ? (
            <div className="space-y-1">
              <Label>Season(s)</Label>
              <MultiSelect
                values={historySeasons}
                onValuesChange={(vals) => {
                  setHistorySeasons(vals)
                  if (vals.length > 0) setHistorySeason(vals[0])
                }}
                placeholder="Select season(s)…"
                options={matchHistorySeasonOptions()}
                searchable={false}
                maxVisibleLabels={2}
              />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label>Years</Label>
                <Select
                  value={historyYears || '__none__'}
                  onValueChange={(v) => setHistoryYears(v === '__none__' ? '' : v)}
                  placeholder="—"
                  options={[
                    { label: '—', value: '__none__' },
                    ...Array.from({ length: 5 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })),
                  ]}
                />
              </div>
              <div className="space-y-1">
                <Label>Months</Label>
                <Select
                  value={historyMonths || '__none__'}
                  onValueChange={(v) => setHistoryMonths(v === '__none__' ? '' : v)}
                  placeholder="—"
                  options={[
                    { label: '—', value: '__none__' },
                    ...Array.from({ length: 11 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })),
                  ]}
                />
              </div>
              <div className="space-y-1">
                <Label>Weeks</Label>
                <Select
                  value={historyWeeks || '__none__'}
                  onValueChange={(v) => setHistoryWeeks(v === '__none__' ? '' : v)}
                  placeholder="—"
                  options={[
                    { label: '—', value: '__none__' },
                    ...Array.from({ length: 4 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })),
                  ]}
                />
              </div>
              <div className="space-y-1">
                <Label>Days</Label>
                <Select
                  value={historyDays || '__none__'}
                  onValueChange={(v) => setHistoryDays(v === '__none__' ? '' : v)}
                  placeholder="—"
                  options={[
                    { label: '—', value: '__none__' },
                    ...Array.from({ length: 6 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })),
                  ]}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[var(--sea-ink-soft)]/60 text-xs">Period</Label>
                <p className="text-xs text-[var(--sea-ink-soft)] pt-1">{historyDateFrom} → {historyDateTo}</p>
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>Max Matches</Label>
            <Select
              value={historyLimit}
              onValueChange={setHistoryLimit}
              placeholder="Limit"
              options={[
                { label: '50', value: '50' },
                { label: '100', value: '100' },
                { label: '200', value: '200' },
                { label: '300', value: '300' },
                { label: '500', value: '500' },
              ]}
            />
          </div>
        </div>

        {/* Scrape market selector */}
        {!hasAllLeagues && leagues.some((l) => findOddsHarvesterLeague(l, ohCatalog)) && (
          <OddsHarvesterFilters
            sports={sports}
            onSportsChange={setSports}
            countries={countries}
            onCountriesChange={setCountries}
            countryOptions={countryOptions}
            leagues={leagues}
            onLeaguesChange={handleLeagueChange}
            leagueOptions={filteredLeagueOptions}
            leagueOptionGroups={filteredLeagueOptionGroups}
            leagueExclusiveValues={[ALL_LEAGUES_VALUE]}
            marketEntries={marketEntries}
            onMarketEntriesChange={setMarketEntries}
            showSports={false}
            showCountries={false}
            showLeagues={false}
          />
        )}

        {/* DB count indicator for frontbet source */}
        {historySource === 'frontbet' && leagues.length > 0 && !hasAllLeagues && (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--sand)]/40 px-3 py-2">
            <span className="text-xs font-medium text-[var(--sea-ink)]">
              DB: {historyDbCount != null ? (
                <>
                  <span className={historyDbCount > 0 ? 'text-[var(--lagoon-deep)] font-bold' : 'text-red-500 font-bold'}>
                    {historyDbCount}
                  </span>
                  {' '}completed matches ({historyDateFrom} → {historyDateTo})
                </>
              ) : (
                'checking…'
              )}
            </span>
            {historyDbCount != null && leagues.some((l) => findOddsHarvesterLeague(l, ohCatalog)) && (
              <Button
                onClick={() => scrapeHistoricMut.mutate()}
                disabled={scrapeHistoricMut.isPending}
                variant="secondary"
                className="h-7 px-2 text-xs"
              >
                {scrapeHistoricMut.isPending ? (
                  <><Spinner className="h-3 w-3" /> Scraping{scrapeHistoricProgress ? ` ${Math.round((scrapeHistoricProgress.done / scrapeHistoricProgress.total) * 100)}%` : ''}…</>
                ) : (
                  '🕷 Scrape Historic'
                )}
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center gap-4">
          {historyAutoReady ? (
            <>
              <span className="text-sm font-semibold text-[var(--lagoon-deep)]">
                Auto-loaded for {leagues.join(', ')}
              </span>
              <Button
                onClick={() => loadHistoryMut.mutate()}
                disabled={loadHistoryMut.isPending || leagues.length === 0}
                variant="ghost"
              >
                {loadHistoryMut.isPending ? (
                  <><Spinner className="h-4 w-4" /> Refreshing…</>
                ) : (
                  'Refresh history'
                )}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => loadHistoryMut.mutate()}
              disabled={loadHistoryMut.isPending || leagues.length === 0}
              variant="secondary"
            >
              {loadHistoryMut.isPending ? (
                <><Spinner className="h-4 w-4" /> Loading…</>
              ) : (
                '📥 Load History'
              )}
            </Button>
          )}

          {history.length > 0 && (
            <span className="text-sm text-[var(--lagoon-deep)] font-semibold">
              {history.length} matches loaded
            </span>
          )}
        </div>

        {historySource === 'frontbet' && (
          <p className="text-[10px] text-[var(--sea-ink-soft)]">
            Uses completed matches already scraped into Frontbet{hasAllLeagues ? ' across all leagues.' : ' for the selected league(s).'}
          </p>
        )}

        {/* Teams preview with match counts */}
        {history.length > 0 && (() => {
          const teamCounts = new Map<string, number>()
          for (const m of history) {
            teamCounts.set(m.team_home, (teamCounts.get(m.team_home) ?? 0) + 1)
            teamCounts.set(m.team_away, (teamCounts.get(m.team_away) ?? 0) + 1)
          }
          const teams = [...teamCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
          const sparseTeams = teams.filter(([, c]) => c < 10)
          return (
            <div className="space-y-2">
              {sparseTeams.length > 0 && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2">
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    ⚠ {sparseTeams.length} of {teams.length} teams have fewer than 10 matches — predictions for these teams may be unreliable.
                    {sparseTeams.length > teams.length * 0.5 && ' Consider scraping more seasons of history.'}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {teams.map(([team, count]) => (
                  <span
                    key={team}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      count < 5
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : count < 10
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-[var(--sand)] text-[var(--sea-ink-soft)]'
                    }`}
                    title={`${team}: ${count} matches in training data${count < 5 ? ' (very sparse — unreliable)' : count < 10 ? ' (limited — may be inaccurate)' : ''}`}
                  >
                    {team} <span className="opacity-60">({count})</span>
                  </span>
                ))}
              </div>
            </div>
          )
        })()}
      </Card>

      {/* Step 3: Load Future Matches */}
      <Card className="relative z-20 space-y-5">
        <h2 className="text-lg font-bold text-[var(--sea-ink)]">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--lagoon)]/15 text-xs font-bold text-[var(--lagoon-deep)]">3</span>
          Select Future Matches
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1">
            <Label>Schedule Source</Label>
            <Select
              value={matchSource}
              onValueChange={setMatchSource}
              placeholder="Select source"
              options={MATCH_SOURCES}
              disabled={hasAllLeagues}
            />
          </div>
          <div className="space-y-1">
            <Label>Season</Label>
            <Select
              value={season}
              onValueChange={setSeason}
              placeholder="Select season"
              options={matchSource === 'espn' ? espnSeasonOptions() : seasonOptions()}
              disabled={matchSource === 'frontbet'}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--sea-ink)]">
              <input
                type="checkbox"
                checked={matchUpcomingOnly}
                onChange={(e) => setMatchUpcomingOnly(e.target.checked)}
                className="accent-[var(--lagoon)]"
              />
              Upcoming matches only
            </label>
          </div>
        </div>

        {/* Date range filter */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label>Date from</Label>
            <Input
              type="date"
              value={matchDateFrom}
              onChange={(e) => setMatchDateFrom(e.target.value)}
              className="w-40 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label>Date to</Label>
            <Input
              type="date"
              value={matchDateTo}
              onChange={(e) => setMatchDateTo(e.target.value)}
              className="w-40 text-sm"
            />
          </div>
          <button
            type="button"
            className="pb-1 text-xs text-[var(--lagoon-deep)] hover:underline"
            onClick={() => {
              const inRange = upcomingMatches.filter((m) =>
                isInDateRange(m.date, matchDateFrom, matchDateTo),
              )
              setSelectedMatches(inRange.map((m) => m.id))
            }}
          >
            Select matches in range
          </button>
        </div>

        {matchSource === 'frontbet' && (
          <p className="text-[10px] text-[var(--sea-ink-soft)]">
            {matchUpcomingOnly
              ? `Uses upcoming matches that already have bookmaker odds in your local Frontbet database${hasAllLeagues ? ' across all leagues.' : '.'}`
              : `Loads all matches (including completed) with bookmaker odds from your local Frontbet database${hasAllLeagues ? ' across all leagues.' : '.'}`}
          </p>
        )}

        {hasAllLeagues && (
          <p className="text-[10px] text-[var(--sea-ink-soft)]">
            All leagues mode uses only Frontbet local history and local odds-backed matches. Select a specific league to enable ESPN or Sofascore scraping.
          </p>
        )}

        <div className="flex items-center gap-3">
          {matchesAutoReady ? (
            <>
              <span className="text-sm font-semibold text-[var(--lagoon-deep)]">
                Auto-loaded for {leagues.join(', ')}
              </span>
              <Button
                variant="ghost"
                onClick={() => loadMatchesMut.mutate({})}
                disabled={loadMatchesMut.isPending || leagues.length === 0}
              >
                {loadMatchesMut.isPending ? (
                  <><Spinner className="h-4 w-4" /> Refreshing…</>
                ) : (
                  'Refresh matches'
                )}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={() => loadMatchesMut.mutate({})}
              disabled={loadMatchesMut.isPending || leagues.length === 0}
            >
              {loadMatchesMut.isPending ? (
                <><Spinner className="h-4 w-4" /> Loading…</>
              ) : (
                '📅 Load Matches'
              )}
            </Button>
          )}
          {matchSource !== 'frontbet' && (
            <Button
              variant="ghost"
              onClick={() => loadMatchesMut.mutate({ refresh: true })}
              disabled={loadMatchesMut.isPending || leagues.length === 0}
            >
              {loadMatchesMut.isPending ? (
                <><Spinner className="h-4 w-4" /> Scraping…</>
              ) : (
                '🔄 Scrape fresh'
              )}
            </Button>
          )}
          {!hasAllLeagues && leagues.some((l) => findOddsHarvesterLeague(l, ohCatalog)) && (
            <Button
              variant="ghost"
              onClick={() => scrapeOddsMut.mutate()}
              disabled={scrapeOddsMut.isPending || leagues.length === 0}
            >
              {scrapeOddsMut.isPending ? (
                <><Spinner className="h-4 w-4" /> Scraping odds{scrapeOddsProgress ? ` ${Math.round((scrapeOddsProgress.done / scrapeOddsProgress.total) * 100)}%` : ''}…</>
              ) : (
                '🕷️ Scrape odds (OddsHarvester)'
              )}
            </Button>
          )}
          {selectedMatches.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => scrapeHistoryForMatchesMut.mutate()}
              disabled={scrapeHistoryForMatchesMut.isPending || scrapeHistoricMut.isPending}
            >
              {scrapeHistoryForMatchesMut.isPending ? (
                <><Spinner className="h-4 w-4" /> Scraping history{scrapeHistoryForMatchesProgress ? ` ${Math.round((scrapeHistoryForMatchesProgress.done / scrapeHistoryForMatchesProgress.total) * 100)}%` : ''}…</>
              ) : (
                '🕷️ Scrape history for selected'
              )}
            </Button>
          )}
        </div>

        {upcomingMatches.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[var(--sea-ink-soft)]">
                {upcomingMatches.length} matches found — select matches to predict
              </p>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--sea-ink-soft)] select-none">
                  <input
                    type="checkbox"
                    ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected }}
                    checked={allVisibleSelected}
                    onChange={() => {
                      if (allVisibleSelected) {
                        const visibleIds = new Set(visibleMatches.map((m) => m.id))
                        setSelectedMatches((prev) => prev.filter((id) => !visibleIds.has(id)))
                      } else {
                        setSelectedMatches((prev) => [...new Set([...prev, ...visibleMatches.map((m) => m.id)])])
                      }
                    }}
                    className="accent-[var(--lagoon-deep)]"
                  />
                  Select all
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--sea-ink-soft)] select-none">
                  <input
                    type="checkbox"
                    checked={showOnlyInRange}
                    onChange={(e) => setShowOnlyInRange(e.target.checked)}
                    className="accent-[var(--lagoon-deep)]"
                  />
                  In range only
                </label>
                <button
                  type="button"
                  className="text-xs text-[var(--lagoon-deep)] hover:underline"
                  onClick={() => {
                    setSelectedMatches(
                      upcomingMatches
                        .filter((m) => isUpcomingMatch(m.date))
                        .map((m) => m.id),
                    )
                  }}
                >
                  Select future
                </button>
                <button
                  type="button"
                  className="text-xs text-[var(--sea-ink-soft)] hover:underline"
                  onClick={() => setSelectedMatches([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--sand)]">
              {visibleMatches.map((match) => {
                const checked = selectedMatches.includes(match.id)
                const isFuture = isUpcomingMatch(match.date)
                const inRange = isInDateRange(match.date, matchDateFrom, matchDateTo)

                return (
                  <label
                    key={match.id}
                    className={`flex cursor-pointer items-center gap-3 border-b border-[var(--line)]/40 px-3 py-2 text-sm hover:bg-[var(--lagoon)]/5 ${
                      !isFuture ? 'opacity-60' : ''
                    } ${inRange && isFuture ? 'bg-[var(--lagoon)]/5' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedMatches((prev) =>
                          checked
                            ? prev.filter((id) => id !== match.id)
                            : [...prev, match.id],
                        )
                      }
                      className="accent-[var(--lagoon-deep)]"
                    />
                    <span className="flex-1 font-medium text-[var(--sea-ink)]">
                      {match.homeTeam} vs {match.awayTeam}
                    </span>
                    <span className="text-xs text-[var(--sea-ink-soft)]">
                      {match.date}
                    </span>
                    {isFuture && (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        Upcoming
                      </span>
                    )}
                    {inRange && isFuture && (
                      <span className="rounded bg-[var(--lagoon)]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--lagoon-deep)]">
                        In range
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
            <p className="text-[10px] text-[var(--sea-ink-soft)]">
              {selectedMatches.length} matches selected
              {' · '}
              {upcomingMatches.filter((m) => isInDateRange(m.date, matchDateFrom, matchDateTo) && isUpcomingMatch(m.date)).length} in date range
            </p>
          </div>
        )}
      </Card>

      {/* Step 4: Run Predictions */}
      <Card className={`relative z-10 space-y-5 transition-opacity ${step2Done ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <h2 className="text-lg font-bold text-[var(--sea-ink)]">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--lagoon)]/15 text-xs font-bold text-[var(--lagoon-deep)]">4</span>
          Run Predictions
        </h2>

        <div className="space-y-1">
          <Label>Prediction Model</Label>
          <Select
            value={model}
            onValueChange={setModel}
            placeholder="Select model"
            options={PREDICTION_MODELS}
            optionGroups={PREDICTION_MODEL_GROUPS}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--sea-ink-soft)]">
            <span className="rounded-full border border-[var(--line)]/60 bg-[var(--surface)] px-2 py-0.5 font-semibold text-[var(--sea-ink)]">
              Source: penaltyblog
            </span>
            {PREDICTION_MODEL_DESCRIPTIONS[model] ? (
              <span className={cn('rounded-full border px-2 py-0.5 font-semibold', MODEL_SPEED_BADGES[PREDICTION_MODEL_DESCRIPTIONS[model].speed])}>
                {PREDICTION_MODEL_DESCRIPTIONS[model].speed}
              </span>
            ) : null}
            <span>Fast models are best for batch runs. Bayesian models are available, but much slower.</span>
          </div>
          {PREDICTION_MODEL_DESCRIPTIONS[model] && (
            <div className="mt-2 rounded-lg border border-[var(--line)]/60 bg-[var(--sand)] overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)]/40 bg-[var(--surface)]/40 px-3 py-2">
                <span className="text-xs font-semibold text-[var(--sea-ink)]">{PREDICTION_MODEL_DESCRIPTIONS[model].name}</span>
                <span className="rounded-full border border-[var(--line)]/60 px-2 py-0.5 text-[10px] font-semibold text-[var(--sea-ink-soft)]">
                  {PREDICTION_MODEL_DESCRIPTIONS[model].family}
                </span>
                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', MODEL_SPEED_BADGES[PREDICTION_MODEL_DESCRIPTIONS[model].speed])}>
                  {PREDICTION_MODEL_DESCRIPTIONS[model].speed}
                </span>
              </div>
              {/* When / How / Use */}
              <div className="px-3 py-2.5 space-y-1">
                <p className="text-[11px] text-[var(--sea-ink-soft)]">
                  <span className="font-semibold text-[var(--lagoon-deep)]">When: </span>
                  {PREDICTION_MODEL_DESCRIPTIONS[model].when}
                </p>
                <p className="text-[11px] text-[var(--sea-ink-soft)]">
                  <span className="font-semibold text-[var(--lagoon-deep)]">How: </span>
                  {PREDICTION_MODEL_DESCRIPTIONS[model].how}
                </p>
                <p className="text-[11px] text-[var(--sea-ink-soft)]">
                  <span className="font-semibold text-[var(--lagoon-deep)]">Use for: </span>
                  {PREDICTION_MODEL_DESCRIPTIONS[model].use}
                </p>
              </div>
              {/* Market behavior rows */}
              <div className="border-t border-[var(--line)]/40 bg-[var(--sand)]/60 px-3 pt-2 pb-2.5 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]/50 mb-2">Market behavior</p>
                {PREDICTION_MODEL_DESCRIPTIONS[model].markets.map(({ market, note }) => (
                  <div key={market} className="flex gap-2 items-baseline">
                    <span className={`shrink-0 rounded border px-1.5 py-px text-[10px] font-bold leading-tight ${MARKET_BADGES[market] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
                      {market}
                    </span>
                    <span className="text-[11px] text-[var(--sea-ink-soft)]">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] text-[var(--sea-ink-soft)]">
          {predictionPreparationMode === 'scrape-auto'
            ? 'Predict automatically loads Frontbet history and upcoming odds-backed matches first. If local data is missing for a single league, it falls back to soccerdata history and external schedules automatically.'
            : 'Predict uses the currently selected local/history sources only. It will not fall back to external scrape-backed data automatically.'}
        </p>

        <Button
          onClick={() => predictMut.mutate()}
          disabled={predictMut.isPending || leagues.length === 0}
        >
          {predictMut.isPending ? (
            <><Spinner className="h-4 w-4" /> Predicting…</>
          ) : (
            `🔮 Predict ${selectedMatches.length || 'future'} matches`
          )}
        </Button>

        {/* Progress bar */}
        {predictMut.isPending && (
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--sand)]">
              <div
                className="h-full rounded-full bg-[var(--lagoon-deep)] transition-all duration-300"
                style={{ width: `${predictionProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-[var(--sea-ink-soft)]">
              {predictionProgress}% complete
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
      </Card>

      {/* Results */}
      {predictions.length > 0 && (
        <Card className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--sea-ink)]">
              📊 Prediction Results
            </h2>
            <span className="rounded-full bg-[var(--lagoon)]/15 px-3 py-1 text-xs font-semibold text-[var(--lagoon-deep)]">
              {predictions.filter((p) => !p.error).length} / {predictions.length} successful
            </span>
          </div>
          <p className="text-xs text-[var(--sea-ink-soft)]">
            Model: <strong>{model}</strong> · Trained on {history.length} matches · {predictions.length} predictions
          </p>

          {/* Overall data quality summary */}
          {(() => {
            const successful = predictions.filter((p) => !p.error && p.dataQuality)
            if (successful.length === 0) return null
            const levels = successful.map((p) => p.dataQuality!.level)
            const worstLevel = levels.includes('very-low') ? 'very-low' : levels.includes('low') ? 'low' : levels.includes('moderate') ? 'moderate' : 'reliable'
            const avgMatches = Math.round(successful.reduce((s, p) => s + (p.dataQuality?.totalMatches ?? 0), 0) / successful.length)
            const lowConfCount = successful.filter((p) => p.dataQuality!.level === 'very-low' || p.dataQuality!.level === 'low').length

            if (worstLevel === 'reliable') return null

            return (
              <div className={`rounded-lg border px-3 py-2 text-[11px] ${
                worstLevel === 'very-low' ? 'border-red-300 bg-red-50 dark:border-red-700/50 dark:bg-red-900/10 text-red-800 dark:text-red-300'
                : worstLevel === 'low' ? 'border-amber-300 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-300'
                : 'border-yellow-300 bg-yellow-50 dark:border-yellow-700/50 dark:bg-yellow-900/10 text-yellow-800 dark:text-yellow-300'
              }`}>
                <p className="font-semibold">
                  {worstLevel === 'very-low' ? '🔴' : worstLevel === 'low' ? '🟠' : '🟡'} Data quality: {worstLevel}
                  {lowConfCount > 0 && ` — ${lowConfCount} of ${successful.length} predictions have low confidence`}
                </p>
                <p className="mt-0.5">
                  Training data: ~{avgMatches} matches.
                  {worstLevel === 'very-low' || worstLevel === 'low'
                    ? ' Scrape 2-3 more seasons or use soccerdata for better accuracy. BTTS is the most reliable market with sparse data.'
                    : ' More history would improve 1X2 accuracy.'
                  }
                </p>
              </div>
            )
          })()}

          <div className="space-y-2">
            {predictions.map((p, i) => (
              <div
                key={i}
                className="rounded-lg border border-[var(--line)]/60 p-3 hover:bg-[var(--lagoon)]/5 transition-colors"
              >
                {/* Match header */}
                <div className="flex items-center justify-between border-b border-[var(--line)]/30 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--sea-ink)]">
                      {p.match.homeTeam} vs {p.match.awayTeam}
                    </span>
                    {p.dataQuality && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                        p.dataQuality.level === 'reliable' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : p.dataQuality.level === 'moderate' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : p.dataQuality.level === 'low' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`} title={`Data quality: ${p.dataQuality.level} — Home: ${p.dataQuality.homeTeamCount} matches, Away: ${p.dataQuality.awayTeamCount} matches (${p.dataQuality.totalMatches} total training)`}>
                        {p.dataQuality.level === 'reliable' ? '✓ reliable'
                          : p.dataQuality.level === 'moderate' ? '~ moderate'
                          : p.dataQuality.level === 'low' ? '⚠ low confidence'
                          : '⚠ very low confidence'}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--sea-ink-soft)]">{p.match.date}</span>
                </div>

                {p.error ? (
                  <p className="text-xs text-red-500">{p.error}</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {p.warnings && p.warnings.length > 0 && (
                      <div className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-1.5">
                        {p.warnings.map((w, i) => (
                          <p key={i} className="text-xs text-amber-600 dark:text-amber-400">{w}</p>
                        ))}
                      </div>
                    )}
                    {p.dataQuality?.recommendation && (!p.warnings || p.warnings.length === 0) && (
                      <div className="rounded bg-blue-500/10 border border-blue-500/20 px-2 py-1.5">
                        <p className="text-[11px] text-blue-700 dark:text-blue-300">
                          💡 {p.dataQuality.recommendation}
                        </p>
                      </div>
                    )}
                    {/* Period selector */}
                    {(p.firstHalf || p.secondHalf) && (
                      <div className="flex items-center gap-1">
                        {(['ft', '1h', '2h'] as const).map((period) => {
                          const label = period === 'ft' ? 'Full Time' : period === '1h' ? '1st Half' : '2nd Half'
                          const active = (periodByMatch[i] ?? 'ft') === period
                          const available = period === 'ft' || (period === '1h' ? !!p.firstHalf : !!p.secondHalf)
                          if (!available) return null
                          return (
                            <button
                              key={period}
                              onClick={() => setPeriodByMatch((prev) => ({ ...prev, [i]: period }))}
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                active
                                  ? 'bg-[var(--lagoon-deep)] text-white'
                                  : 'bg-[var(--sand)] text-[var(--sea-ink-soft)] hover:bg-[var(--lagoon)]/20'
                              }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {(() => {
                      const period = periodByMatch[i] ?? 'ft'
                      const m: PeriodMarkets =
                        period === '1h' && p.firstHalf
                          ? p.firstHalf
                          : period === '2h' && p.secondHalf
                            ? p.secondHalf
                            : p
                      return (
                    <div className="flex flex-wrap gap-x-5 gap-y-3">
                    <MarketGroup title="1X2" tooltip="Match result probability: Home win / Draw / Away win">
                      <MarketCell label="Home" value={m.homeWin} highlight={isHighest(m.homeWin, m.draw, m.awayWin)} />
                      <MarketCell label="Draw" value={m.draw} highlight={isHighest(m.draw, m.homeWin, m.awayWin)} />
                      <MarketCell label="Away" value={m.awayWin} highlight={isHighest(m.awayWin, m.homeWin, m.draw)} />
                    </MarketGroup>

                    <MarketGroup
                      title="Double Chance"
                      tooltip="Covers 2 of 3 outcomes — 1X: home or draw · X2: draw or away · 12: home or away"
                    >
                      <MarketCell label="1X" value={m.dc1X} highlight={isHighest(m.dc1X, m.dcX2, m.dc12)} />
                      <MarketCell label="X2" value={m.dcX2} highlight={isHighest(m.dcX2, m.dc1X, m.dc12)} />
                      <MarketCell label="12" value={m.dc12} highlight={isHighest(m.dc12, m.dc1X, m.dcX2)} />
                    </MarketGroup>

                    <MarketGroup
                      title="Draw No Bet"
                      tooltip="Removes the draw from the equation. Stake is refunded if the match ends in a draw."
                    >
                      <MarketCell label="Home" value={m.dnbHome} highlight={isHighest(m.dnbHome, m.dnbAway)} />
                      <MarketCell label="Away" value={m.dnbAway} highlight={isHighest(m.dnbAway, m.dnbHome)} />
                    </MarketGroup>

                    <MarketGroup
                      title="xG"
                      tooltip="Expected Goals — the model's predicted average number of goals each team is likely to score"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-[var(--sea-ink-soft)]/60">Home</span>
                        <span className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-[var(--sea-ink)]">
                          {m.homeGoalExp != null ? m.homeGoalExp.toFixed(2) : '—'}
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-[var(--sea-ink-soft)]/60">Away</span>
                        <span className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-[var(--sea-ink)]">
                          {m.awayGoalExp != null ? m.awayGoalExp.toFixed(2) : '—'}
                        </span>
                      </div>
                    </MarketGroup>

                    <MarketGroup
                      title="Totals"
                      tooltip="Probability that the total goals scored will be Over or Under the given threshold (1.5 / 2.5 / 3.5)"
                    >
                      <MarketCell label="O1.5" value={m.over15} highlight={false} />
                      <MarketCell label="U1.5" value={m.under15} highlight={false} />
                      <MarketCell label="O2.5" value={m.over25} highlight={isHighest(m.over25, m.under25)} />
                      <MarketCell label="U2.5" value={m.under25} highlight={isHighest(m.under25, m.over25)} />
                      <MarketCell label="O3.5" value={m.over35} highlight={false} />
                      <MarketCell label="U3.5" value={m.under35} highlight={false} />
                    </MarketGroup>

                    <MarketGroup
                      title="BTTS"
                      tooltip="Both Teams To Score — probability that both the home and away team will score at least one goal"
                    >
                      <MarketCell label="Yes" value={m.bttsYes} highlight={isHighest(m.bttsYes, m.bttsNo)} />
                      <MarketCell label="No" value={m.bttsNo} highlight={isHighest(m.bttsNo, m.bttsYes)} />
                    </MarketGroup>

                    <MarketGroup
                      title="Asian HCP"
                      tooltip="Asian Handicap ±0.5 — AH -0.5 (home must win outright) · AH +0.5 (away must not lose)"
                    >
                      <MarketCell label="-0.5" value={m.ahHome} highlight={isHighest(m.ahHome, m.ahAway)} />
                      <MarketCell label="+0.5" value={m.ahAway} highlight={isHighest(m.ahAway, m.ahHome)} />
                    </MarketGroup>
                  </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Save to Prediction History */}
          <div className="flex items-center gap-3 border-t border-[var(--line)] pt-4">
            {isAutoSaving || saveHistoryMut.isPending ? (
              <span className="flex items-center gap-1.5 text-sm text-[var(--sea-ink-soft)]">
                <Spinner className="h-4 w-4" /> Saving to history…
              </span>
            ) : historySavedId != null ? (
              <>
                <span className="text-sm text-emerald-600 dark:text-emerald-400">
                  ✓ Saved to history (Session #{historySavedId})
                </span>
                <a href={`/predict?tab=history`}
                  className="text-xs text-[var(--lagoon-deep)] underline-offset-2 hover:underline"
                >
                  View in History →
                </a>
              </>
            ) : (
              <Button
                onClick={() => saveHistoryMut.mutate()}
                disabled={saveHistoryMut.isPending}
                className="text-sm"
              >
                💾 Save to Prediction History
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Step 5: Generate Ticket from Predictions */}
      {predictions.filter((p) => !p.error).length > 0 && (
        <Card className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--sea-ink)]">
              🎫 Generate Ticket from Predictions
            </h2>
            {valueBets.length > 0 && (
              <span className="rounded-full bg-[var(--lagoon)]/15 px-3 py-1 text-xs font-semibold text-[var(--lagoon-deep)]">
                {valueBets.filter((b) => b.edge > 0).length} value bets found
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--sea-ink-soft)]">
            Compares model probabilities against best bookmaker odds in your database to find value bets.
            Matches teams by name — works best when DB odds are for the same league and date range.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => findBetsMut.mutate()}
              disabled={findBetsMut.isPending}
            >
              {findBetsMut.isPending ? (
                <><Spinner className="h-4 w-4" /> Scanning DB for odds…</>
              ) : (
                '🔍 Find Value Bets in DB'
              )}
            </Button>
          </div>

          {findBetsMut.isSuccess && valueBets.length === 0 && (
            <p className="text-sm text-[var(--sea-ink-soft)]">
              No matching odds found in the database. Scrape upcoming odds for this league from the Data Hub first.
            </p>
          )}

          {valueBets.length > 0 && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="mb-1 block">Min Edge %</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="-50"
                      max="50"
                      step="0.5"
                      value={minEdgePct}
                      onChange={(e) => setMinEdgePct(e.currentTarget.value)}
                      className="w-20"
                    />
                    <Button
                      variant="ghost"
                      className="text-xs"
                      onClick={() => {
                        const threshold = (parseFloat(minEdgePct) || 0) / 100
                        setSelectedBetKeys(
                          new Set(valueBets.filter((b) => b.edge >= threshold).map((b) => b.key)),
                        )
                        setSelectedCandidateKeys(
                          new Set(ticketCandidates.filter((b) => b.edge >= threshold).map((b) => b.key)),
                        )
                      }}
                    >
                      Apply filter
                    </Button>
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    className="text-xs text-[var(--lagoon-deep)] hover:underline"
                    onClick={() => setSelectedBetKeys(new Set(valueBets.map((b) => b.key)))}
                  >
                    Select all
                  </button>
                  {' · '}
                  <button
                    type="button"
                    className="text-xs text-[var(--sea-ink-soft)] hover:underline"
                    onClick={() => setSelectedBetKeys(new Set())}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--sand)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--sea-ink)]">
                      Match List for Ticket Generation
                    </h3>
                    <p className="text-xs text-[var(--sea-ink-soft)]">
                      Uses the best value bet per match so you can review all matches first, then optionally generate tickets.
                    </p>
                  </div>
                  <div className="text-xs text-[var(--sea-ink-soft)]">
                    {ticketCandidates.length} matches available
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <button
                    type="button"
                    className="text-[var(--lagoon-deep)] hover:underline"
                    onClick={() => setSelectedCandidateKeys(new Set(ticketCandidates.map((bet) => bet.key)))}
                  >
                    Select all matches
                  </button>
                  <button
                    type="button"
                    className="text-[var(--sea-ink-soft)] hover:underline"
                    onClick={() => setSelectedCandidateKeys(new Set())}
                  >
                    Clear matches
                  </button>
                </div>

                <div className="max-h-[320px] overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
                  {ticketCandidates.map((bet) => {
                    const checked = selectedCandidateKeys.has(bet.key)
                    return (
                      <label
                        key={bet.key}
                        className="flex cursor-pointer items-start gap-3 border-b border-[var(--line)]/40 px-3 py-2 text-sm hover:bg-[var(--lagoon)]/5"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedCandidateKeys((prev) => {
                              const next = new Set(prev)
                              if (next.has(bet.key)) next.delete(bet.key)
                              else next.add(bet.key)
                              return next
                            })
                          }
                          className="mt-1 accent-[var(--lagoon-deep)]"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-[var(--sea-ink)]">
                              {bet.homeTeam} vs {bet.awayTeam}
                            </span>
                            <span className="text-[10px] text-[var(--sea-ink-soft)]">
                              {bet.matchDate ?? 'No date'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--sea-ink-soft)]">
                            <span>{bet.label}</span>
                            <span>· {bet.bookmaker}</span>
                            <span>· Odds {bet.bestOdds.toFixed(2)}</span>
                            <span className={bet.edge > 0 ? 'text-emerald-600' : 'text-red-500'}>
                              Edge {bet.edge > 0 ? '+' : ''}{(bet.edge * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>

                <label className="flex items-center gap-2 text-sm text-[var(--sea-ink)]">
                  <input
                    type="checkbox"
                    checked={generateTicketsEnabled}
                    onChange={(event) => setGenerateTicketsEnabled(event.currentTarget.checked)}
                    className="accent-[var(--lagoon-deep)]"
                  />
                  Generate tickets from the current ticket list
                </label>

                {generateTicketsEnabled && (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div>
                        <Label className="mb-1 block">Ticket source</Label>
                        <Select
                          value={ticketGenerationSource}
                          onValueChange={(value) => setTicketGenerationSource(value as TicketGenerationSource)}
                          options={TICKET_GENERATION_SOURCES}
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block">Number of tickets</Label>
                        <Select
                          value={ticketCount}
                          onValueChange={setTicketCount}
                          options={Array.from({ length: 10 }, (_, index) => ({
                            label: `${index + 1}`,
                            value: `${index + 1}`,
                          }))}
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block">Matches per ticket</Label>
                        <Select
                          value={matchesPerTicket}
                          onValueChange={setMatchesPerTicket}
                          options={Array.from({ length: 8 }, (_, index) => ({
                            label: `${index + 2}`,
                            value: `${index + 2}`,
                          }))}
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block">Ticket strategy</Label>
                        <Select
                          value={ticketBuildStrategy}
                          onValueChange={(value) => setTicketBuildStrategy(value as TicketBuildStrategy)}
                          options={TICKET_BUILD_STRATEGIES}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="sm:col-span-3 rounded-xl border border-[var(--line)] bg-[var(--sand)] px-3 py-2 text-xs text-[var(--sea-ink-soft)]">
                        {ticketGenerationSource === 'best-per-match'
                          ? 'Best-per-match keeps the single strongest value bet for each match before building tickets.'
                          : 'Selected-value-bets uses the exact value bets currently selected in the results table, even when multiple bets come from the same match.'}
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={() => generateBatchTicketsMut.mutate()}
                          disabled={!generateTicketsEnabled || generateBatchTicketsMut.isPending || selectedCandidateKeys.size === 0}
                          className="w-full"
                        >
                          {generateBatchTicketsMut.isPending ? (
                            <><Spinner className="h-4 w-4" /> Generating tickets…</>
                          ) : (
                            'Generate Tickets'
                          )}
                        </Button>
                      </div>
                    </div>

                    {ticketGenerationSource === 'selected-value-bets' && duplicateTicketMatches.length > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
                        {duplicateTicketMatches.length} fixture{duplicateTicketMatches.length === 1 ? '' : 's'} currently {duplicateTicketMatches.length === 1 ? 'contributes' : 'contribute'} multiple selected legs: {duplicateTicketMatches.map((item) => `${item.label} (${item.count})`).join(', ')}.
                      </div>
                    )}

                    <div>
                      <label className="flex items-center gap-2 text-sm text-[var(--sea-ink)]">
                        <input
                          type="checkbox"
                          checked={useAllSelectedMatches}
                          onChange={(event) => setUseAllSelectedMatches(event.currentTarget.checked)}
                          className="accent-[var(--lagoon-deep)]"
                        />
                        Use all selected matches, even if the last ticket has fewer matches
                      </label>
                    </div>
                  </div>
                )}

                {generateTicketsEnabled && (
                  <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                    <div className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--sand)] p-3 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[var(--sea-ink-soft)]">Selected items</p>
                        <p className="font-semibold text-[var(--sea-ink)]">{orderedTicketCandidates.length}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[var(--sea-ink-soft)]">Tickets possible</p>
                        <p className="font-semibold text-[var(--sea-ink)]">{maxTicketCountAvailable}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[var(--sea-ink-soft)]">Matches used in preview</p>
                        <p className="font-semibold text-[var(--sea-ink)]">{previewMatchesUsed}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[var(--sea-ink-soft)]">Unused matches</p>
                        <p className="font-semibold text-[var(--sea-ink)]">{previewMatchesUnused}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--sea-ink)]">Ticket Preview</h4>
                        <p className="text-xs text-[var(--sea-ink-soft)]">
                          Preview uses the current strategy and matches the exact tickets that will be saved.
                        </p>
                      </div>
                      <div className="text-xs text-[var(--sea-ink-soft)]">
                        {previewTicketBatches.length} preview ticket{previewTicketBatches.length === 1 ? '' : 's'} ready
                      </div>
                    </div>

                    {previewTicketBatches.length > 0 ? (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {previewTicketBatches.map((batch, batchIndex) => (
                          <div
                            key={`ticket-preview-${batchIndex + 1}`}
                            className="rounded-xl border border-[var(--line)] bg-[var(--sand)] p-3"
                          >
                            {(() => {
                              const stats = previewTicketBatchStats[batchIndex]
                              return (
                                <div className="mb-3 grid gap-2 rounded-lg border border-[var(--line)]/60 bg-[var(--surface)] p-3 text-xs sm:grid-cols-4">
                                  <div>
                                    <p className="uppercase tracking-wide text-[var(--sea-ink-soft)]">Combined odds</p>
                                    <p className="font-semibold text-[var(--sea-ink)]">{stats.combinedOdds.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="uppercase tracking-wide text-[var(--sea-ink-soft)]">Combined hit rate</p>
                                    <p className="font-semibold text-[var(--sea-ink)]">{(stats.combinedProbability * 100).toFixed(1)}%</p>
                                  </div>
                                  <div>
                                    <p className="uppercase tracking-wide text-[var(--sea-ink-soft)]">Potential return</p>
                                    <p className="font-semibold text-[var(--sea-ink)]">{tkCurrency}{stats.potentialReturn.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="uppercase tracking-wide text-[var(--sea-ink-soft)]">Expected value</p>
                                    <p className={cn('font-semibold', stats.expectedValue >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                                      {stats.expectedValue >= 0 ? '+' : ''}{(stats.expectedValue * 100).toFixed(1)}%
                                    </p>
                                  </div>
                                </div>
                              )
                            })()}
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-[var(--sea-ink)]">
                                Ticket {batchIndex + 1}
                              </span>
                              <span className="text-[11px] text-[var(--sea-ink-soft)]">
                                {batch.length} matches
                              </span>
                            </div>
                            <div className="space-y-2">
                              {batch.map((bet) => (
                                <div
                                  key={`ticket-preview-${batchIndex + 1}-${bet.key}`}
                                  className="rounded-lg border border-[var(--line)]/60 bg-[var(--surface)] px-3 py-2"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                    <span className="font-medium text-[var(--sea-ink)]">
                                      {bet.homeTeam} vs {bet.awayTeam}
                                    </span>
                                    <span className="text-[10px] text-[var(--sea-ink-soft)]">
                                      {bet.matchDate ?? 'No date'}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--sea-ink-soft)]">
                                    <span>{bet.label}</span>
                                    <span>· {bet.bookmaker}</span>
                                    <span>· Odds {bet.bestOdds.toFixed(2)}</span>
                                    <span className={bet.edge > 0 ? 'text-emerald-600' : 'text-red-500'}>
                                      Edge {bet.edge > 0 ? '+' : ''}{(bet.edge * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--sea-ink-soft)]">
                        Select enough matches to fill at least one full ticket preview.
                      </p>
                    )}
                  </div>
                )}

                {ticketBatchResult && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                    Generated {ticketBatchResult.generatedCount} of {ticketBatchResult.requestedCount} requested tickets using {ticketBatchResult.matchesPerTicket} matches per ticket from {ticketBatchResult.selectedMatchesCount} selected matches.
                    {' '}
                    <a href={`/tickets?tab=generate`} className="underline hover:no-underline">
                      View saved tickets →
                    </a>
                  </div>
                )}
              </div>

              {/* Value bets table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-[var(--line)] text-xs">
                      <th className="px-2 py-2 text-left font-semibold text-[var(--sea-ink-soft)]">✓</th>
                      <th className="px-2 py-2 text-left font-semibold text-[var(--sea-ink-soft)]">Match (DB)</th>
                      <th className="px-2 py-2 text-left font-semibold text-[var(--sea-ink-soft)]">Bet</th>
                      <th className="px-2 py-2 text-center font-semibold text-[var(--sea-ink-soft)]">Model %</th>
                      <th className="px-2 py-2 text-center font-semibold text-[var(--sea-ink-soft)]">Odds</th>
                      <th className="px-2 py-2 text-center font-semibold text-[var(--sea-ink-soft)]">Implied %</th>
                      <th className="px-2 py-2 text-center font-semibold text-[var(--sea-ink-soft)]">Edge</th>
                      <th className="px-2 py-2 text-center font-semibold text-[var(--sea-ink-soft)]">EV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valueBets.map((bet, index) => {
                      const checked = selectedBetKeys.has(bet.key)
                      const isValue = bet.edge > 0
                      return (
                        <tr
                          key={`${bet.key}-${index}`}
                          onClick={() =>
                            setSelectedBetKeys((prev) => {
                              const next = new Set(prev)
                              next.has(bet.key) ? next.delete(bet.key) : next.add(bet.key)
                              return next
                            })
                          }
                          className={cn(
                            'cursor-pointer border-b border-[var(--line)]/50 transition',
                            checked
                              ? 'bg-[var(--lagoon)]/5'
                              : 'hover:bg-[var(--sand)]/50',
                          )}
                        >
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              className="accent-[var(--lagoon-deep)]"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <p className="font-medium text-[var(--sea-ink)]">
                              {bet.homeTeam} vs {bet.awayTeam}
                            </p>
                            <p className="text-[10px] text-[var(--sea-ink-soft)]">
                              {bet.matchDate ?? '—'} · {bet.league ?? bet.sport}
                            </p>
                          </td>
                          <td className="px-2 py-2">
                            <span className="font-semibold text-[var(--sea-ink)]">{bet.label}</span>
                            <span className="ml-1 text-[10px] text-[var(--sea-ink-soft)]">· {bet.bookmaker}</span>
                          </td>
                          <td className="px-2 py-2 text-center tabular-nums text-[var(--sea-ink)]">
                            {(bet.modelProb * 100).toFixed(1)}%
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className="rounded-lg bg-[var(--lagoon-deep)] px-2 py-0.5 text-xs font-bold text-white">
                              {bet.bestOdds.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center tabular-nums text-[var(--sea-ink-soft)]">
                            {(bet.impliedProb * 100).toFixed(1)}%
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={cn(
                                'font-bold tabular-nums',
                                isValue ? 'text-emerald-600' : 'text-red-500',
                              )}
                            >
                              {isValue ? '+' : ''}{(bet.edge * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={cn(
                                'text-xs font-semibold tabular-nums',
                                bet.expectedValue > 0 ? 'text-emerald-600' : 'text-red-500',
                              )}
                            >
                              {bet.expectedValue > 0 ? '+' : ''}{(bet.expectedValue * 100).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Ticket configuration */}
              <div className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--sand)] p-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="tk-pred-name" className="mb-1 block">Ticket name</Label>
                  <Input
                    id="tk-pred-name"
                    placeholder="e.g. Value acca"
                    value={tkName}
                    onChange={(e) => setTkName(e.currentTarget.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="tk-pred-stake" className="mb-1 block">Stake</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[var(--sea-ink-soft)]">
                      {tkCurrency}
                    </span>
                    <Input
                      id="tk-pred-stake"
                      type="number"
                      min="0.1"
                      step="0.5"
                      value={tkStake}
                      onChange={(e) => setTkStake(e.currentTarget.value)}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="tk-pred-currency" className="mb-1 block">Currency</Label>
                  <Select
                    value={tkCurrency}
                    onValueChange={setTkCurrency}
                    options={[
                      { label: '€ Euro', value: '€' },
                      { label: '$ Dollar', value: '$' },
                      { label: '£ Pound', value: '£' },
                      { label: 'RON', value: 'RON' },
                    ]}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => saveTicketMut.mutate()}
                  disabled={selectedBetKeys.size === 0 || saveTicketMut.isPending}
                >
                  {saveTicketMut.isPending ? (
                    <><Spinner className="h-4 w-4" /> Saving…</>
                  ) : (
                    `💾 Save Ticket (${selectedBetKeys.size} ${selectedBetKeys.size === 1 ? 'leg' : 'legs'})`
                  )}
                </Button>

                {tkSavedId && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                    ✓ Ticket #{tkSavedId} saved!
                    {' '}
                    <a href={`/tickets?tab=generate`} className="underline hover:no-underline">
                      View in Tickets →
                    </a>
                  </span>
                )}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
    {/* Right sidebar: Active Processes */}
    <ProcessPanel
      processes={activeProcesses}
      onDismiss={dismissProcess}
      logs={processLogs}
      onClearLogs={() => setProcessLogs([])}
    />
    </div>
  )
}

// ─── Types & Helpers ──────────────────────────────────────────────────────────

type PeriodMarkets = {
  homeWin: number | null
  draw: number | null
  awayWin: number | null
  homeGoalExp: number | null
  awayGoalExp: number | null
  dc1X: number | null
  dcX2: number | null
  dc12: number | null
  dnbHome: number | null
  dnbAway: number | null
  over15: number | null
  under15: number | null
  over25: number | null
  under25: number | null
  over35: number | null
  under35: number | null
  bttsYes: number | null
  bttsNo: number | null
  ahHome: number | null
  ahAway: number | null
}

type DataQuality = {
  level: 'reliable' | 'moderate' | 'low' | 'very-low'
  homeTeamCount: number
  awayTeamCount: number
  totalMatches: number
  recommendation: string | null
}

type PredictionResult = PeriodMarkets & {
  match: UpcomingMatch
  model: string
  firstHalf: PeriodMarkets | null
  secondHalf: PeriodMarkets | null
  error: string | null
  warnings: string[] | null
  dataQuality: DataQuality | null
}

function isHighest(value: number | null, ...others: (number | null)[]) {
  if (value == null) return false
  return others.every((o) => o == null || value >= o)
}

function getTicketCandidates(bets: ValueBet[]) {
  const byMatch = new Map<number, ValueBet>()

  for (const bet of bets) {
    const existing = byMatch.get(bet.matchId)
    if (!existing || bet.edge > existing.edge) {
      byMatch.set(bet.matchId, bet)
    }
  }

  return [...byMatch.values()].sort((a, b) => {
    const timeDiff = (getMatchTimestamp(a.matchDate ?? '') ?? Number.MAX_SAFE_INTEGER)
      - (getMatchTimestamp(b.matchDate ?? '') ?? Number.MAX_SAFE_INTEGER)
    if (timeDiff !== 0) return timeDiff
    return b.edge - a.edge
  })
}

function orderTicketCandidates(bets: ValueBet[], strategy: TicketBuildStrategy) {
  if (strategy === 'highest-edge-first') {
    return [...bets].sort((a, b) => b.edge - a.edge)
  }

  if (strategy === 'balanced-mix') {
    const sorted = [...bets].sort((a, b) => b.edge - a.edge)
    const balanced: ValueBet[] = []
    let left = 0
    let right = sorted.length - 1

    while (left <= right) {
      balanced.push(sorted[left])
      if (left !== right) {
        balanced.push(sorted[right])
      }
      left += 1
      right -= 1
    }

    return balanced
  }

  return [...bets].sort((a, b) => {
    const timeDiff = (getMatchTimestamp(a.matchDate ?? '') ?? Number.MAX_SAFE_INTEGER)
      - (getMatchTimestamp(b.matchDate ?? '') ?? Number.MAX_SAFE_INTEGER)
    if (timeDiff !== 0) return timeDiff
    return b.edge - a.edge
  })
}

function calcPreviewTicketStats(bets: ValueBet[], stake: number) {
  if (bets.length === 0) {
    return {
      combinedOdds: 1,
      combinedProbability: 1,
      expectedValue: 0,
      potentialReturn: 0,
    }
  }

  const combinedOdds = bets.reduce((total, bet) => total * bet.bestOdds, 1)
  const combinedProbability = bets.reduce((total, bet) => total * bet.modelProb, 1)
  const expectedValue = combinedProbability * combinedOdds - 1
  const potentialReturn = stake * combinedOdds

  return {
    combinedOdds,
    combinedProbability,
    expectedValue,
    potentialReturn,
  }
}

function createTicketBatches<T>(items: T[], chunkSize: number, limit: number, includePartialLast: boolean) {
  const chunks: T[][] = []

  if (chunkSize <= 0 || limit <= 0) {
    return chunks
  }

  for (let index = 0; index < items.length && chunks.length < limit; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize)
    if (chunk.length === chunkSize || (includePartialLast && chunk.length > 0)) {
      chunks.push(chunk)
    }
  }

  return chunks
}

function MarketGroup({
  title,
  tooltip,
  children,
}: {
  title: string
  tooltip: string
  children: React.ReactNode
}) {
  return (
    <div className="relative group/mg">
      <div className="flex items-center gap-0.5 mb-1.5 cursor-default select-none">
        <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sea-ink-soft)]/70">
          {title}
        </span>
        <span className="text-[9px] text-[var(--sea-ink-soft)]/40">ⓘ</span>
      </div>
      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 hidden group-hover/mg:block">
        <div className="max-w-[220px] rounded bg-gray-900 px-2.5 py-1.5 text-[11px] leading-snug text-gray-100 shadow-lg ring-1 ring-white/10">
          {tooltip}
        </div>
        <div className="ml-3 h-1.5 w-1.5 rotate-45 bg-gray-900 -mt-1" />
      </div>
      <div className="flex gap-1.5">{children}</div>
    </div>
  )
}

function MarketCell({
  label,
  value,
  highlight,
}: {
  label: string
  value: number | null
  highlight: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-[var(--sea-ink-soft)]/60">{label}</span>
      <ProbBadge value={value} highlight={highlight} />
    </div>
  )
}

function formatOdd(prob: number): string {
  const raw = 1 / prob
  if (raw > 99) return '99+'
  if (raw < 1.01) return '1.01'
  return raw.toFixed(2)
}

function ProbBadge({ value, highlight }: { value: number | null; highlight: boolean }) {
  if (value == null) return <span className="text-xs text-[var(--sea-ink-soft)]">—</span>

  const pct = (value * 100).toFixed(1)
  const odd = formatOdd(value)
  const isExtreme = value < 0.02 || value > 0.98
  return (
    <span
      className={`inline-flex flex-col items-center rounded px-1.5 py-0.5 ${
        highlight
          ? 'bg-[var(--lagoon)]/15 text-[var(--lagoon-deep)]'
          : 'text-[var(--sea-ink)]'
      }`}
    >
      <span className="text-xs font-semibold">{pct}%</span>
      <span className={`text-[10px] font-normal ${isExtreme ? 'opacity-30' : 'opacity-60'}`}>{odd}</span>
    </span>
  )
}
