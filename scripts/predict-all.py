#!/usr/bin/env python3
"""BetFront comprehensive prediction generator - dynamic column mapping."""

import sqlite3, json, sys, math
from datetime import datetime
from collections import defaultdict

db_path = '/root/betfront/dev.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# ─── Get exact Prediction columns ─────────────────────────────
c.execute("PRAGMA table_info(Prediction)")
def_cols = [col[1] for col in c.fetchall()]  # list of column names
if 'json' not in def_cols:
    c.execute("ALTER TABLE Prediction ADD COLUMN json TEXT")
    conn.commit()
    def_cols.append('json')

INSERT_COLS = [col for col in def_cols if col != 'id']
PLACEHOLDERS = ','.join(['?' for _ in INSERT_COLS])
COL_LIST = ','.join(INSERT_COLS)

# ─── Load datasets ────────────────────────────────────────────

def load_json_dataset(source, operation=None):
    if operation:
        c.execute("SELECT data FROM ScrapedDataset WHERE source=? AND operation=? ORDER BY id DESC", (source, operation))
    else:
        c.execute("SELECT data FROM ScrapedDataset WHERE source=? ORDER BY id DESC", (source,))
    result = {}
    for row in c.fetchall():
        try:
            d = json.loads(row[0])
            if isinstance(d, dict):
                result.update(d)
        except:
            pass
    return result

team_histories = load_json_dataset('TeamHistory-Generated', 'generate_team_history')
team_stats      = load_json_dataset('TeamStats-Generated',    'generate_team_stats')
elo_data        = load_json_dataset('ClubElo-Teams',          'read_by_date')

# ─── Helpers ──────────────────────────────────────────────────

def get_team_data(name):
    if name in team_histories:
        h = team_histories[name]
    elif name in team_stats:
        h = team_stats[name]
    else:
        aliases = {
            'St. Louis City': 'St Louis City',
            'Charlotte': 'Charlotte FC',
            'Sao Paulo': 'Sao Paulo FC',
            'Botafogo RJ': 'Botafogo',
            'Vitoria': 'Vitoria BA',
            'Flamengo RJ': 'Flamengo',
            'Athletico-PR': 'Athletico Paranaense',
            'Chapecoense-SC': 'Chapecoense',
            'Atletico-MG': 'Atletico Mineiro',
            'Wolves': 'Wolverhampton Wanderers',
            'Leeds': 'Leeds United',
            'Leicester': 'Leicester City',
            'Nottm Forest': 'Nottingham Forest',
        }
        h = team_histories.get(aliases.get(name, name)) or team_stats.get(aliases.get(name, name)) or {}
    s = team_stats.get(name, team_stats.get(h.get('team', ''), {}))
    return h, s

def get_elo(name):
    if name in elo_data:
        return elo_data[name].get('elo', 1500)
    for k, v in elo_data.items():
        if name.lower() in k.lower() or k.lower() in name.lower():
            return v.get('elo', 1500)
    return 1500

def poisson_pmf(lam, k):
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return (lam ** k) * math.exp(-lam) / math.factorial(k)

def poisson_cdf(lam, k):
    return sum(poisson_pmf(lam, i) for i in range(k + 1))

def bivariate_grid(hl, al, mg=10):
    grid = {}
    for i in range(mg + 1):
        for j in range(mg + 1):
            grid[(i, j)] = poisson_pmf(max(hl, 0.1), i) * poisson_pmf(max(al, 0.1), j)
    total = sum(grid.values())
    if total > 0:
        for k in grid:
            grid[k] /= total
    return grid

def goal_exp(team, venue):
    h, s = get_team_data(team)
    base = 1.3
    if s and 'season' in s:
        m  = s['season'].get('matches', 1)
        gf = s['season'].get('goalsFor', 0)
        ga = s['season'].get('goalsAgainst', 0)
        if m > 0:
            base = gf / m if venue == 'home' else ga / m
            if venue == 'home':
                base *= 1.15
            elif venue == 'away':
                base *= 0.85
    if s and 'last5' in s:
        gf5 = sum(m.get('gf', 0) for m in s['last5'])
        base = base * 0.6 + (gf5 / 5) * 0.4
    if h and 'last10' in h:
        gf10 = sum(m.get('gf', 0) for m in h['last10'])
        ga10 = sum(m.get('ga', 0) for m in h['last10'])
        if venue == 'home':
            base = base * 0.5 + (gf10 / 10) * 0.5
        else:
            base = base * 0.5 + (ga10 / 10) * 0.5
        avg_shots = sum(m.get('shots', 12) for m in h['last10']) / 10
        avg_sot   = sum(m.get('shots_on_target', 4) for m in h['last10']) / 10
        avg_poss  = sum(m.get('possession', 50) for m in h['last10']) / 10
        xg = avg_shots * 0.08 + avg_sot * 0.22 + (avg_poss - 50) * 0.01
        base = base * 0.6 + xg * 0.4
    elo = get_elo(team)
    base *= 1 + (elo - 1500) / 5000
    return max(0.4, min(3.5, base))

