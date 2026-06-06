# Project Status

## Overall Health: UI Overhaul Complete — Full Platform Operational (74/75 Tests Passing, 1 Skipped)

| Component | Status | Notes |
|-----------|--------|-------|
| FastAPI backend | **Green** | 53 API routes across 15 routers, 18 SQLAlchemy async models, JWT auth, 8 model types, Python bridges |
| SvelteKit frontend | **Green** | 13 pages (Svelte 5 runes), shadcn-svelte foundation, layerchart charts, PWA, light/dark theme |
| Auth (JWT + bcrypt) | **Green** | Frontend sends JSON to /api/v1/auth/*, backend accepts Bearer header + httpOnly cookies, CORS :5174 |
| Database models | **Green** | 25 SQLAlchemy tables (23 original + MatchStat 8 fields + Strategy), Alembic migration 002 |
| Prediction engine | **Green** | Poisson, Bivariate Poisson, Dixon-Coles, NegBin, ZIP, Weibull, Bayesian, Hierarchical Bayesian |
| Ensemble predictions | **Green** | Brier-weighted ensemble aggregation |
| Ticket system | **Green** | CRUD + placement + settlement + bankroll deduction |
| Python bridges | **Green** | Async subprocess bridge to penaltyblog/soccerdata/OddsHarvester |
| Scrape orchestration | **Green** | Job lifecycle for oddsportal/fbref/sofascore/understat/espn |
| Bankroll management | **Green** | Paper/real/sandbox bankrolls, bookmaker accounts, ledger |
| Scheduled jobs | **Green** | Cron-style job CRUD with next/last run tracking |
| Dashboard | **Green** | 4 sections: Recent Tickets, Upcoming Matches, Account P&L chart, Job Logs |
| Data Hub | **Green** | Unified table (3 tabs), search, date filter, pagination, CSV export, detail dialog |
| Scraping | **Green** | Country/league multi-select from catalog API, time period selectors, auto-scrape toggle, job table |
| Predictions | **Green** | Strategy card grid, market checkboxes, run with progress, results per strategy, CSV export |
| Strategy model | **Green** | name, model_type, parameters JSON, weights JSON, is_active — 6 API endpoints |
| shadcn-svelte UI | **Green** | 13 component dirs (button, card, input, select, tabs, badge, table, tooltip, dialog, sheet, separator, dropdown-menu, skeleton) |
| layerchart charts | **Green** | 7 chart components: OddsMovement, EquityCurve, PnLByLeague, WinRateByModel, EdgeDistribution, xGTimeline, OddsComparison |
| Three-column layout | **Green** | 220px sidebar + flex main + 320px betslip; mobile: BottomNav (5 tabs) + BetslipFAB |
| Light/Dark theme | **Green** | ThemeToggle with localStorage persistence, flash prevention, system preference detection |
| Micro-interactions | **Green** | transition:fade on 5 pages, MatchCardSkeleton loading states |
| PWA | **Green** | Service worker (cache-first static), web manifest, apple-mobile-web-app-capable, offline fallback |
| Accessibility | **Green** | skip-to-content, ARIA labels, focus-visible, prefers-reduced-motion, landmark roles |
| Docker Compose | **Green** | 5 services: PostgreSQL 16, Redis 7, Backend, Frontend, Nginx |
| Container builds | **Green** | Multi-stage Dockerfiles (Python 3.12-slim + Node 22), non-root users |
| Test suite | **Green** | 74/75 tests passing (1 skipped) |
| Security | **Amber** | JWT secret ≥32 bytes required in production; no rate limiting yet |

## Project Layout
| Path | What |
|------|------|
| `backend/` | FastAPI + SQLAlchemy async + Alembic + JWT + 15 domain routers + 4 new API modules (dashboard, analytics, catalog, strategies) |
| `frontend/` | SvelteKit 2 + Svelte 5 + shadcn-svelte + layerchart + Tailwind v4 + PWA + 13 pages |
| `betfront/` | Legacy Astro 6 + React 19 + Prisma + SQLite (archived, runs on :3002) |
| `docker-compose.yml` | 5-service orchestration |
| `scripts/` | setup.sh + seed.sh |

## Container Stack
| Service | Port | Status |
|---------|------|--------|
| PostgreSQL 16 | :5433 | Running |
| Redis 7 | :6380 | Running |
| FastAPI Backend | :8001 | Running |
| SvelteKit Frontend | :5174 | Running |
| Nginx | :8080 | Running |

## Blockers
- None

## Next Up
1. **Connect real Matchbook credentials** — Set MATCHBOOK_USERNAME/PASSWORD in .env
2. **Tune Kelly fraction / edge threshold** — Increase from 0.25/5% for higher ROI
3. **Add WebSocket push** — Replace 5s polling with Socket.IO for real-time updates
4. **Expand to 10+ leagues** — Eredivisie, Primeira Liga, Russian PL, MLS
5. **Real-time stats feed (<5s)** — API-Football ($19/mo) or Sportmonks (€25/mo)

## Access Points
| URL | What |
|-----|------|
| http://localhost:5174/ | SvelteKit dashboard (frontend) |
| http://localhost:8001/ | FastAPI backend + Swagger docs |
| http://localhost:8001/docs | Swagger API docs |
| http://localhost:8001/redoc | ReDoc API docs |
| http://localhost:8001/health | API health check |
| http://localhost:8080/ | Nginx reverse proxy (frontend + API) |
| http://localhost:3002/ | Legacy betfront (Astro) |

## Credentials
| What | Value |
|------|-------|
| Login | admin@betfront.com / admin123 |
| PostgreSQL | betuser / betpassword_dev (port 5433) |
| Redis | no password (port 6380) |
