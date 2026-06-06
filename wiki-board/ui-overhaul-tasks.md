# UI Overhaul Tasks — shadcn-svelte + layerchart + PWA

**Created:** 2026-06-04
**Status:** ALL COMPLETE

---

## Phase 1: Foundation

| # | Task | Status | Notes |
|---|---|---|---|
| 1.1 | Install shadcn-svelte | DONE | Manual install: bits-ui, clsx, tailwind-merge, class-variance-authority |
| 1.2 | Add core shadcn components | DONE | 13 directories: button, card, input, select, tabs, badge, table, tooltip, dialog, sheet, separator, dropdown-menu, skeleton (60+ files) |
| 1.3 | Replace app.css with shadcn token system | DONE | HSL variables, Tailwind v4 @theme block, @custom-variant dark |
| 1.4 | Add football accent colors to theme | DONE | football-red, football-green, football-blue, football-gold |
| 1.5 | Update Tailwind config | DONE | Merged shadcn config |
| 1.6 | Update app.html | DONE | Removed Oswald, updated title |
| 1.7 | Verify build passes | DONE | ✓ built clean |

---

## Phase 2: Component Migration

| # | Task | Status | Notes |
|---|---|---|---|
| 2.1 | Replace ui/Button.svelte | DONE | Shadcn CVA variants |
| 2.2 | Replace ui/Card.svelte | DONE | Composes CardRoot/Header/Title/Content/Footer |
| 2.3 | Replace ui/Input.svelte | DONE | Wraps shadcn Input |
| 2.4 | Replace ui/Select.svelte | DONE | Native select styled with shadcn |
| 2.5 | Replace ui/Tabs.svelte | DONE | Bits-ui Tabs |
| 2.6 | Replace ui/Badge.svelte | DONE | 4 CVA variants |
| 2.7 | Replace ui/Table.svelte | DONE | Composes shadcn Table parts |
| 2.8 | Rewrite Navbar with DropdownMenu | DONE | lucide icons, shadcn dropdown |
| 2.9 | Rewrite Sidebar with Sheet | DONE | Mobile Sheet, desktop fixed |
| 2.10 | Rewrite BetSlipDrawer | DONE | shadcn Button/Input/Badge/Separator |
| 2.11 | Rewrite CommandPalette | DONE | shadcn Separator |
| 2.12 | Rewrite MatchCard | DONE | shadcn Card |
| 2.13 | Rewrite OddsTable | DONE | shadcn Button for filters |
| 2.14 | Rewrite AuthForm | DONE | shadcn Button + Input |
| 2.15 | Rewrite Loading | DONE | Spinner with theme colors |
| 2.16–2.20 | Rewrite all panels | DONE | AccountPanel, PredictPanel, TicketsPanel, DataPanel, JobsPanel |
| 2.21 | Clean legacy CSS variables | DONE | 156 references removed from 11 route pages |
| 2.22 | Verify build passes | DONE | ✓ built clean |

---

## Phase 3: Charts (layerchart)

| # | Task | Status | Notes |
|---|---|---|---|
| 3.1 | Install layerchart | DONE | layerchart 1.0.13 |
| 3.2 | OddsMovement chart | DONE | Sparkline (LineChart) |
| 3.3 | EquityCurve chart | DONE | AreaChart for bankroll |
| 3.4 | PnLByLeague chart | DONE | BarChart |
| 3.5 | WinRateByModel chart | DONE | BarChart |
| 3.6 | EdgeDistribution chart | DONE | BarChart histogram |
| 3.7 | xGTimeline chart | DONE | AreaChart |
| 3.8 | OddsComparison chart | DONE | BarChart |
| 3.9 | Tooltips on all charts | DONE | layerchart Tooltip |
| 3.10 | Verify build passes | DONE | ✓ built clean |

---

## Phase 4: Layout Overhaul

| # | Task | Status | Notes |
|---|---|---|---|
| 4.1 | Create BottomNav.svelte | DONE | 5-tab mobile nav, glass bg, safe-area |
| 4.2 | Create BetslipFAB.svelte | DONE | Floating action button with count badge |
| 4.3 | Rewrite +layout.svelte | DONE | Responsive CSS grid: 3-col desktop, single-col mobile |
| 4.4 | Sidebar mobile Sheet | DONE | shadcn Sheet left side |
| 4.5 | BetSlipDrawer responsive | DONE | Desktop right panel, mobile bottom sheet |
| 4.6–4.8 | Verify build | DONE | ✓ built clean |

---

## Phase 5: Light/Dark Toggle

| # | Task | Status | Notes |
|---|---|---|---|
| 5.1 | Create ThemeToggle.svelte | DONE | Sun/Moon icons, bits-ui |
| 5.2 | localStorage persistence | DONE | Theme saved on toggle |
| 5.3 | System preference detection | DONE | prefers-color-scheme fallback |
| 5.4 | Light mode support | DONE | Full light theme tokens in app.css |
| 5.5 | ThemeToggle in Navbar + Sidebar | DONE | Both locations |
| 5.6 | Flash prevention | DONE | Inline script in app.html |
| 5.7 | Verify build | DONE | ✓ built clean |

---

## Phase 6: Polish

| # | Task | Status | Notes |
|---|---|---|---|
| 6.1 | Page transitions | DONE | transition:fade on 5+ pages |
| 6.2 | Card hover effects | DONE | motion-safe scale + shadow |
| 6.3 | Loading skeletons | DONE | MatchCardSkeleton component |
| 6.4 | Tab content transitions | DONE | Tabs fade transition |
| 6.5 | PWA manifest updated | DONE | theme-color #060B14 |
| 6.6 | PWA meta tags | DONE | apple-mobile-web-app-capable, viewport-fit=cover |
| 6.7 | Skip-to-content link | DONE | sr-only-focusable |
| 6.8 | ARIA labels | DONE | 13 aria-labels across 7 files |
| 6.9 | Focus indicators | DONE | focus-visible:ring-2 ring-ring |
| 6.10 | Reduced motion | DONE | prefers-reduced-motion: reduce |
| 6.11 | Landmark roles | DONE | role=main, role=complementary |
| 6.12 | Verify build | DONE | ✓ built clean |

---

## Summary

| Phase | Tasks | Status |
|---|---|---|
| 1. Foundation | 7 | ALL DONE |
| 2. Component Migration | 22 | ALL DONE |
| 3. Charts | 10 | ALL DONE |
| 4. Layout | 8 | ALL DONE |
| 5. Light/Dark | 7 | ALL DONE |
| 6. Polish | 12 | ALL DONE |
| **Total** | **66** | **ALL DONE** |

Container rebuilt and verified: Frontend (200), Backend (200), PostgreSQL (accepting), Redis (PONG).
