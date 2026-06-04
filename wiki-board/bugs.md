# Known Bugs & Issues

## Critical (Fixed in Sprint Audits)
1. **RiskManager recreated every cycle**
   - Status: **Fixed** (commit 28caff7)
   - Symptom: `daily_pnl`, `open_positions`, `exposure` reset to 0 every 5 seconds
   - Fix: Persistent `_risk` instance in BotDaemon, updated balance each cycle
   - Location: `live_engine/bot_daemon.py:107`

2. **No `close_position()` method in RiskManager**
   - Status: **Fixed** (commit 28caff7)
   - Symptom: `open_positions` counter only increments, permanently blocks trades after first position
   - Fix: Added `close_position()` that decrements counter, reduces exposure, updates P&L
   - Location: `live_engine/risk_manager.py:48-50`

3. **daily_pnl never updated**
   - Status: **Fixed** (commit 28caff7)
   - Symptom: Daily loss limit check always passes because `daily_pnl` stays at 0
   - Fix: `close_position()` now updates `daily_pnl` with realized P&L
   - Location: `live_engine/bot_daemon.py:227`

4. **Backtest ZeroDivisionError**
   - Status: **Fixed** (commit 28caff7)
   - Symptom: Crash when bankroll depletes to 0 in `calculate_metrics()`
   - Fix: `peak` floored at 1.0, drawdown guarded by `if peak > 0`
   - Location: `training/backtest.py:125`

## High (Fixed in Sprint Audits)
5. **Exchange `login()` methods lack retry**
   - Status: **Fixed** (commit 28caff7)
   - Fix: `@retry(stop_after_attempt=3)` on both Betfair and Matchbook login
   - Location: `exchanges/betfair.py`, `exchanges/matchbook.py`

6. **Smarkets `submit_order()` no retry**
   - Status: **Fixed** (commit 28caff7)
   - Fix: `@retry(stop_after_attempt=3)` on Smarkets order placement
   - Location: `exchanges/smarkets.py`

7. **smarkets_api_key not in config**
   - Status: **Fixed** (commit 28caff7)
   - Symptom: Smarkets auth always empty string
   - Fix: Added to `Settings` + Docker secrets loader
   - Location: `core/config.py`

## Medium
8. **Config file corruption during filter mangling**
   - Status: **Fixed** (commit f3abbd7 recovery)
   - Symptom: `config.py` truncated at `redis_url` line due to platform content filter replacing `***` in URLs
   - Fix: Restored from git history; now use `redis://localhost:6379/0` (no password in URL)
   - Note: Any URL containing `***` triggers the filter

9. **Dixon-Coles negative probabilities with sparse data**
   - Status: **Fixed** (commit 0941fd5)
   - Symptom: Dixon-Coles produces negative probabilities when trained on < 100 matches
   - Fix: Graceful fallback to Poisson probabilities when DC returns negative values
   - Location: `predictions/models.py`

10. **PyJWT InsecureKeyLengthWarning**
    - Status: **Acknowledged**
    - Symptom: Warning when JWT_SECRET_KEY < 32 bytes
    - Fix: Set `JWT_SECRET_KEY` to ≥32 bytes in production
    - Location: `core/security.py`

11. **In-sample bias in backtest**
    - Status: **Acknowledged**
    - Symptom: 100% win rate when testing on same data used for training
    - Fix: Always use out-of-sample mode (80/20 split) for realistic results
    - Location: `training/backtest.py`

## Low
12. **No WebSocket push for live odds**
    - Status: **Acknowledged**
    - Impact: Dashboard uses 5s polling instead of real-time push
    - Fix: Add Socket.IO or native WebSocket gateway in FastAPI

13. **No lint/format scripts defined**
    - Status: **Acknowledged**
    - Impact: Code style enforcement missing for betfront
    - Fix: Add `ruff` to backend, `eslint + prettier` to frontend

14. **No CI workflow for betfront**
    - Status: **Acknowledged**
    - Impact: No automated test/build on PRs for the frontend
    - Fix: Add `.github/workflows/betfront.yml`

## Data / Scrapers
15. **football-data.org free tier limited to 10 calls/minute**
    - Status: **Expected behavior**
    - Impact: Rate limiting on bulk data expansion
    - Fix: Add exponential backoff; upgrade to paid tier ($19/mo) for production

16. **Understat scraper fragile on HTML changes**
    - Status: **Expected behavior**
    - Policy: Fix selectors when upstream changes; do not skip tests
    - Location: `stats/understat_feed.py`

17. **Cython models in penaltyblog require rebuild after edits**
    - Status: **Expected behavior**
    - Reminder: Run `pip install -e .` after modifying `.pyx` files

## Frontend
18. **Match detail page fetches ALL matches to find one by ID**
    - Status: **Fixed** (commit 8e977fd)
    - Fix: Uses `api.getMatch(id)` directly instead of filtering full list

19. **Prediction called before match loaded (hardcoded Arsenal/Chelsea)**
    - Status: **Fixed** (commit 8e977fd)
    - Fix: Prediction now called AFTER match is loaded with actual teams

20. **Raw JSON `<pre>` dumps in models/backtest pages**
    - Status: **Fixed** (commit 28caff7)
    - Fix: Structured result cards with key metrics instead of raw JSON dumps
