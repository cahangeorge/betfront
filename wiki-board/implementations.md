# Implementation Log

## 2026-06-05 — Auth Fixes + Backend Extensions + New Pages

### Auth Fixes
- **Frontend API client** — Changed from FormData submission to `/auth/*` endpoints to JSON body to `/api/v1/auth/*` endpoints, fixing 422 Unprocessable Entity errors on login/signup
- **Backend deps.py** — Updated `get_current_user()` dependency to accept both `Authorization: Bearer <token>` header and httpOnly cookie (`access_token`), enabling both Swagger UI testing and browser cookie-based auth
- **CORS configuration** — Added `http://localhost:5174` to allowed origins list for frontend dev server cross-origin requests

### Backend: MatchStat Extension (Migration 002)
- **8 new fields** on `match_stats` table: `yellow_cards_home`, `yellow_cards_away`, `red_cards_home`, `red_cards_away`, `fouls_home`, `fouls_away`, `offsides_home`, `offsides_away`
- All fields nullable (Integer), backward compatible with existing data

### Backend: Strategy Model
- New `strategies` table: `id`, `name`, `model_type` (str), `parameters` (JSON), `weights` (JSON), `is_active` (bool), `created_at`, `updated_at`
- Enables user-defined prediction strategies with configurable model parameters and ensemble weights

### Backend: 4 New API Modules
- **dashboard.py** (4 endpoints): `/api/v1/dashboard/summary`, `/api/v1/dashboard/recent-tickets`, `/api/v1/dashboard/upcoming-matches`, `/api/v1/dashboard/job-logs`
- **analytics.py** (4 endpoints): `/api/v1/analytics/pnl-by-league`, `/api/v1/analytics/win-rate-by-model`, `/api/v1/analytics/edge-distribution`, `/api/v1/analytics/equity-curve`
- **catalog.py** (3 endpoints): `/api/v1/catalog/countries`, `/api/v1/catalog/leagues`, `/api/v1/catalog/leagues/{country}`
- **strategies.py** (6 endpoints): CRUD + run + results for user-defined strategies

### Backend: 4 New Schema Modules
- `schemas/dashboard.py` — DashboardSummary, RecentTickets, UpcomingMatch, JobLog
- `schemas/analytics.py` — PnLByLeague, WinRateByModel, EdgeDistribution, EquityCurvePoint
- `schemas/catalog.py` — Country, League
- `schemas/strategies.py` — StrategyCreate, StrategyUpdate, StrategyResponse, StrategyRun, StrategyResult

### Frontend: New Pages
- **Dashboard** — 4 sections: Recent Tickets table, Upcoming Matches cards, Account P&L chart (layerchart EquityCurveChart), Job Logs feed
- **Data Hub** — Unified data table with 3 tabs (matches, odds, stats), search bar, date range filter, pagination, CSV export button, detail dialog on row click
- **Scraping** — Country/league multi-select dropdowns populated from catalog API, start/end time period selectors, auto-scrape toggle switch, job table with status badges
- **Predictions** — Strategy card grid displaying available strategies, market selection checkboxes, run button with progress indicator, per-strategy results display, CSV export

### Test Suite
- All 47 tests passing (backend unit + integration, frontend component tests)

---

## 2026-06-04 — Full Stack Migration: Astro → FastAPI + SvelteKit + PWA

### Migration Overview
Complete platform rewrite from Astro 6 + React 19 + Prisma + SQLite monolith to wiki-board-spec architecture: FastAPI + SQLAlchemy async + PostgreSQL, SvelteKit 2 + Svelte 5 + PWA, Docker Compose orchestration.

### Backend: `backend/` (FastAPI + SQLAlchemy + PostgreSQL)
- **45 files**, 2,397 lines of Python across 18 SQLAlchemy async models, 7 domain routers, 6 service modules
- **23 database tables** mapped from existing Prisma schema: User, Session, Match, OddsEntry, MatchStat, MatchSource, PredictionRun, ModelPrediction, EnsemblePrediction, PredictionSession, Prediction, Ticket, TicketBatch, TicketLeg, BetPlacement, Settlement, Bankroll, BookmakerAccount, LedgerEntry, ScrapeJob, ScrapedDataset, ScheduledJob, Todo
- **35 registered API routes** across 7 domains (auth, matches, predictions, tickets, data, bankroll, jobs)
- **JWT auth** (HS256, 30min access + 7d refresh tokens via httpOnly cookies), bcrypt password hashing
- **Prediction engine** with 8 model types (Poisson, Bivariate Poisson, Dixon-Coles, Neg Binomial, ZIP, Weibull Copula, Bayesian, Hierarchical Bayesian) + Brier-weighted ensemble
- **Async Python bridge** to penaltyblog/soccerdata/OddsHarvester (matching existing subprocess protocol)
- **Alembic migration** ready for PostgreSQL (413-line initial migration)

### Frontend: `frontend/` (SvelteKit 2 + Svelte 5 + Tailwind v4 + PWA)
- **62 files** across 9 route pages, 12 components, 7 UI primitives, 8 API modules
- **Svelte 5 runes** throughout (`$state`, `$derived`, `$effect`, `$props`) — zero Svelte 4 stores
- **All 29 `.svelte` files** validated with `svelte-autofixer` — zero issues
- **9 pages**: Home (dashboard), Login, Signup, Account, Predict, Tickets, Data, Board (odds ticker), About
- **5-second auto-refresh** polling on Predict, Tickets, and Data pages
- **PWA**: Service worker (cache-first static / network-first API), web manifest, offline fallback, standalone display
- **Dark theme** with Tailwind v4 — `bg-gray-950` base, emerald accents
- **Protected routes** redirect to `/login` if unauthenticated; Board/About/Login/Signup are public
- **API client** with typed fetch wrapper, httpOnly cookie auth via `credentials: 'include'`

### Infrastructure: Docker Compose
- **5 services**: PostgreSQL 16, Redis 7, FastAPI backend (uvicorn --reload), SvelteKit frontend (adapter-node), Nginx reverse proxy
- **Multi-stage Dockerfiles**: slim images, non-root users, proper dependency layer caching
- **Health checks** on all data services with wait-for-ready orchestration
- **Setup/seed scripts**: one-command `setup.sh` + admin user seeder (`admin@betfront.com / admin123`)

### Betfront Legacy (betfront/)
- Kept in place with the existing Astro Odoo 6 + React 19 + Prisma + SQLite code at `betfront/`
- Docker container runs on `127.0.0.1:3002`
- `/board` page publicly accessible, Ticker component uses React 19 + requestAnimationFrame
- Dockerfile native module fix applied (better-sqlite3 rebuild in runtime stage)
