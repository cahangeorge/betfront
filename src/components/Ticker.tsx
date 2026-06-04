import * as React from 'react';

interface TickerItem {
  home: string;
  away: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  league: string;
  time: string;
}

const demoItems: TickerItem[] = [
  { home: 'Man City', away: 'Arsenal', homeOdds: 1.85, drawOdds: 3.60, awayOdds: 4.20, league: 'Premier League', time: '20:00' },
  { home: 'Real Madrid', away: 'Barcelona', homeOdds: 2.10, drawOdds: 3.40, awayOdds: 3.50, league: 'La Liga', time: '21:00' },
  { home: 'Bayern', away: 'Dortmund', homeOdds: 1.65, drawOdds: 4.00, awayOdds: 5.50, league: 'Bundesliga', time: '18:30' },
  { home: 'Inter', away: 'Milan', homeOdds: 2.30, drawOdds: 3.20, awayOdds: 3.30, league: 'Serie A', time: '19:45' },
  { home: 'PSG', away: 'Marseille', homeOdds: 1.50, drawOdds: 4.20, awayOdds: 6.00, league: 'Ligue 1', time: '20:45' },
  { home: 'Liverpool', away: 'Chelsea', homeOdds: 1.75, drawOdds: 3.80, awayOdds: 4.60, league: 'Premier League', time: '17:30' },
  { home: 'Juventus', away: 'Napoli', homeOdds: 2.55, drawOdds: 3.10, awayOdds: 3.00, league: 'Serie A', time: '20:00' },
  { home: 'Atletico', away: 'Sevilla', homeOdds: 1.90, drawOdds: 3.50, awayOdds: 4.40, league: 'La Liga', time: '19:00' },
];

function OddsButton({ label, odds }: { label: string; odds: number }) {
  return (
    <button
      type="button"
      className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1.5 text-xs transition hover:bg-[var(--lagoon)]/10 hover:border-[var(--lagoon)]/30 min-w-[3.5rem]"
    >
      <span className="text-[10px] font-medium text-[var(--sea-ink-soft)] uppercase tracking-wide">{label}</span>
      <span className="text-sm font-bold text-[var(--sea-ink)]">{odds.toFixed(2)}</span>
    </button>
  );
}

function MatchRow({ item }: { item: TickerItem }) {
  return (
    <div className="flex-shrink-0 flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 backdrop-blur-sm">
      <div className="flex flex-col gap-0.5 min-w-[7rem]">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--lagoon-deep)]">{item.league}</span>
        <span className="text-xs text-[var(--sea-ink-soft)]">{item.time}</span>
      </div>

      <div className="flex items-center gap-3 min-w-[12rem]">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-sm font-semibold text-[var(--sea-ink)]">{item.home}</span>
          <span className="text-xs text-[var(--sea-ink-soft)]">Home</span>
        </div>
        <span className="text-xs text-[var(--sea-ink-soft)]">vs</span>
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-semibold text-[var(--sea-ink)]">{item.away}</span>
          <span className="text-xs text-[var(--sea-ink-soft)]">Away</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <OddsButton label="1" odds={item.homeOdds} />
        <OddsButton label="X" odds={item.drawOdds} />
        <OddsButton label="2" odds={item.awayOdds} />
      </div>
    </div>
  );
}

export function Ticker({ items = demoItems, speed = 40 }: { items?: TickerItem[]; speed?: number }) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = React.useState(false);

  // Duplicate items to create seamless infinite scroll
  const allItems = React.useMemo(() => [...items, ...items], [items]);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let animationId: number;
    let lastTime = performance.now();
    let offset = 0;

    const step = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      if (!paused) {
        // pixels per second
        offset += (speed * dt) / 1000;

        const firstChild = track.firstElementChild as HTMLElement | null;
        if (firstChild) {
          const itemWidth = firstChild.offsetWidth + 16; // gap-4 = 16px
          const halfWidth = itemWidth * items.length;

          if (offset >= halfWidth) {
            offset -= halfWidth;
          }
        }

        track.style.transform = `translateX(-${offset}px)`;
      }

      animationId = requestAnimationFrame(step);
    };

    animationId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationId);
  }, [paused, speed, items.length]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Left fade */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-[var(--surface)] to-transparent" />
      {/* Right fade */}
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-[var(--surface)] to-transparent" />

      <div ref={trackRef} className="flex gap-4 px-4 will-change-transform">
        {allItems.map((item, i) => (
          <MatchRow key={`${item.home}-${item.away}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
