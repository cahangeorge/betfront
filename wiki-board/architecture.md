# Architecture — Betting Execution Platform

## Stack
| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | SvelteKit 2 + Svelte 5 + Tailwind v4 | Compiled JS runs in browser; 10–50× faster than Python server-side frameworks for 1000+ row updates/sec |
| **API Gateway** | FastAPI + Uvicorn (async) | Stateless REST + WebSocket; built for high-throughput async |
| **Trading Engine** | Dedicated Python process with flumine BaseStrategy | Singleton pattern; real-time Betfair Stream API integration |
| **Message Bus** | Redis Streams (not Pub/Sub) | Persistent message log; consumer groups for multiple workers |
| **Database** | PostgreSQL 16 + RLS + composite indexes | Multi-tenant SaaS with row-level security |
| **Cache** | Redis 7 (AUTH + TLS + ACL) | 5-min TTL on odds snapshots; session store |
| **Workers** | Celery (batch only, never on critical path) | Background jobs: model retraining, data ingestion |
| **Deploy** | Docker Compose → Dokploy | Single VPS → scale to k3s/Docker Swarm at 100 users |
| **Models** | penaltyblog (Poisson/Dixon-Coles), scikit-learn | Cython-optimized; published RPS = 0.2156 |

## Project Structure
```
betting-platform/
├── backend/
│   ├── app/
│   │   ├── api/routes/          → 10 routers, 30 endpoints (auth, matches, predictions, bot, stats, training, data, bankroll, health)
│   │   ├── services/
│   │   │   ├── exchanges/       → BetfairClient, MatchbookClient, SmarketsClient
│   │   │   ├── live_engine/     → BotDaemon, ValueDetector, RiskManager, ExecutionService, MomentumScorer, LiveProbabilityUpdater
│   │   │   ├── predictions/     → PoissonModel, DixonColesModel, EnsembleModel, xGBoostModel
│   │   │   ├── training/        → ModelTrainer, FittedPredictionService, calibration, backtest
│   │   │   └── stats/           → football-data.org feed, Understat scraper, LiveStatsIngester
│   │   ├── models/              → SQLAlchemy 2.0 models (23 tables)
│   │   ├── schemas/             → Pydantic request/response models
│   │   └── core/                → config, security, database, settings
│   ├── scripts/                 → smoke tests, paper_sim.py, backtest_cli.py, expand_data.py
│   ├── data/                    → 5,256 historical matches CSV
│   ├── alembic/                 → Database migrations
│   └── Dockerfile               → Multi-stage uv build
├── frontend/
│   ├── src/routes/              → 7 SvelteKit pages
│   ├── src/lib/api.ts           → Typed API client
│   └── build/                   → Static build served by backend
├── research/                    → LIVE_BETTING_CASE_STUDIES.md, PRE_MATCH_BETTING_CASE_STUDIES.md
├── docker-compose.prod.yml      → 8-service stack (FastAPI, trading-engine, Postgres, Redis, Celery, Traefik)
├── .github/workflows/           → CI (5 jobs), PR (3 jobs)
└── .env.example                 → Credential template (Betfair, Matchbook, Stripe, DB, Redis)
```

## Key Patterns
- **Singleton trading engine** — BotDaemon runs as a single dedicated process; never duplicated
- **Redis Streams** — Persistent message log between trading engine and API; survives restarts
- **RLS (Row-Level Security)** — PostgreSQL RLS for multi-tenant isolation
- **Entry-only discipline** — No exit logic, no cash out, no hedging. Win rate 50% at avg odds 3.0 = 0.5u EV per trade
- **Paper-first** — All new strategies run paper trading for 30 days before real money

## Data Flow
```
football-data.org / Understat
        ↓
  LiveStatsIngester (60s poll)
        ↓
  MatchStat DB → LiveBotDaemon
        ↓
  MomentumScorer + LiveProbabilityUpdater
        ↓
  ValueDetector (edge ≥ 15%)
        ↓
  RiskManager (7 gates)
        ↓
  ExecutionService (paper / real)
        ↓
  Betfair / Matchbook API
        ↓
  Redis Streams → SvelteKit Dashboard (WebSocket)
```

## Performance Targets
| Metric | Target | Current |
|--------|--------|---------|
| API latency p50 | < 50ms | ~30ms |
| API latency p99 | < 200ms | ~80ms |
| Odds poll interval | 60s | 60s |
| Stream gap detection | < 5s | < 5s |
| Backtest throughput | 1000 matches/sec | 500 matches/sec |
| Dashboard refresh | 5s polling | 5s polling |

## Security
- JWT tokens with ≥32 byte secret
- bcrypt password hashing
- Redis AUTH + TLS + ACL (no default port 6379)
- Secrets mounted via Docker secrets (`/run/secrets/`)
- Stripe webhook signature verification
- Betfair credentials never logged
- GDPR: data retention 7 years, right to erasure

## Exchange Integration
| Exchange | Client | Auth | Cost | Status |
|----------|--------|------|------|--------|
| Betfair | JSON-RPC | SSO (identitysso.betfair.com) | Free (delayed) / £499 (live) | ✅ Full |
| Matchbook | REST | Username/Password | Free (1M GET/mo) | ✅ Full |
| Smarkets | REST v3 | API Key | Free tier | ✅ Full |

## Database Schema Highlights
- **23 tables** — User, Session, Match, OddsEntry, MatchStat, Bankroll, BookmakerAccount, LedgerEntry, Ticket, TicketLeg, BetPlacement, LiveOdds, TradingPosition, Tenant, HistoricalMatch, PredictionRun, ModelPrediction, EnsemblePrediction, ScrapeJob, ScrapedDataset
- **Composite indexes** — `idx_matches_league_status`, `idx_matches_kickoff`, `idx_odds_match_time`, `idx_tickets_user_status`, `idx_positions_user_status`, `idx_positions_opened_at`
- **Audit columns** — `created_at`, `updated_at` on all tables
- **Soft deletes** — `deleted_at` nullable timestamp

## Env Requirements
- `DATABASE_URL=postgresql+asyncpg://...`
- `REDIS_URL=redis://localhost:6379/0`
- `JWT_SECRET_KEY=≥32 bytes`
- `BETFAIR_APP_KEY` (free delayed) / `BETFAIR_LIVE_APP_KEY` (£499)
- `MATCHBOOK_USERNAME` / `MATCHBOOK_PASSWORD`
- `.env` auto-loaded by pydantic-settings
