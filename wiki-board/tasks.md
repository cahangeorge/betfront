# Active Tasks

## Sprint 13 — Data Expansion (Complete)
- [x] **SP-13-1**: Bulk fetch historical matches from football-data.org
  - 5,256 matches across 5 leagues / 3 seasons
- [x] **SP-13-2**: CSV import pipeline with deduplication
- [x] **SP-13-3**: Out-of-sample backtest on expanded data
  - Result: 276 trades, 55.8% WR, Sharpe 0.18, max drawdown 0.05%

## Sprint 12 — SvelteKit Dashboard (Complete)
- [x] **SP-12-1**: Scaffold SvelteKit 2 + Tailwind v4 project
- [x] **SP-12-2**: Build 7 dashboard pages
  - Dashboard, Matches, Match Detail, Bot Control, Trades, Backtest, Models, Stats
- [x] **SP-12-3**: Dark theme + 5s polling + skeleton loading + pagination
- [x] **SP-12-4**: SVG equity curve chart (inline, no library)

## Sprint 11 — Backtesting Engine (Complete)
- [x] **SP-11-1**: BacktestEngine class — predict → detect → stake → settle
- [x] **SP-11-2**: Metrics: Sharpe ratio, max drawdown, profit factor, ROI, equity curve
- [x] **SP-11-3**: Edge distribution + win rate by odds bucket + league breakdown
- [x] **SP-11-4**: Out-of-sample mode (80/20 split)
- [x] **SP-11-5**: CLI script: `uv run python3 scripts/backtest_cli.py --stake 1000 --kelly 0.25 --edge 0.05`

## Sprint 10 — Paper Trading Simulator (Complete)
- [x] **SP-10-1**: Paper trading simulation engine
- [x] **SP-10-2**: Configurable edge threshold, Kelly fraction, stake, poll interval
- [x] **SP-10-3**: Simulate against historical odds with noise

## Sprint 9 — Exchange Credential Integration (Complete)
- [x] **SP-09-1**: Betfair SSO login (identitysso.betfair.com)
- [x] **SP-09-2**: Matchbook free-tier client (api.matchbook.com)
- [x] **SP-09-3**: Dual-exchange execution routing in ExecutionService

## Sprint 8 — Live Stats Feed (Complete)
- [x] **SP-08-1**: football-data.org async client (5 major leagues)
- [x] **SP-08-2**: Understat scraper (shots + xG timeline)
- [x] **SP-08-3**: LiveStatsIngester (60s poll cycle)

## Sprint 7 — Real Model Training (Complete)
- [x] **SP-07-1**: penaltyblog PoissonGoalsModel wrapper
- [x] **SP-07-2**: DixonColesGoalModel wrapper with graceful fallback
- [x] **SP-07-3**: FittedPredictionService auto-loads from disk
- [x] **SP-07-4**: Calibration: ECE + Brier score

## Sprint 6 — Momentum + Contrarian (Complete)
- [x] **SP-06-1**: Live match stats ingestion (POST /stats/ingest/{id})
- [x] **SP-06-2**: MomentumScorer: M(t) = w1*xG + w2*SoT*0.1 + w3*poss*0.02 + w4*attacks*0.005 - w5*cards*0.05
- [x] **SP-06-3**: LiveProbabilityUpdater (Bayesian-style: goal shrinks conceding team by 0.6x, momentum shifts probs)
- [x] **SP-06-4**: Contrarian detector (odds ≥3.0 + negative momentum but model edge ≥15%)

## Sprint 5 — Live Trading Engine (Complete)
- [x] **SP-05-1**: ValueDetector — implied probability, Kelly edge, 15%+ threshold
- [x] **SP-05-2**: RiskManager — 7 gates (Kelly, odds bounds, exposure, concurrency, daily loss, liquidity)
- [x] **SP-05-3**: ExecutionService — paper-mode simulated fill + real exchange API
- [x] **SP-05-4**: BotDaemon async loop (poll → predict → detect → risk-gate → execute → log)

## Sprint 4 — Exchange API Clients (Complete)
- [x] **SP-04-1**: Betfair API-NG client (JSON-RPC)
- [x] **SP-04-2**: Smarkets REST v3 client
- [x] **SP-04-3**: Matchbook REST client (free tier)
- [x] **SP-04-4**: Odds ingestion engine with Redis cache (5-min TTL)

## Sprint 3 — Model Training Pipeline (Complete)
- [x] **SP-03-1**: HistoricalMatch model + migration
- [x] **SP-03-2**: CSV importer (60 matches across 5 leagues)
- [x] **SP-03-3**: ModelTrainer fits Poisson + Dixon-Coles
- [x] **SP-03-4**: Calibration + backtest P&L engine

## Sprint 2 — Auth Layer (Complete)
- [x] **SP-02-1**: bcrypt + JWT auth (/register, /login, /me)
- [x] **SP-02-2**: OAuth2PasswordBearer protected routes
- [x] **SP-02-3**: Dev seed script
- [x] **SP-02-4**: Swagger + ReDoc docs

## Sprint 1 — Foundation (Complete)
- [x] **SP-01-1**: FastAPI scaffold
- [x] **SP-01-2**: SQLAlchemy 2.0 models (23 tables)
- [x] **SP-01-3**: Alembic async setup + composite indexes
- [x] **SP-01-4**: Pydantic schemas
- [x] **SP-01-5**: App factory + health checks

## Backlog
- [ ] **TASK-014**: Deploy to Dokploy (24/7 operation)
- [ ] **TASK-015**: Connect real Matchbook credentials for live trading
- [ ] **TASK-016**: Tune Kelly fraction / edge threshold for higher ROI
- [ ] **TASK-017**: Add WebSocket push for live odds (vs polling)
- [ ] **TASK-018**: Expand to 10+ leagues (Eredivisie, Primeira Liga, etc.)
- [ ] **TASK-019**: Add in-play momentum streaming (<5s latency)
- [ ] **TASK-020**: Implement market impact modeling at scale

## Completed (Session)
- [x] Create `wiki-board/` directory and planning docs
- [x] Scaffold `/board` page with Ticker component
- [x] Fix container native module issue
- [x] Add `/board` to public paths in middleware
- [x] All 13 sprints implemented and committed
- [x] GitHub repo created: https://github.com/cahangeorge/betting-platform
