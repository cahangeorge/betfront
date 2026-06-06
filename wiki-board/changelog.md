# Changelog

## 2026-06-05 — Auth Fixes + Backend Extensions + New Pages
### Fixed
- **Frontend API client** — Changed from FormData to /auth/* to JSON body to /api/v1/auth/* endpoints
- **Backend deps.py** — Accepts both Bearer header and httpOnly cookies for JWT verification
- **CORS configuration** — Expanded to include port 5174 for frontend dev server

### Added
- **MatchStat 8 new fields** — yellow_cards_home, yellow_cards_away, red_cards_home, red_cards_away, fouls_home, fouls_away, offsides_home, offsides_away
- **Strategy model** — name, model_type (str), parameters (JSON), weights (JSON), is_active (bool)
- **4 new API modules**: dashboard.py (4 endpoints), analytics.py (4 endpoints), catalog.py (3 endpoints), strategies.py (6 endpoints)
- **4 new schema modules** for dashboard, analytics, catalog, strategies
- **Alembic migration 002** — MatchStat extension + Strategy model
- **Dashboard page** — 4 sections: Recent Tickets, Upcoming Matches, Account P&L chart (layerchart EquityCurveChart), Job Logs
- **Data Hub page** — Unified table (3 tabs), search, date filter, pagination, CSV export, detail dialog
- **Scraping page** — Country/league multi-select from catalog API, time period selectors, auto-scrape toggle, job table
- **Predictions page** — Strategy card grid, market checkboxes, run with progress, results per strategy, CSV export

## 2026-06-04 — UI Overhaul COMPLETE
### Completed
- **All 66 tasks across 6 phases completed** with verification loops after each phase
- **Phase 1 (Foundation):** shadcn-svelte installed, 13 component directories (60+ files), HSL token system, football accent colors
- **Phase 2 (Migration):** 7 UI primitives replaced, 18 domain components migrated, 156 legacy CSS references cleaned from 11 route pages
- **Phase 3 (Charts):** layerchart 1.0.13 installed, 7 chart components created (OddsMovement, EquityCurve, PnLByLeague, WinRateByModel, EdgeDistribution, xGTimeline, OddsComparison)
- **Phase 4 (Layout):** Three-column desktop + bottom nav mobile + betslip FAB, responsive CSS grid
- **Phase 5 (Theme Toggle):** ThemeToggle with Sun/Moon, localStorage persistence, system preference detection, flash prevention
- **Phase 6 (Polish):** Page transitions, card hover effects, loading skeletons, PWA meta tags, skip-to-content, ARIA labels, focus indicators, reduced motion, landmark roles
- **Container rebuilt:** All 4 services verified (Frontend 200, Backend 200, PostgreSQL accepting, Redis PONG)

## 2026-06-04 — UI Overhaul Plan (shadcn-svelte + layerchart)
### Added
- **UI overhaul plan** (`ui-overhaul-plan.md`): 6-phase plan to replace Stadium Intel theme with shadcn-svelte + layerchart + PWA-first design
- **UI overhaul tasks** (`ui-overhaul-tasks.md`): 40 detailed tasks across 6 phases
- **UI overhaul research** (`ui-overhaul-research.md`): Library references (shadcn-svelte, layerchart), football color reference (FIFA WC 2026, Euro 2024), Tailwind v4 setup
- **Key decisions**: Fully replace Stadium Intel, rounded corners, three-column desktop + bottom sheet mobile, phone-first PWA, glassmorphism/transparency
- **Estimated effort**: 16–22 hours

## 2026-06-04 — HELIOS Futuristic Theme Applied
### Added
- **HELIOS design system**: Void black (#06080C) base, neon cyan/violet accents, glassmorphism cards, glow effects, 6 custom animations, custom scrollbar
- **20 files** updated: app.css (complete rewrite), app.html (Google Fonts + theme-color), +layout.svelte (glass sidebar + status bar), +page.svelte (hero + glowing stats), all components and pages restyled
- **Sidebar**: Dark glass with lucide-svelte icons, cyan left-border active indicator, connection status + version badge
- **Navbar**: Live digital clock (HH:MM:SS), green pulsing connection dot, gradient avatar
- **Card**: New glass, glow-cyan, glow-violet, interactive hover variants
- **Button**: New glow variant with matching color shadow
- **Badge**: New live (pulsing green dot), premium (gold-magenta gradient), profit/loss variants
- **Ticker**: Glassmorphism strip, neon-cyan home odds, neon-violet away odds
- **Loading**: Dual rotating rings (cyan outer, violet inner, opposite directions)
- **Input**: Cyan focus ring, dark surface background
- **Tabs**: Cyan underline active indicator with glow
- **All pages**: Consistent dark theme, glass card patterns, gradient text headings
- **Dependencies**: lucide-svelte ^0.500.0 for UI icons
- Build verified — SSR + client bundles compile cleanly

## 2026-06-04 — Full Stack Migration
### Added
- `wiki-board/` planning documentation directory with 8 markdown files
- `/board` page — live odds ticker (Astro + React)
- `Ticker.tsx` — infinite-scroll match cards with 1/X/2 odds
- `/board` to `PUBLIC_PATHS` in middleware for unauthenticated access
- **FastAPI backend** (`backend/`): 45 files, 18 SQLAlchemy async models, 35 API routes, JWT auth, prediction engine, 8 model types, Python bridge services
- **SvelteKit frontend** (`frontend/`): 62 files, 9 pages, 12 components, 7 UI primitives, Svelte 5 runes, PWA service worker + manifest, Tailwind v4 dark theme
- **Docker Compose** (`docker-compose.yml`): PostgreSQL 16, Redis 7, FastAPI backend, SvelteKit frontend, Nginx — 5 services with health checks
- **Multi-stage Dockerfiles** for backend (Python 3.12-slim + poetry) and frontend (Node 22 + pnpm)
- **Setup/seed scripts**: `scripts/setup.sh`, `scripts/seed.sh` — one-command infra boot
- `migration-plan.md` — 4-phase migration roadmap

### Fixed
- Dockerfile runtime stage now rebuilds native modules (`better-sqlite3`)
- Container runs successfully on `127.0.0.1:3002`

### Changed
- Renamed `board/` → `wiki-board/` at project root
- Architecture converged from Astro+React+Prisma+SQLite to FastAPI+SvelteKit+PostgreSQL+Redis

## 2026-06-03 — Sprint 13: Data Expansion
### Added
- Bulk fetch 5,256 matches across 5 leagues / 3 seasons from football-data.org
- `scripts/expand_data.py` — bulk CSV expansion across leagues/seasons
- Out-of-sample backtest: 276 trades, 55.8% WR, Sharpe 0.18, max drawdown 0.05%
- League breakdown: Serie A 62.7% WR, La Liga 54.4%, Ligue 1 57.7%, PL 51.0%, Bundesliga 50.0%

## 2026-06-03 — Sprint 12: SvelteKit Dashboard
### Added
- SvelteKit 2 + Svelte 5 + Tailwind v4 frontend scaffold
- 7 dashboard pages: Dashboard, Matches, Match Detail, Bot Control, Trades, Backtest, Models, Stats
- Dark theme with `#0f172a` background and `#38bdf8` accent
- 5-second auto-refresh polling on all live pages
- Skeleton shimmer loading states
- Client-side pagination (20 per page) on Matches and Trades
- SVG equity curve chart (inline, no library dependency)
- Structured result cards (models/backtest) replacing raw JSON dumps
- Modal popup for momentum display (stats page)

### Fixed
- Match detail page now fetches single match via API instead of loading ALL matches
- Prediction on match detail now uses actual match teams (not hardcoded Arsenal/Chelsea)
- `<slot>` deprecated in Svelte 5 → replaced with `children()` + `$props()`
- `$effect` store subscription anti-pattern → uses `$derived` + `$effect` cleanly
- Backtest page now uses `api.fitAndEval()` instead of bypassing API client

## 2026-06-03 — Sprint 11: Backtesting Engine
### Added
- `training/backtest.py` — BacktestEngine class
- Metrics: Sharpe ratio, max drawdown %, profit factor, ROI, equity curve
- Edge distribution (buckets: 0.0-0.1, 0.1-0.2, etc.) with win rate per bucket
- Win rate by odds range (<2.0, 2-3, 3-5, 5+)
- League breakdown (trades, wins, P&L, avg edge per league)
- Out-of-sample mode: trains on first 80%, tests on last 20%
- CLI script: `scripts/backtest_cli.py`

## 2026-06-03 — Sprint 10: Paper Trading Simulator
### Added
- `scripts/paper_sim.py` — configurable simulation engine
- Simulates trades against historical odds with configurable noise
- Parameters: `--stake`, `--kelly`, `--edge`, `--interval`, `--matches`
- Demo result: 10 trades, 90% WR, avg odds 1.95, avg edge 7.38%

## 2026-06-03 — Sprint 9: Exchange Credential Integration
### Added
- Betfair SSO login method (`identitysso.betfair.com`)
- Matchbook REST client (`api.matchbook.com`)
  - Free tier: up to 1M GET requests/month
  - 2% commission on net profit only (no commission on losing bets)
- Dual-exchange execution routing in ExecutionService
- `.env.example` with all credential placeholders documented

## 2026-06-03 — Sprint 8: Live Stats Feed
### Added
- `stats/football_data_feed.py` — async client for football-data.org/v4
- `stats/understat_feed.py` — scrapes Understat match data (shots, xG timeline)
- `stats/live_ingester.py` — LiveStatsIngester background daemon (60s poll)
- Data API routes: `/data/ingester/status`, `/data/ingester/start`, `/data/ingester/stop`, `/data/expand-csv`

## 2026-06-03 — Sprint 7: Real Model Training
### Added
- penaltyblog `PoissonGoalsModel` wrapper (`predictions/models.py`)
- `DixonColesGoalModel` wrapper with graceful fallback on sparse data
- `FittedPredictionService` — auto-loads `models/latest.joblib` from disk
- `ModelTrainer` — fits both models, persists with joblib
- Calibration: Expected Calibration Error (ECE), Brier score
- Training routes: `/training/import-csv`, `/training/fit`, `/training/fit-and-eval`
- `data/historical_matches.csv` — 60 matches across PL, La Liga, Serie A, Bundesliga, Ligue 1

### Fixed
- Dixon-Coles negative probabilities with sparse data → graceful Poisson fallback
- ` FootballProbabilityGrid` API mismatch (`.home_win` vs `.home`)

## 2026-06-03 — Sprint 6: Momentum + Contrarian Entry
### Added
- `live_engine/momentum.py` — MomentumScorer
  - Formula: M(t) = w1*xG + w2*SoT*0.1 + w3*poss*0.02 + w4*attacks*0.005 - w5*cards*0.05
  - Intensity labels: neutral / moderate / strong / overwhelming
- `live_engine/probability_updater.py` — LiveProbabilityUpdater
  - Goal shrinks conceding team by 0.6x
  - Momentum shifts probabilities by scaled offset
  - 2+ goal leads in 2nd half get bonus
  - Renormalizes to sum to 1.0
- `live_engine/value_detector.py` — `detect_contrarian()`
  - Finds teams at odds ≥3.0 where momentum is negative but model edge ≥15%
- Stats API routes: `/stats/momentum/{id}`, `/stats/history/{id}`, `/stats/ingest/{id}`

## 2026-06-03 — Sprint 5: Live Trading Engine (Full Rebuild)
### Added
- `live_engine/value_detector.py` — ValueDetector with implied probability + Kelly edge
- `live_engine/risk_manager.py` — RiskManager with 7 gates
- `live_engine/execution.py` — ExecutionService (paper + real modes)
- `live_engine/bot_daemon.py` — LiveBotDaemon async loop
- Bot API routes: `/bot/start`, `/bot/stop`, `/bot/status`, `/bot/trades`, `/bot/paper/settle`
- Exchange clients: Betfair (JSON-RPC), Smarkets (REST v3), Matchbook (REST)

### Fixed
- Total workspace loss → full rebuild from memory
- SQLite compatibility (String IDs instead of UUID)
- Auth /me endpoint UUID comparison bug

## 2026-06-03 — Sprint 4: Exchange API Clients
### Added
- `exchanges/betfair.py` — Betfair API-NG client
- `exchanges/smarkets.py` — Smarkets REST v3 client
- `exchanges/matchbook.py` — Matchbook REST client
- `exchanges/ingestion.py` — OddsIngestionEngine with Redis cache
- Ingestion routes: `/ingestion/betfair`, `/ingestion/smarkets`, `/ingestion/odds/{match_id}`

## 2026-06-03 — Sprint 3: Model Training Pipeline
### Added
- `models/historical_match.py` — HistoricalMatch model + migration
- `training/ingest.py` — CSV → Postgres importer
- `training/trainer.py` — ModelTrainer + FittedPredictionService
- `training/calibration.py` — ECE + Brier + backtest P&L
- Training routes: `/training/import-csv`, `/training/fit`, `/training/fit-and-eval`

## 2026-06-03 — Sprint 2: Auth Layer
### Added
- `core/security.py` — bcrypt + JWT
- `api/routes/auth.py` — /register, /login, /me
- OAuth2PasswordBearer protected routes
- `scripts/seed.py` — dev data seed
- Swagger UI + ReDoc auto-generated docs

## 2026-06-03 — Sprint 1: Foundation
### Added
- FastAPI scaffold with `pyproject.toml` + `uv`
- SQLAlchemy 2.0 models (23 tables)
- Alembic async setup + composite indexes migration
- Pydantic schemas
- App factory + health checks
- `docker-compose.dev.yml` (Postgres 16 + Redis 7)
- `.env.example` with all settings documented

## 2026-06-02 — Research Phase
### Added
- `research/LIVE_BETTING_CASE_STUDIES.md` — 3 strategies: Momentum, Contrarian, xG-Based In-Play
- `research/PRE_MATCH_BETTING_CASE_STUDIES.md` — 5 strategies: Poisson, Dixon-Coles, Elo, ML Ensemble, Market Bias
- `research/STATISTICAL_METHODS_GUIDE.md` — Kelly, EV, Bayesian, Monte Carlo
- `research/INTEGRATION_GUIDE.md` — Tool + exchange comparisons
- `research/TECHNICAL_AUDIT_REPORT.md` — 25 findings with severity ratings
- `research/FLUMINE_EDGE_CASE_AUDIT.md` — 18 edge cases
- `research/SECURITY_COMPLIANCE_AUDIT.md` — 17 security findings
- `research/DATABASE_SCALABILITY_AUDIT.md` — 17 DB findings
- `research/TESTING_OBSERVABILITY_PLAN.md` — 8 testing areas
- `research/DEVOPS_DEPLOYMENT_AUDIT.md` — 22 DevOps findings
- `research/PLAN_IMPROVEMENTS_v3.1.md` — 82 findings synthesized
- `research/INDEX_COMPLETE.md` — Master navigation for all 21 documents