def team_stats_data(team, venue='neutral'):
    h, s = get_team_data(team)
    if not h:
        return {'y': 2.5, 'r': 0.15, 'f': 20.0, 'o': 2.0, 'gf': 1.3, 'ga': 1.3, 'oy': 2.0}
    ms = h.get('last10', [])
    if venue == 'home':
        ms = [m for m in ms if m.get('venue') == 'Home']
    elif venue == 'away':
        ms = [m for m in ms if m.get('venue') == 'Away']
    if not ms:
        ms = h.get('last10', [])
    n = len(ms)
    return {
        'y':  sum(m.get('yellows', 0) for m in ms) / max(n, 1),
        'r':  sum(m.get('reds', 0) for m in ms) / max(n, 1),
        'f':  sum(m.get('fouls_committed', 20) for m in ms) / max(n, 1),
        'o':  sum(m.get('offsides', 2) for m in ms) / max(n, 1),
        'gf': sum(m.get('gf', 0) for m in ms) / max(n, 1),
        'ga': sum(m.get('ga', 0) for m in ms) / max(n, 1),
        'oy': sum(m.get('opponent_yellows', 2) for m in ms) / max(n, 1),
    }

def predict(home, away):
    hl = goal_exp(home, 'home') * 1.15
    al = goal_exp(away, 'away') * 0.90
    hs = team_stats_data(home, 'home')
    ast = team_stats_data(away, 'away')

    grid = bivariate_grid(hl, al)
    ph = sum(v for (i, j), v in grid.items() if i > j)
    pd = sum(v for (i, j), v in grid.items() if i == j)
    pa = sum(v for (i, j), v in grid.items() if i < j)
    tt = ph + pd + pa
    if tt > 0:
        ph, pd, pa = ph / tt, pd / tt, pa / tt

    btts_y = sum(v for (i, j), v in grid.items() if i > 0 and j > 0)
    btts_n = 1 - btts_y

    tg = defaultdict(float)
    for (i, j), v in grid.items():
        tg[i + j] += v
    o15 = sum(v for g, v in tg.items() if g > 1.5)
    u15 = 1 - o15
    o25 = sum(v for g, v in tg.items() if g > 2.5)
    u25 = 1 - o25
    o35 = sum(v for g, v in tg.items() if g > 3.5)
    u35 = 1 - o35

    egh = sum(i * v for (i, j), v in grid.items())
    ega = sum(j * v for (i, j), v in grid.items())

    dc1x = ph + pd
    dcx2 = pd + pa
    dc12 = ph + pa
    if ph + pa > 0:
        dnb_h = ph / (ph + pa)
        dnb_a = pa / (ph + pa)
    else:
        dnb_h = dnb_a = 0.5

    out = '1' if ph > pd and ph > pa else ('2' if pa > ph and pa > pd else 'X')
    conf = max(ph, pd, pa)

    # Half-time
    hhl = hl * 0.40
    hal = al * 0.40
    ht_grid = bivariate_grid(hhl, hal, 6)
    hph = sum(v for (i, j), v in ht_grid.items() if i > j)
    hpd = sum(v for (i, j), v in ht_grid.items() if i == j)
    hpa = sum(v for (i, j), v in ht_grid.items() if i < j)
    htt = hph + hpd + hpa
    if htt > 0:
        hph, hpd, hpa = hph / htt, hpd / htt, hpa / htt
    hbtts = sum(v for (i, j), v in ht_grid.items() if i > 0 and j > 0)
    ht_tg = defaultdict(float)
    for (i, j), v in ht_grid.items():
        ht_tg[i + j] += v
    ho15 = sum(v for g, v in ht_tg.items() if g > 1.5)
    hu15 = 1 - ho15
    ho25 = sum(v for g, v in ht_tg.items() if g > 2.5)
    hu25 = 1 - ho25
    ho35 = sum(v for g, v in ht_tg.items() if g > 3.5)
    hu35 = 1 - ho35
    hdc1x = hph + hpd
    hdcx2 = hpd + hpa
    hdc12 = hph + hpa
    if hph + hpa > 0:
        hdnb_h = hph / (hph + hpa)
        hdnb_a = hpa / (hph + hpa)
    else:
        hdnb_h = hdnb_a = 0.5

    # Second-half
    shl = hl * 0.55
    sal = al * 0.55
    sh_grid = bivariate_grid(shl, sal, 8)
    sph = sum(v for (i, j), v in sh_grid.items() if i > j)
    spd = sum(v for (i, j), v in sh_grid.items() if i == j)
    spa = sum(v for (i, j), v in sh_grid.items() if i < j)
    stt = sph + spd + spa
    if stt > 0:
        sph, spd, spa = sph / stt, spd / stt, spa / stt
    sbtts = sum(v for (i, j), v in sh_grid.items() if i > 0 and j > 0)
    sh_tg = defaultdict(float)
    for (i, j), v in sh_grid.items():
        sh_tg[i + j] += v
    so15 = sum(v for g, v in sh_tg.items() if g > 1.5)
    su15 = 1 - so15
    so25 = sum(v for g, v in sh_tg.items() if g > 2.5)
    su25 = 1 - so25
    so35 = sum(v for g, v in sh_tg.items() if g > 3.5)
    su35 = 1 - so35
    sdc1x = sph + spd
    sdcx2 = spd + spa
    sdc12 = sph + spa
    if sph + spa > 0:
        sdnb_h = sph / (sph + spa)
        sdnb_a = spa / (sph + spa)
    else:
        sdnb_h = sdnb_a = 0.5

    # Cards / Fouls / Offsides
    ty = (hs['y'] + ast['y'] + hs['oy'] + ast['oy']) / 2
    ty = max(1.5, min(6.0, ty))
    c_o25 = 1 - poisson_cdf(ty, 2)
    c_u25 = poisson_cdf(ty, 2)
    c_o35 = 1 - poisson_cdf(ty, 3)
    c_u35 = poisson_cdf(ty, 3)
    c_o45 = 1 - poisson_cdf(ty, 4)
    c_u45 = poisson_cdf(ty, 4)

    tf = (hs['f'] + ast['f']) / 2
    tf = max(15, min(35, tf))
    f_o215 = 1 - poisson_cdf(tf, 21)
    f_u215 = poisson_cdf(tf, 21)
    f_o255 = 1 - poisson_cdf(tf, 25)
    f_u255 = poisson_cdf(tf, 25)

    to = (hs['o'] + ast['o']) / 2
    to = max(1.0, min(6.0, to))
    o_o35 = 1 - poisson_cdf(to, 3)
    o_u35 = poisson_cdf(to, 3)
    o_o45 = 1 - poisson_cdf(to, 4)
    o_u45 = poisson_cdf(to, 4)

    hcs = poisson_pmf(al, 0)
    acs = poisson_pmf(hl, 0)

    extras = {
        'cards_yellows_expected': round(ty, 2),
        'cardsOver25': round(c_o25, 4), 'cardsUnder25': round(c_u25, 4),
        'cardsOver35': round(c_o35, 4), 'cardsUnder35': round(c_u35, 4),
        'cardsOver45': round(c_o45, 4), 'cardsUnder45': round(c_u45, 4),
        'fouls_expected': round(tf, 2),
        'foulsOver215': round(f_o215, 4), 'foulsUnder215': round(f_u215, 4),
        'foulsOver255': round(f_o255, 4), 'foulsUnder255': round(f_u255, 4),
        'offsides_expected': round(to, 2),
        'offsidesOver35': round(o_o35, 4), 'offsidesUnder35': round(o_u35, 4),
        'offsidesOver45': round(o_o45, 4), 'offsidesUnder45': round(o_u45, 4),
        'homeCleanSheetProb': round(hcs, 4), 'awayCleanSheetProb': round(acs, 4),
        'homeRedExpected': round(hs['r'], 2), 'awayRedExpected': round(ast['r'], 2),
    }

    return {
        'homeWinProb': round(ph, 4), 'drawProb': round(pd, 4), 'awayWinProb': round(pa, 4),
        'predictedGoalsHome': round(egh, 2), 'predictedGoalsAway': round(ega, 2),
        'predictedOutcome': out, 'confidence': round(conf, 4),
        'dc1X': round(dc1x, 4), 'dcX2': round(dcx2, 4), 'dc12': round(dc12, 4),
        'dnbHome': round(dnb_h, 4), 'dnbAway': round(dnb_a, 4),
        'over15': round(o15, 4), 'under15': round(u15, 4),
        'over25': round(o25, 4), 'under25': round(u25, 4),
        'over35': round(o35, 4), 'under35': round(u35, 4),
        'bttsYes': round(btts_y, 4), 'bttsNo': round(btts_n, 4),
        'ahHome': round(dnb_h, 4), 'ahAway': round(dnb_a, 4),
        'htHomeWinProb': round(hph, 4), 'htDrawProb': round(hpd, 4), 'htAwayWinProb': round(hpa, 4),
        'htGoalsHome': round(hhl, 2), 'htGoalsAway': round(hal, 2),
        'htDc1X': round(hdc1x, 4), 'htDcX2': round(hdcx2, 4), 'htDc12': round(hdc12, 4),
        'htDnbHome': round(hdnb_h, 4), 'htDnbAway': round(hdnb_a, 4),
        'htOver15': round(ho15, 4), 'htUnder15': round(hu15, 4),
        'htOver25': round(ho25, 4), 'htUnder25': round(hu25, 4),
        'htOver35': round(ho35, 4), 'htUnder35': round(hu35, 4),
        'htBttsYes': round(hbtts, 4), 'htBttsNo': round(1 - hbtts, 4),
        'htAhHome': round(hdnb_h, 4), 'htAhAway': round(hdnb_a, 4),
        'shHomeWinProb': round(sph, 4), 'shDrawProb': round(spd, 4), 'shAwayWinProb': round(spa, 4),
        'shGoalsHome': round(shl, 2), 'shGoalsAway': round(sal, 2),
        'shDc1X': round(sdc1x, 4), 'shDcX2': round(sdcx2, 4), 'shDc12': round(sdc12, 4),
        'shDnbHome': round(sdnb_h, 4), 'shDnbAway': round(sdnb_a, 4),
        'shOver15': round(so15, 4), 'shUnder15': round(su15, 4),
        'shOver25': round(so25, 4), 'shUnder25': round(su25, 4),
        'shOver35': round(so35, 4), 'shUnder35': round(su35, 4),
        'shBttsYes': round(sbtts, 4), 'shBttsNo': round(1 - sbtts, 4),
        'shAhHome': round(sdnb_h, 4), 'shAhAway': round(sdnb_a, 4),
        'extras': extras,
    }

