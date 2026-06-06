# UI Overhaul Research — Libraries & Libraries Reference

**Date:** 2026-06-04
**Status:** COMPLETE

---

## shadcn-svelte

### What It Is

Editable component library built on Bits UI. Components live in your project under `src/lib/components/ui/` — you own the code, can modify freely.

### Installation

```bash
# Initialize (creates components.json, installs deps)
npx shadcn-svelte init

# Add components (copies source into your project)
npx shadcn-svelte add button card input select tabs badge table tooltip dialog sheet separator dropdown-menu skeleton
```

### Dependencies

- Bits UI (peer) — headless primitives
- Tailwind CSS v4
- clsx + tailwind-merge
- Lucide icons (already installed)

### Key Components

| Component | Purpose | shadcn Name |
|---|---|---|
| Button | Actions, triggers | `button` |
| Card | Content containers | `card` |
| Input | Text inputs | `input` |
| Select | Dropdown selects | `select` |
| Tabs | Tab navigation | `tabs` |
| Badge | Status labels | `badge` |
| Table | Data tables | `table` |
| Dialog | Modals | `dialog` |
| Sheet | Side panels / bottom sheets | `sheet` |
| Tooltip | Hover hints | `tooltip` |
| Separator | Visual dividers | `separator` |
| DropdownMenu | Action menus | `dropdown-menu` |
| Skeleton | Loading states | `skeleton` |

### Theme System

shadcn-svelte uses CSS custom properties with HSL values:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 142.1 76.2% 36.3%;
  /* ... */
}
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

### Usage Example

```svelte
<script>
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import * as Tabs from '$lib/components/ui/tabs';
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Match Prediction</Card.Title>
  </Card.Header>
  <Card.Content>
    <Tabs.Root value="home">
      <Tabs.List>
        <Tabs.Trigger value="home">Home</Tabs.Trigger>
        <Tabs.Trigger value="draw">Draw</Tabs.Trigger>
        <Tabs.Trigger value="away">Away</Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
  </Card.Content>
  <Card.Footer>
    <Button>Place Bet</Button>
  </Card.Footer>
</Card.Root>
```

---

## layerchart

### What It Is

Svelte chart library built on D3. Provides Area, Bar, Line, Pie, Sparkline, and more with built-in tooltips, legends, and animations.

### Installation

```bash
pnpm add layerchart
```

### Dependencies

- D3 (bundled)
- Svelte 5 compatible
- Uses Svelte 5 runes internally

### Key Components

| Component | Use Case |
|---|---|
| `AreaChart` | Equity curves, xG timelines, odds trends |
| `BarChart` | P&L by league, win rate by model, edge distribution |
| `LineChart` | Odds movement over time, bankroll tracking |
| `PieChart` | Bet type distribution, model performance |
| `Sparkline` | Inline odds movement in cards/tables |
| `DonutChart` | Bankroll allocation |

### Usage Example

```svelte
<script>
  import { AreaChart, Series, Tooltip } from 'layerchart';

  const data = [
    { date: 'Jan', value: 1000 },
    { date: 'Feb', value: 1150 },
    { date: 'Mar', value: 1080 },
    // ...
  ];
</script>

<AreaChart {data} x="date" y="value">
  <Series type="area" color="var(--primary)" />
  <Tooltip />
</AreaChart>
```

### Key Features

- Built-in `Tooltip` with `ChartContext`
- `Spline` for smooth curves
- `Bars` for bar charts
- `Area` with gradient fill
- Theme-able via CSS custom properties
- Svelte 5 compatible (uses runes)

---

## Football Color Reference

### FIFA World Cup 2026 (USA/Canada/Mexico)

- **Red:** #ee3344
- **Green:** #a9b062
- **Brown:** #8d7d68

### UEFA Euro 2024 (Germany)

- **Blue:** #004f9f
- **Green:** #00ab54

### Usage in Theme

These colors work as accent colors for football-specific elements:

- Live match indicators: green pulse
- Team colors: red/blue for home/away
- Pitch elements: green dividers
- Gold: premium/value bets

---

## Tailwind CSS v4 Setup

### Current Setup (SvelteKit)

```bash
# Already installed via @tailwindcss/vite
pnpm add tailwindcss @tailwindcss/vite @tailwindcss/typography
```

### shadcn-svelte Setup

shadcn-svelte may want its own Tailwind config. The plan is:

1. Keep `@tailwindcss/vite` plugin
2. Merge shadcn's `tailwind.config.ts` with existing
3. Ensure `darkMode: 'class'` is preserved
4. Add shadcn's CSS variables to `app.css`

---

## References

- shadcn-svelte: https://next.shadcn-svelte.com/
- layerchart: https://layerchart.com/
- Bits UI: https://next.bits-ui.com/
- Tailwind CSS v4: https://tailwindcss.com/docs/v4-beta
