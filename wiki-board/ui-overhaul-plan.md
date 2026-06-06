# UI Overhaul Plan — shadcn-svelte + layerchart + PWA

**Date:** 2026-06-04
**Status:** PLANNED
**Estimated effort:** 16–22 hours

---

## User Decisions

1. **Fully replace** Stadium Intel theme — no legacy tokens
2. **Rounded corners** — `rounded-lg` / `rounded-xl` everywhere
3. **Three-column desktop** with bottom sheet on mobile
4. **Phone-first PWA** — installable, offline-capable
5. **Glassmorphism/transparency** — frosted glass panels, translucent cards

---

## Libraries

| Library | Purpose | Install |
|---|---|---|
| shadcn-svelte | Reusable UI primitives (Button, Card, Dialog, Sheet, Tabs, Input, Select, Badge, Table, Tooltip, etc.) | `npx shadcn-svelte init` then `npx shadcn-svelte add <component>` |
| layerchart | Charts — Area, Bar, Line, Pie, Sparkline with tooltips | `pnpm add layerchart` |
| svelte-awesome-color-picker | Color picker for theme customization (optional) | `pnpm add svelte-awesome-color-picker` |
| Lucide icons | Already installed — keep | — |

---

## Phase 1: Foundation (shadcn-svelte + Theme)

**Goal:** Install shadcn-svelte, set up new color system, configure Tailwind v4.

### Tasks

1. **Install shadcn-svelte**
   ```bash
   cd frontend
   npx shadcn-svelte init
   ```
   - Configures `components.json`
   - Sets up `src/lib/components/ui/` with shadcn conventions
   - Installs Bits UI as peer dependency

2. **Add core shadcn-svelte components**
   ```bash
   npx shadcn-svelte add button card input select tabs badge table tooltip dialog sheet separator dropdown-menu
   ```

3. **New color system (CSS custom properties)**
   - Remove all Stadium Intel tokens (`--bg-deep`, `--accent-green`, etc.)
   - Replace with shadcn-svelte HSL-based tokens:
     ```css
     :root {
       --background: 0 0% 100%;
       --foreground: 222.2 84% 4.9%;
       --card: 0 0% 100%;
       --card-foreground: 222.2 84% 4.9%;
       --primary: 142.1 76.2% 36.3%;
       --primary-foreground: 355.7 100% 97.3%;
       --secondary: 210 40% 96.1%;
       --muted: 210 40% 96.1%;
       --accent: 210 40% 96.1%;
       --destructive: 0 84.2% 60.2%;
       --border: 214.3 31.8% 91.4%;
       --input: 214.3 31.8% 91.4%;
       --ring: 142.1 76.2% 36.3%;
       --radius: 0.75rem;
     }
     .dark {
       --background: 222.2 84% 4.9%;
       --foreground: 210 40% 98%;
       --card: 222.2 84% 4.9%;
       --primary: 142.1 76.2% 36.3%;
       --secondary: 217.2 32.6% 17.5%;
       --muted: 217.2 32.6% 17.5%;
       --accent: 217.2 32.6% 17.5%;
       --destructive: 0 62.8% 30.6%;
       --border: 217.2 32.6% 17.5%;
     }
     ```

4. **Football accent colors** (add to theme)
   ```css
   :root {
     --football-red: #ee3344;
     --football-green: #a9b062;
     --football-blue: #004f9f;
     --football-gold: #c9a227;
   }
   ```

5. **Font stack**
   - Body: Inter (keep)
   - Data/numbers: JetBrains Mono (keep)
   - Remove Oswald (shadcn uses system fonts)
   - Or keep Oswald for sport-specific headings only

6. **Delete `app.css` global classes**
   - Remove all `.card-*`, `.btn-*`, `.input-*`, `.tab-*`, `.badge-*` classes
   - shadcn-svelte handles all component styling via Tailwind utilities

7. **Update `tailwind.config.ts`**
   - shadcn-svelte provides its own config — merge or replace
   - Ensure `darkMode: 'class'` is set

---

## Phase 2: Component Migration

**Goal:** Replace all custom components with shadcn-svelte equivalents.

### Migration Map

