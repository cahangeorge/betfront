# Migration Plan: betfront → wiki-board Spec

## Objective
Migrate the current betfront codebase (Astro 6 + React 19 + Prisma + SQLite) to the wiki-board architecture (SvelteKit 2 + Svelte 5 + FastAPI + PostgreSQL 16 + Redis 7), adding PWA support.

## Why
Converge the actual codebase with the researched and verified architecture from the 13-sprint plan. Enable live betting, WebSocket streaming, production scalability, and mobile PWA access.

---

## Phases

### Phase 0 — Foundation ✓ (Completed 2026-06-04)
- [x] Create migration plan
- [x] Set up FastAPI backend scaffold with SQLAlchemy — 45 files, 18 async models, 35 API routes
- [x] Set up SvelteKit + PWA frontend scaffold — 62 files, 9 pages, all Svelte 5 runes
- [x] Docker Compose for FastAPI + PostgreSQL + Redis + SvelteKit + Nginx — 5 services
- [x] Port database models from Prisma to SQLAlchemy — 23 tables from 22 Prisma models
- [x] Implement JWT auth endpoints — HS256, 30min access + 7d refresh httpOnly cookies
- [x] Port Python bridges (penaltyblog, soccerdata, OddsHarvester) — async subprocess bridge
- [x] Port predictions engine endpoints — 8 model types + Brier-weighted ensemble
- [x] Port ticket system endpoints — CRUD + placement + settlement + bankroll deduction
- [x] Create SvelteKit base pages (Layout, login, signup, account) — 4 pages with auth guards
- [x] Create SvelteKit prediction/ticket/data pages — 4 tabs each with 5s polling
- [x] Create SvelteKit board page with Ticker — animated odds ticker + match grid
- [x] PWA service worker + manifest — cache-first static, network-first API, offline fallback
- [ ] End-to-end integration test (requires PostgreSQL running)

### Phase 1 — Core Migration
- Full data migration script (SQLite → PostgreSQL)
- Feature parity verification
- All Astro server actions → FastAPI routes
- All React components → Svelte 5 components
- Auth: scrypt sessions → JWT + bcrypt

### Phase 2 — Live Capabilities
- Redis Streams for real-time odds
- WebSocket push from FastAPI to SvelteKit
- Live betting engine (momentum, contrarian)
- Paper trading simulator

### Phase 3 — Production Hardening
- Dokploy deployment config
- Rate limiting, CORS hardening
- Monitoring (logs, metrics, alerts)
- Load testing
- CI/CD pipelines per project

---

## Architecture (Target)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   SvelteKit   │◄────│   FastAPI    │◄────│  PostgreSQL  │
│   (PWA)       │HTTP  │   (Python)   │ SQL  │               │
│   :3000       │────►│   :8000      │────►│   :5432       │
└──────────────┘     └──────────────┘     └──────────────┘
       │                     │
       │                     ├──────────┐
       │                     │  Redis 7 │
       │                     │  :6379   │
       │                     └──────────┘
       │
       │  Python Bridges (via subprocess):
       │  ├── penaltyblog (Poisson, Dixon-Coles, xG)
       │  ├── soccerdata (FBref, Understat, Sofascore)
       │  └── OddsHarvester (OddsPortal scraper)
```

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Frontend | SvelteKit 2 + Svelte 5 | PWA-first, reactive, lighter than React |
| Backend | FastAPI | Python-native, async, auto-docs, same lang as models |
| Database | PostgreSQL 16 | Production-grade, JSON, CTEs, RLS |
| Cache/Stream | Redis 7 | Streams + Pub/Sub + rate limiting |
| ORM | SQLAlchemy 2.0 | Mature, async, Alembic migrations |
| Auth | JWT + bcrypt | Stateless, SvelteKit-native cookie handling |
| Deployment | Docker Compose → Dokploy | Simple, single-host, containerized |
| PWA | @sveltejs/kit/service-worker | Built-in SvelteKit PWA support |

---

## Current State (betfront) Reusable Assets

| Asset | Reuse Strategy |
|---|---|
| Prisma schema (22 models) | Translate to SQLAlchemy declarative models |
| Prediction engine logic | Port to FastAPI route handlers |
| Ticket system logic | Port to FastAPI route handlers |
| Python bridges | Reuse directly from FastAPI (same Python env) |
| Ticker component (React) | Rewrite in Svelte 5 |
| Auth logic | Replace scrypt sessions with JWT + bcrypt |
| Dockerfile | Replace with Docker Compose multi-service |
| Tailwind config | Keep, configure in SvelteKit |
| Package dependencies | SvelteKit equivalents |