# ─── Main ─────────────────────────────────────────────────────
print("=== COMPREHENSIVE PREDICTIONS ===")
c.execute("SELECT id, matchDate, league, homeTeam, awayTeam FROM Match WHERE homeScore IS NULL AND matchDate >= '2026-05-23' ORDER BY matchDate")
upcoming = c.fetchall()
print(f"Upcoming matches: {len(upcoming)}")

c.execute("INSERT INTO PredictionSession (league, source, model, config, matchCount, createdAt) VALUES (?,?,?,?,?,?)",
          ('mixed', 'comprehensive-scraper-ai', 'poisson-xg-cards-fouls', '{}', len(upcoming), datetime.now().isoformat()))
session_id = c.lastrowid
c.execute("DELETE FROM Prediction WHERE matchDate >= '2026-05-23'")

inserted = 0
for m in upcoming:
    home_team, away_team = m['homeTeam'], m['awayTeam']
    try:
        p = predict(home_team, away_team)
    except Exception as e:
        print(f"Error predicting {home_team} vs {away_team}: {e}")
        continue

    now = datetime.now().isoformat()

    # Build row dict
    row = {
        'sessionId': session_id,
        'homeTeam': home_team,
        'awayTeam': away_team,
        'matchDate': m['matchDate'],
        'league': m['league'] or '',
        'homeWinProb': p['homeWinProb'],
        'drawProb': p['drawProb'],
        'awayWinProb': p['awayWinProb'],
        'predictedGoalsHome': p['predictedGoalsHome'],
        'predictedGoalsAway': p['predictedGoalsAway'],
        'predictedOutcome': p['predictedOutcome'],
        'confidence': p['confidence'],
        'dc1X': p['dc1X'],
        'dcX2': p['dcX2'],
        'dc12': p['dc12'],
        'dnbHome': p['dnbHome'],
        'dnbAway': p['dnbAway'],
        'over15': p['over15'],
        'under15': p['under15'],
        'over25': p['over25'],
        'under25': p['under25'],
        'over35': p['over35'],
        'under35': p['under35'],
        'bttsYes': p['bttsYes'],
        'bttsNo': p['bttsNo'],
        'ahHome': p['ahHome'],
        'ahAway': p['ahAway'],
        'htHomeWinProb': p['htHomeWinProb'],
        'htDrawProb': p['htDrawProb'],
        'htAwayWinProb': p['htAwayWinProb'],
        'htGoalsHome': p['htGoalsHome'],
        'htGoalsAway': p['htGoalsAway'],
        'htDc1X': p['htDc1X'],
        'htDcX2': p['htDcX2'],
        'htDc12': p['htDc12'],
        'htDnbHome': p['htDnbHome'],
        'htDnbAway': p['htDnbAway'],
        'htOver15': p['htOver15'],
        'htUnder15': p['htUnder15'],
        'htOver25': p['htOver25'],
        'htUnder25': p['htUnder25'],
        'htOver35': p['htOver35'],
        'htUnder35': p['htUnder35'],
        'htBttsYes': p['htBttsYes'],
        'htBttsNo': p['htBttsNo'],
        'htAhHome': p['htAhHome'],
        'htAhAway': p['htAhAway'],
        'shHomeWinProb': p['shHomeWinProb'],
        'shDrawProb': p['shDrawProb'],
        'shAwayWinProb': p['shAwayWinProb'],
        'shGoalsHome': p['shGoalsHome'],
        'shGoalsAway': p['shGoalsAway'],
        'shDc1X': p['shDc1X'],
        'shDcX2': p['shDcX2'],
        'shDc12': p['shDc12'],
        'shDnbHome': p['shDnbHome'],
        'shDnbAway': p['shDnbAway'],
        'shOver15': p['shOver15'],
        'shUnder15': p['shUnder15'],
        'shOver25': p['shOver25'],
        'shUnder25': p['shUnder25'],
        'shOver35': p['shOver35'],
        'shUnder35': p['shUnder35'],
        'shBttsYes': p['shBttsYes'],
        'shBttsNo': p['shBttsNo'],
        'shAhHome': p['shAhHome'],
        'shAhAway': p['shAhAway'],
        'isValueBet': False,
        'valueBetMarket': None,
        'bookmakerOdds': None,
        'expectedValue': 0.0,
        'actualOutcome': None,
        'isCorrect': None,
        'createdAt': now,
        'json': json.dumps(p['extras']),
    }

    # Map row to INSERT_COLS order
    values = [row.get(col) for col in INSERT_COLS]

    sql = f"INSERT INTO Prediction ({COL_LIST}) VALUES ({PLACEHOLDERS})"
    c.execute(sql, values)
    inserted += 1