| Current Component | Replacement | Notes |
|---|---|---|
| `ui/Button.svelte` | shadcn `Button` | variant: `default`/`destructive`/`outline`/`secondary`/`ghost`/`link` |
| `ui/Card.svelte` | shadcn `Card` | CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| `ui/Input.svelte` | shadcn `Input` | Direct replacement |
| `ui/Select.svelte` | shadcn `Select` | SelectTrigger, SelectContent, SelectItem |
| `ui/Tabs.svelte` | shadcn `Tabs` | TabsList, TabsTrigger, TabsContent |
| `ui/Badge.svelte` | shadcn `Badge` | variant: `default`/`secondary`/`destructive`/`outline` |
| `ui/Table.svelte` | shadcn `Table` | TableHeader, TableBody, TableRow, TableHead, TableCell |

### New shadcn Components to Add

- `Dialog` — modals for bet placement, confirmations
- `Sheet` — mobile bottom sheet for betslip
- `DropdownMenu` — user menu, action menus
- `Tooltip` — odds explanations, stat tooltips
- `Separator` — visual dividers
- `Skeleton` — loading states

### Domain Components to Rewrite

| Component | Approach |
|---|---|
| `Navbar.svelte` | shadcn `Sheet` for mobile nav, `DropdownMenu` for user |
| `Sidebar.svelte` | shadcn `Button` + custom, glassmorphism background |
| `BetSlipDrawer.svelte` | shadcn `Sheet` (right side on desktop, bottom on mobile) |
| `CommandPalette.svelte` | shadcn `Dialog` + custom search |
| `MatchCard.svelte` | shadcn `Card` with custom content |
| `OddsTable.svelte` | shadcn `Table` with custom cells |
| `OddsMovement.svelte` | Replace custom SVG with layerchart `Sparkline` or `Area` |
| `LiveMatchTracker.svelte` | shadcn `Card` + custom content |
| `AuthForm.svelte` | shadcn `Card` + `Input` + `Button` |
| `Ticker.svelte` | Keep custom CSS animation |
| `Loading.svelte` | shadcn `Skeleton` or custom |

---

## Phase 3: Charts (layerchart)

**Goal:** Add data visualizations for odds, predictions, P&L.

### layerchart Components to Use

```svelte
<script>
  import { AreaChart, BarChart, LineChart, PieChart, Sparkline } from 'layerchart';
</script>
```

### Chart Types Needed

| Chart | Component | Data | Page |
|---|---|---|---|
| Odds movement sparkline | `Sparkline` | Odds history array | MatchCard, OddsTable |
| Equity curve | `AreaChart` | Bankroll over time | Account |
| P&L by league | `BarChart` | League → profit | Predict (backtest) |
| Win rate by model | `PieChart` or `BarChart` | Model → win % | Predict |
| Edge distribution | `BarChart` | Edge bucket → count | Value-Bets |
| xG timeline | `AreaChart` | Minute → xG | Live |
| Odds comparison | `BarChart` | Bookmaker → odds | Board |

### layerchart Features

- Built-in `Tooltip` with `ChartContext`
- `Spline` for smooth curves
- `Bars` for bar charts
- `Area` with gradient fill
- Theme-able via CSS custom properties
- Svelte 5 compatible

---

## Phase 4: Layout Overhaul (Phone-First)

**Goal:** Responsive layout that works great on mobile as a PWA.

### Desktop (>1024px)

```
┌──────────┬─────────────────────────┬──────────────┐
│ Sidebar  │ Main Content            │ Betslip      │
│ 220px    │ Flexible                │ 320px        │
│ Fixed    │ Scrollable              │ Sticky       │
│ glass    │                         │ glass        │
└──────────┴─────────────────────────┴──────────────┘
```

### Tablet (768–1024px)

```
┌──────────────────────────────────────────────────┐
│ Navbar (hamburger → Sheet sidebar)               │
├──────────────────────────────────────────────────┤
│ Main Content (full width)                        │
├──────────────────────────────────────────────────┤
│ Betslip (collapsible bottom sheet)               │
└──────────────────────────────────────────────────┘
```

### Mobile (<768px)

```
┌──────────────────────────────────┐
│ Navbar (hamburger → Sheet)       │
├──────────────────────────────────┤
│ Main Content (full width)        │
│                                  │
│                                  │
├──────────────────────────────────┤
│ Bottom Nav (5 tabs)              │
│ Home │ Predict │ Tickets │ Data  │
├──────────────────────────────────┤
│ Betslip FAB → Sheet (bottom)    │
└──────────────────────────────────┘
```

