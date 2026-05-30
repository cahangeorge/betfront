import sqlite3
conn = sqlite3.connect('/root/betfront/dev.db')
c = conn.cursor()
c.execute("SELECT homeScore IS NULL, COUNT(*) FROM Match WHERE matchDate = '2026-05-20' GROUP BY homeScore IS NULL")
for row in c.fetchall():
    print(row)

c.execute("SELECT id, homeTeam, awayTeam, matchDate, homeScore, awayScore FROM Match WHERE matchDate = '2026-05-20' LIMIT 40")
for row in c.fetchall():
    print(row)
