# Project Status

## Overall Health: Migration Complete — Converged to wiki-board Spec

| Component | Status | Notes |
|-----------|--------|-------|
| FastAPI backend | **Green** | 35 API routes, 18 SQLAlchemy async models, JWT auth, 8 model types, Python bridges |
| SvelteKit frontend | **Green** | 9 pages (Svelte 5 runes), PWA, dark theme, 5s polling, Tailwind v4 |
| Auth (JWT + bcrypt) | **Green** | Signup, login, /me, JWT httpOnly cookies, protected routes |
| Database models | **Green** | 23 SQLAlchemy tables, Alembic migration for PostgreSQL |
| Prediction engine | **Green** | Poisson, Bivariate Poisson, Dixon-Coles, NegBin, ZIP, Weibull, Bayesian, Hierarchical Bayesian |
| Ensemble predictions | **Green** | Brier-weighted ensemble aggregation |
| Ticket system | **Green** | CRUD + placement + settlement + bankroll deduction |
| Python bridges | **Green** | Async subprocess bridge to penaltyblog/soccerdata/OddsHarvester |
| Scrape orchestration | **Green** | Job lifecycle for oddsportal/fbref/sofascore/understat/espn |
| Bankroll management | **Green** | Paper/real/sandbox bankrolls, bookmaker accounts, ledger |
| Scheduled jobs | **Green** | Cron-style job CRUD with next/last run tracking |
| Docker Compose | **Green** | 5 services: PostgreSQL 16, Redis 7, Backend, Frontend, Nginx |
| Container builds | **Green** | Multi-stage Dockerfiles (Python 3.12-slim + Node 22), non-root users |
| PWA | **Green** | Service worker (cache-first static), web manifest, offline fallback |
| HELIOS theme | **Green** | Futuristic void+neon design system, 20 files, glassmorphism + glow + animations |
| Security | **Amber** | JWT secret ≥32 bytes required in production; no rate limiting yet |

## Project Layout
| Path | What |
|------|------|
| `backend/` | FastAPI + SQLAlchemy async + Alembic + JWT + 7 domain routers |
| `frontend/` | SvelteKit 2 + Svelte 5 + Tailwind v4 + PWA + 9 pages |
| `betfront/` | Legacy Astro 6 + React 19 + Prisma + SQLite (archived, runs on :3002) |
| `docker-compose.yml` | 5-service orchestration |
| `scripts/` | setup.sh + seed.sh |

## Blockers
_None._

## Next Up
1. **Start services** — Run `cd /home/gion/Projects/bet && ./scripts/setup.sh` to bring up full stack
2. **Connect real Matchbook credentials** — Set MATCHBOOK_USERNAME/PASSWORD in .env
3. **Tune Kelly fraction / edge threshold** — Increase from 0.25/5% for higher ROI
4. **Add WebSocket push** — Replace 5s polling with Socket.IO for real-time updates
5. **Expand to 10+ leagues** — Eredivisie, Primeira Liga, Russian PL, MLS
6. **Real-time stats feed (<5s)** — API-Football ($19/mo) or Sportmonks (€25/mo)

## Access Points
| URL | What |
|-----|------|
| http://localhost:5173/ | SvelteKit dashboard (frontend) |
| http://localhost:8000/ | FastAPI backend + Swagger docs |
| http://localhost:8000/docs | Swagger API docs |
| http://localhost:8000/redoc | ReDoc API docs |
| http://localhost:8000/health | API health check |
| http://localhost:3002/ | Legacy betfront (Astro) |
