# Decisions Log

| Date | Decision | Context | Status |
|------|----------|---------|--------|
| 2026-06-04 | Keep `/board` public (no auth) | Board is a read-only odds display; auth friction unnecessary for browsing | Accepted |
| 2026-06-04 | Use React `requestAnimationFrame` for Ticker | Smooth infinite scroll without CSS animation constraints; pause on hover easy to implement | Accepted |
| 2026-06-04 | Dockerfile runtime stage rebuilds native modules | `better-sqlite3` prebuilds incompatible across build/runtime Node headers | Accepted |
| 2026-06-04 | Bind container to `127.0.0.1:3002` | Podman pasta IPv6 causes connection resets on this host | Accepted (workaround) |
| 2026-06-04 | Store planning docs in `wiki-board/` | Lightweight project wiki without external tools | Accepted |
| 2026-06-02 | **Python-First Monolith** (reject Go/Rust) | flumine is Python-only; execution layer must stay in Python. Go/Rust add 10–20 weeks with zero latency advantage. NautilusTrader is LGPL-3.0 — existential risk for SaaS. | **Accepted** |
| 2026-06-02 | **SvelteKit 2 + Svelte 5** (reject Python frontend) | Python frontends (Streamlit, NiceGUI, Reflex) are server-side rendered — 10–50× slower for 1000+ row updates/sec. SvelteKit compiles to optimized JS in browser. | **Accepted** |
| 2026-06-02 | **PostgreSQL + Redis** (reject SQLite/TimescaleDB/ClickHouse) | SQLite has no concurrent write scaling, no RLS, no connection pooling. TimescaleDB/ClickHouse add complexity not justified at 10 users. | **Accepted** |
| 2026-06-02 | **Redis Streams** (not Pub/Sub) | Pub/Sub drops messages on disconnect. Streams persist messages and support consumer groups for multiple workers. | **Accepted** |
| 2026-06-02 | **Entry-only discipline** (no exits) | Reddit case study: cash out, stop losses, and hedging killed profitability in all tests. 15% edge threshold + entry-only = 0.5u EV per trade. | **Accepted** |
| 2026-06-02 | **Monolith-first** (reject microservices/K8s) | Original plan had 8+ microservices + K8s in week 6. Revised to 3 services on 1 VPS. K8s only after 100 users justify it. | **Accepted** |
| 2026-06-02 | **flumine + betfairlightweight** (reject custom Go/Rust adapters) | flumine is battle-tested by real traders. Custom adapters = 15–17 weeks of wasted development. | **Accepted** |
| 2026-06-02 | **Verification-first** (reject live-first) | Original plan: live betting → verification. Revised: verification → live betting. GO/NO-GO gates at Week 14 and Week 24. | **Accepted** |
| 2026-06-02 | **Matchbook as primary free exchange** | Betfair delayed app key = free but 60s delay. Matchbook = free tier (1M GET/mo) + 2% commission on net profit only. No Premium Charge. | **Accepted** |
| 2026-06-02 | **Fractional Kelly (0.25–0.5)** (not full Kelly) | Full Kelly is too aggressive; fractional Kelly reduces volatility while preserving long-term growth. Reddit bot used ~0.25 Kelly. | **Accepted** |
| 2026-06-02 | **Docker Compose → Dokploy** (not AWS/GCP/K8s) | Dokploy is a simpler PaaS for single-VPS deploy. AWS/GCP add complexity and cost not justified for MVP. | **Accepted** |
| 2026-06-02 | **No arbitrage logic** | Original betfront had arbitrage.ts module. Platform is pure directional entry with no hedging. Arbitrage stripped. | **Accepted** |
| 2026-06-02 | **Anti-detection built into execution layer** | Betfair will ban you. Request jitter, human-like idle patterns, session rotation built from Day 1. | **Accepted** |
| 2026-06-02 | **Lawyer engaged Week 1** (not Week 19) | Compliance costs 3× estimate if deferred. Gambling lawyer reviews TOS before any live trading. Betfair LSV inquiry submitted early. | **Accepted** |
| 2026-06-03 | **SQLite for dev / PostgreSQL for prod** | Docker unavailable in workspace; SQLite used for local development. PostgreSQL configured for production via docker-compose.prod.yml. | **Accepted** |
| 2026-06-03 | **String IDs** (not UUID) for SQLite compatibility | SQLAlchemy Uuid type incompatible with SQLite. All ID columns changed to hex strings for cross-DB compatibility. | **Accepted** |
| 2026-06-03 | **joblib for model persistence** (not pickle) | joblib is more efficient for large numpy arrays and provides compression. Models persisted to `models/latest.joblib`. | **Accepted** |
| 2026-06-03 | **Out-of-sample backtesting mandatory** | In-sample testing shows 100% win rate (overfitting). All strategy validation uses 80/20 train/test split minimum. | **Accepted** |
| 2026-06-03 | **5,256 matches minimum for model training** | With only 48 matches, model can't recognize unseen teams → 0 trades. 5,256 matches across 5 leagues / 3 seasons is the training minimum. | **Accepted** |
| 2026-06-03 | **GitHub repo: cahangeorge/betting-platform** | Pushed 83 files, 14 commits, all 13 sprints. Clean repo (node_modules excluded). | **Accepted** |

## Open Decisions
1. **WebSocket vs polling for dashboard**: Socket.IO adds complexity but gives true real-time. Polling is simpler but adds 5s latency.
2. **Kelly fraction tuning**: Current 0.25 is conservative. Increasing to 0.5–1.0 increases ROI but also drawdown risk exponentially.
3. **Edge threshold tuning**: Current 5% produces 276 trades on 5,256 matches. Lowering to 2% would produce more trades but lower quality.
4. **Additional leagues**: Eredivisie, Primeira Liga, Russian Premier League, MLS — expand beyond current 5.
5. **Real-time stats feed (<5s)**: football-data.org polls every 60s. For true in-play, need API-Football ($19/mo) or Sportmonks (€25/mo).