### Key Layout Components

- `+layout.svelte` — shadcn `Sheet` for sidebar, responsive grid
- `BottomNav.svelte` — NEW: mobile bottom navigation bar
- `BetslipFAB.svelte` — NEW: floating action button showing betslip count → opens Sheet

---

## Phase 5: Light/Dark Toggle

**Goal:** System-preference-aware theme with manual override.

### Implementation

1. Add `ThemeToggle.svelte` component (sun/moon icon button)
2. Store preference in `localStorage`
3. Toggle `.dark` class on `<html>`
4. Respect `prefers-color-scheme` on first visit
5. All colors via CSS custom properties — light mode works automatically

### shadcn-svelte Theme

shadcn-svelte provides both light and dark token sets. The toggle simply switches between them.

---

## Phase 6: Polish

### Animations

- Page transitions: `view-transition-name` for SPA feel
- Card hover: scale(1.02) + shadow
- Odds movement: color flash (green up, red down)
- Loading states: shadcn `Skeleton` shimmer
- Live dot: pulse animation

### PWA Polish

- Offline fallback page
- App icons (multiple sizes)
- Splash screen
- Share target (share odds/matches)
- Push notification support (future)

### Accessibility

- All shadcn components are WCAG 2.1 AA compliant
- Keyboard navigation for betslip
- Screen reader announcements for live odds
- Focus management in dialogs

---

## File Structure (After)

```
frontend/
├── src/
│   ├── app.css                          # shadcn tokens only
│   ├── app.html
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ui/                      # shadcn-svelte components
│   │   │   │   ├── button/
│   │   │   │   ├── card/
│   │   │   │   ├── dialog/
│   │   │   │   ├── input/
│   │   │   │   ├── select/
│   │   │   │   ├── sheet/
│   │   │   │   ├── tabs/
│   │   │   │   ├── table/
│   │   │   │   ├── badge/
│   │   │   │   ├── tooltip/
│   │   │   │   ├── separator/
│   │   │   │   ├── dropdown-menu/
│   │   │   │   ├── skeleton/
│   │   │   │   └── theme-toggle/
│   │   │   ├── Navbar.svelte
│   │   │   ├── Sidebar.svelte
│   │   │   ├── BottomNav.svelte          # NEW
│   │   │   ├── BetSlipDrawer.svelte
│   │   │   ├── BetslipFAB.svelte         # NEW
│   │   │   ├── CommandPalette.svelte
│   │   │   ├── MatchCard.svelte
│   │   │   ├── OddsTable.svelte
│   │   │   ├── OddsMovement.svelte       # layerchart Sparkline
│   │   │   ├── LiveMatchTracker.svelte
│   │   │   ├── Ticker.svelte
│   │   │   ├── Loading.svelte
│   │   │   ├── AuthForm.svelte
│   │   │   ├── AccountPanel.svelte
│   │   │   ├── PredictPanel.svelte
│   │   │   ├── TicketsPanel.svelte
│   │   │   ├── DataPanel.svelte
│   │   │   └── JobsPanel.svelte
│   │   ├── api/                          # API client (unchanged)
│   │   └── types.ts
│   ├── routes/                           # Pages (unchanged structure)
│   │   ├── +layout.svelte
│   │   ├── +page.svelte
│   │   ├── login/ +signup/ +account/ +predict/ +tickets/
│   │   ├── data/ +board/ +about/ +value-bets/ +live/
│   │   └── +layout.ts                    # Auth guard
│   └── service-worker.ts
├── components.json                       # shadcn-svelte config
├── package.json
├── svelte.config.js
├── vite.config.ts
└── static/
    ├── manifest.json
    └── icons/
```

---

## Success Criteria

- [ ] All shadcn-svelte components render correctly
- [ ] Charts render with layerchart (odds sparklines, equity curves, P&L bars)
- [ ] Three-column layout works on desktop
- [ ] Bottom sheet works on mobile
- [ ] PWA installs and works offline
- [ ] Light/dark toggle works
- [ ] All existing functionality preserved (auth, predict, tickets, data, board)
- [ ] No hardcoded hex values in components
- [ ] Build passes cleanly
- [ ] No TypeScript errors
