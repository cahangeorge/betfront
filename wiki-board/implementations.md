# Implementation Log

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