conn.commit()
print(f"\nInserted {inserted} predictions into session #{session_id}")

# Summary
print("\n=== PREDICTION SUMMARY ===")
c.execute(
    """
    SELECT matchDate, league, homeTeam, awayTeam, predictedOutcome, confidence,
           predictedGoalsHome, predictedGoalsAway,
           homeWinProb, drawProb, awayWinProb, bttsYes, over25, under25, json
    FROM Prediction WHERE sessionId = ?
    ORDER BY matchDate
    """,
    (session_id,),
)
rows = c.fetchall()
for r in rows:
    extras = json.loads(r['json']) if r['json'] else {}
    print(f"  {r['matchDate']} | {r['league']} | {r['homeTeam']} vs {r['awayTeam']}")
    print(f"    FT: {r['predictedOutcome']} conf={r['confidence']:.2f} | Goals {r['predictedGoalsHome']}-{r['predictedGoalsAway']}")
    print(f"    1X2={r['homeWinProb']:.2f}/{r['drawProb']:.2f}/{r['awayWinProb']:.2f} | BTTS={r['bttsYes']:.2f} | O2.5={r['over25']:.2f} U2.5={r['under25']:.2f}")
    if extras:
        print(f"    CardsExp={extras.get('cards_yellows_expected')} | FoulsExp={extras.get('fouls_expected')} | OffsidesExp={extras.get('offsides_expected')}")
        print(f"    CleanSheet: Home={extras.get('homeCleanSheetProb'):.2f} Away={extras.get('awayCleanSheetProb'):.2f}")

conn.close()
