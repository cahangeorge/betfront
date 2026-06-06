# Platform Plans — Betting Execution & Analytics Platform

## Vision
Build a production-grade, entry-only betting execution platform with live and pre-match strategies. The platform uses real statistical models (Poisson / Dixon-Coles / xG) to detect value edges on exchange APIs, places bets via paper and real modes, and exposes everything through a SvelteKit dashboard.

## Phases (13 Sprints)

### Phase 0 — Foundation (Sprints 1–4)
- **Sprint 1**: FastAPI scaffold, SQLAlchemy 2.0 models (23 tables), Alembic migrations, composite indexes, Pydantic schemas, app factory + health checks
- **Sprint 2**: Auth layer — bcrypt + JWT, OAuth2PasswordBearer, protected routes, dev seed script, Swagger/ReDoc docs
- **Sprint 3**: Exchange API clients — Betfair (JSON-RPC, SSO login), Smarkets (REST v3), Matchbook (REST, free tier), odds ingestion engine with Redis cache (5-min TTL)
- **Sprint 4**: Model training pipeline — HistoricalMatch model, CSV importer, penaltyblog PoissonGoalsModel + DixonColesGoalModel fitting, joblib persistence, calibration metrics (ECE, Brier), backtest P&L engine

### Phase 1 — Live Engine (Sprints 5–6)
- **Sprint 5**: Live trading engine — ValueDetector (implied probability, Kelly edge, 15%+ threshold), RiskManager (7 gates: Kelly, odds bounds, exposure, concurrency, daily loss, liquidity), ExecutionService (paper-mode simulated fill + real Betfair/Matchbook API), BotDaemon async loop (poll → predict → detect → risk-gate → execute → log)
- **Sprint 6**: Momentum scoring + contrarian entry — Live match stats (xG, shots on target, possession, dangerous attacks), MomentumScorer, Bayesian-style live probability updater, contrarian detector (odds ≥3.0 + negative momentum but model edge ≥15%)

### Phase 2 — Data & Training (Sprints 7–8)
- **Sprint 7**: Real model training — penaltyblog Poisson + Dixon-Coles fitted on 60 historical matches, FittedPredictionService auto-loads from disk, ensemble with graceful fallback, training API routes (/training/import-csv, /training/fit, /training/fit-and-eval)
- **Sprint 8**: Live stats feed — football-data.org async client (5 major leagues), Understat scraper (shots + xG timeline), LiveStatsIngester (60s poll cycle), data expansion API (/data/ingester/start, /data/expand-csv)

### Phase 3 — Execution & Paper Trading (Sprints 9–10)
- **Sprint 9**: Exchange credential integration — Betfair SSO login (free delayed app key + live £499 option), Matchbook free-tier client (up to 1M GET requests/month, 2% commission on net profit), dual-exchange execution routing
- **Sprint 10**: Paper trading simulator — configurable edge threshold, Kelly fraction, stake, poll interval; simulates trades against historical odds; 10 trades / 90% WR demo

### Phase 4 — Verification & Dashboard (Sprints 11–12)
- **Sprint 11**: Backtesting engine — predict → detect → stake → settle across historical matches, Sharpe ratio, max drawdown, profit factor, ROI, equity curve, edge distribution, win rate by odds bucket, out-of-sample mode (80/20 split)
- **Sprint 12**: SvelteKit 2 dashboard — 7 pages: Dashboard (bankroll + P&L + equity curve), Matches (live/upcoming/finished), Match Detail (prediction + momentum), Bot Control (start/stop + config), Trades (log + filters), Backtest (fit + evaluate), Models (CSV import + training), Stats (ingester + momentum viewer). Dark theme, 5s polling, skeleton loading, pagination, SVG charts.

### Phase 5 — Scale (Sprint 13)
- **Sprint 13**: Data expansion — bulk fetch 5,256 matches across 5 leagues / 3 seasons from football-data.org. Out-of-sample backtest: 276 trades, 55.8% WR, Sharpe 0.18, max drawdown 0.05%.

## Cost Model
| Phase | Weeks | Cost |
|-------|-------|------|
| 0 (Foundation) | 1–3 | ~$500 |
| 1 (Live Engine) | 4–6 | ~$500 |
| 2 (Data/Training) | 7–8 | ~$500 |
| 3 (Execution) | 9–10 | ~$0 (Matchbook free tier) |
| 4 (Verification/Dashboard) | 11–12 | ~$500 |
| 5 (Scale) | 13 | ~$0 |
| **Year 1 total** | — | **~$7k–$27k** (includes legal/licensing) |

## GO/NO-GO Gates
- **Week 14 (Alpha)**: Paper trading must show positive Sharpe on 500+ backtest trades before touching real money
- **Week 24 (Beta)**: Live engine paper trades must survive 30 days without daily loss limit breach before SaaS build

## Exchange Comparison
| Exchange | Cost | Commission | Liquidity | Our Integration |
|----------|------|------------|-----------|-----------------|
| Betfair (delayed) | £0 | N/A (paper) | Best | Full client + SSO |
| Betfair (live) | £499 one-time | 5% on winnings | Best | Ready |
| Matchbook | £0 | 2% net profit | Good (PL, UCL) | Full client |
| Smarkets | Free tier | 2% | Medium | REST client |
| Pinnacle | Closed (partners only) | — | Sharpest | Not available |
| Orbit | No public API | — | — | Not available |
| Betdaq | No free tier | — | Lower | Not available |

## UI Overhaul (In Progress)

**Status:** PLANNED — See [ui-overhaul-plan.md](ui-overhaul-plan.md), [ui-overhaul-tasks.md](ui-overhaul-tasks.md), [ui-overhaul-research.md](ui-overhaul-research.md)

Replacing Stadium Intel theme with shadcn-svelte + layerchart + PWA-first design.

### Key Decisions
1. Fully replace Stadium Intel — no legacy tokens
2. Rounded corners everywhere
3. Three-column desktop + bottom sheet mobile
4. Phone-first PWA
5. Glassmorphism/transparency

### 6 Phases
1. **Foundation** — shadcn-svelte install, new color system, Tailwind v4
2. **Component Migration** — Replace all custom components with shadcn
3. **Charts (layerchart)** — Area, Bar, Line, Pie, Sparkline
4. **Layout Overhaul** — Phone-first responsive, bottom nav, betslip FAB
5. **Light/Dark Toggle** — System preference + manual override
6. **Polish** — Animations, PWA, accessibility

### Estimated: 16–22 hours

## Long-Term Vision
A single platform where a user can:
1. See live odds from multiple exchanges (Betfair, Matchbook, Smarkets)
2. View real-time model predictions and momentum scores
3. Detect value edges (≥15%) using Poisson/Dixon-Coles trained models
4. Place entry-only paper or real trades with Kelly stake sizing
5. Track P&L, Sharpe ratio, drawdown, and win rate per league/odds bucket
6. Backtest strategies on thousands of historical matches
7. Monitor everything through a real-time SvelteKit dashboard
