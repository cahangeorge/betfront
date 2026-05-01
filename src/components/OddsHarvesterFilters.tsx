import * as React from 'react'
import { Label, MultiSelect } from '#/components/ui'
import {
  SPORTS,
  periodBadge,
  getAvailableMarketGroups,
  getPeriodCycleOptions,
  type MarketEntry,
  type MarketGroup,
  type MarketPeriod,
} from '#/lib/oddsHarvesterShared'

// ─── Types ────────────────────────────────────────────────────────────────────

type OptionItem = { label: string; value: string }
type OptionGroup = { label: string; options: OptionItem[] }

export type OddsHarvesterFiltersProps = {
  sports: string[]
  onSportsChange: (v: string[]) => void
  countries: string[]
  onCountriesChange: (v: string[]) => void
  countryOptions: OptionItem[]
  leagues: string[]
  onLeaguesChange: (v: string[]) => void
  leagueOptions?: OptionItem[]
  leagueOptionGroups?: OptionGroup[]
  leagueExclusiveValues?: string[]
  marketEntries: MarketEntry[]
  onMarketEntriesChange: (v: MarketEntry[]) => void
  showSports?: boolean
  showCountries?: boolean
  showLeagues?: boolean
  showMarkets?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OddsHarvesterFilters({
  sports,
  onSportsChange,
  countries,
  onCountriesChange,
  countryOptions,
  leagues,
  onLeaguesChange,
  leagueOptions,
  leagueOptionGroups,
  leagueExclusiveValues,
  marketEntries,
  onMarketEntriesChange,
  showSports = true,
  showCountries = true,
  showLeagues = true,
  showMarkets = true,
}: OddsHarvesterFiltersProps) {
  const availableGroups = React.useMemo(() => getAvailableMarketGroups(sports), [sports])
  const periodCycleOptions = React.useMemo(() => getPeriodCycleOptions(sports), [sports])

  // Reset per-market periods when sport changes and a period is no longer valid
  React.useEffect(() => {
    const valid = new Set(periodCycleOptions)
    const updated = marketEntries.map((e) => (valid.has(e.period) ? e : { ...e, period: 'all' }))
    if (updated.some((e, i) => e.period !== marketEntries[i].period)) {
      onMarketEntriesChange(updated)
    }
  }, [periodCycleOptions])

  function toggleMarketEntry(value: string) {
    if (marketEntries.some((e) => e.value === value)) {
      onMarketEntriesChange(marketEntries.filter((e) => e.value !== value))
    } else {
      onMarketEntriesChange([...marketEntries, { value, period: 'all' }])
    }
  }

  function updateGroupValues(group: MarketGroup, newValues: string[]) {
    const groupValueSet = new Set(group.options.map((o) => o.value))
    const newValueSet = new Set(newValues)
    const filtered = marketEntries.filter((e) => !groupValueSet.has(e.value) || newValueSet.has(e.value))
    const added = newValues
      .filter((v) => !marketEntries.some((e) => e.value === v))
      .map((v) => ({ value: v, period: 'all' as MarketPeriod }))
    onMarketEntriesChange([...filtered, ...added])
  }

  function selectAllGroup(group: MarketGroup) {
    const existing = new Set(marketEntries.map((e) => e.value))
    const toAdd = group.options
      .filter((o) => !existing.has(o.value))
      .map((o) => ({ value: o.value, period: 'all' as MarketPeriod }))
    onMarketEntriesChange([...marketEntries, ...toAdd])
  }

  function clearGroup(group: MarketGroup) {
    const groupValues = new Set(group.options.map((o) => o.value))
    onMarketEntriesChange(marketEntries.filter((e) => !groupValues.has(e.value)))
  }

  function cyclePeriod(value: string) {
    onMarketEntriesChange(
      marketEntries.map((e) => {
        if (e.value !== value) return e
        const idx = periodCycleOptions.indexOf(e.period)
        return { ...e, period: periodCycleOptions[(idx + 1) % periodCycleOptions.length] }
      }),
    )
  }

  function setAllPeriods(p: MarketPeriod) {
    onMarketEntriesChange(marketEntries.map((e) => ({ ...e, period: p })))
  }

  return (
    <div className="space-y-4">
      {/* Sport Multi-select */}
      {showSports && (
        <div className="space-y-1">
          <Label>Sports *</Label>
          <MultiSelect
            values={sports}
            onValuesChange={onSportsChange}
            placeholder="Select sports..."
            options={SPORTS}
            testId="oh-sports"
          />
        </div>
      )}

      {/* Country Multi-select */}
      {showCountries && (
        <div className="space-y-1">
          <Label>Countries</Label>
          <MultiSelect
            values={countries}
            onValuesChange={onCountriesChange}
            placeholder="All countries"
            options={countryOptions}
            searchable
            searchPlaceholder="Search countries..."
            maxVisibleLabels={3}
            testId="oh-countries"
          />
        </div>
      )}

      {/* League Multi-select (grouped by country) */}
      {showLeagues && (
        <div className="space-y-1">
          <Label>Leagues</Label>
          <MultiSelect
            values={leagues}
            onValuesChange={onLeaguesChange}
            placeholder="All leagues"
            options={leagueOptions ?? []}
            optionGroups={leagueOptionGroups}
            exclusiveValues={leagueExclusiveValues}
            searchable
            searchPlaceholder="Search leagues..."
            maxVisibleLabels={3}
            testId="oh-leagues"
          />
        </div>
      )}

      {/* Markets */}
      {showMarkets && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="flex-1">Markets</Label>
            {marketEntries.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[var(--sea-ink-soft)]">All:</span>
                {periodCycleOptions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAllPeriods(p)}
                    className="rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)]"
                  >
                    {periodBadge(p)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {availableGroups.map((group) => (
            <div key={group.category}>
              {group.display === 'pills' ? (
                <div className="flex flex-wrap gap-2">
                  {group.options.map((m) => {
                    const entry = marketEntries.find((e) => e.value === m.value)
                    const isActive = !!entry
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => toggleMarketEntry(m.value)}
                        className={
                          isActive
                            ? 'flex items-center gap-1 rounded-full border border-[var(--lagoon-deep)] bg-[var(--lagoon)]/20 px-3 py-1 text-xs font-semibold text-[var(--lagoon-deep)]'
                            : 'rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)]'
                        }
                      >
                        {m.label}
                        {isActive && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation()
                              cyclePeriod(m.value)
                            }}
                            className="rounded bg-[var(--lagoon-deep)]/20 px-1 text-[10px] font-bold hover:bg-[var(--lagoon-deep)]/40"
                          >
                            {periodBadge(entry!.period)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-xs font-medium text-[var(--sea-ink-soft)]">{group.category}</span>
                    <button
                      type="button"
                      onClick={() => selectAllGroup(group)}
                      className="rounded border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)]"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => clearGroup(group)}
                      className="rounded border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)]"
                    >
                      Clear
                    </button>
                  </div>
                  <MultiSelect
                    values={marketEntries.filter((e) => group.options.some((o) => o.value === e.value)).map((e) => e.value)}
                    onValuesChange={(newValues) => updateGroupValues(group, newValues)}
                    options={group.options}
                    placeholder={`Select ${group.category}...`}
                    searchable
                    searchPlaceholder={`Search ${group.category.toLowerCase()}...`}
                    maxVisibleLabels={5}
                  />
                  {marketEntries.filter((e) => group.options.some((o) => o.value === e.value)).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {marketEntries
                        .filter((e) => group.options.some((o) => o.value === e.value))
                        .map((entry) => {
                          const opt = group.options.find((o) => o.value === entry.value)!
                          return (
                            <div
                              key={entry.value}
                              className="flex items-center gap-1 rounded-full border border-[var(--lagoon)]/40 bg-[var(--lagoon)]/10 py-0.5 pl-2 pr-1 text-xs text-[var(--lagoon-deep)]"
                            >
                              <span>{opt.label}</span>
                              <button
                                type="button"
                                onClick={() => cyclePeriod(entry.value)}
                                className="rounded bg-[var(--lagoon-deep)]/20 px-1 text-[10px] font-bold hover:bg-[var(--lagoon-deep)]/40"
                              >
                                {periodBadge(entry.period)}
                              </button>
                              <button
                                type="button"
                                onClick={() => updateGroupValues(group, marketEntries.filter((e) => group.options.some((o) => o.value === e.value) && e.value !== entry.value).map((e) => e.value))}
                                className="ml-0.5 rounded px-0.5 text-[10px] text-[var(--lagoon-deep)]/60 hover:text-[var(--lagoon-deep)]"
                              >
                                ×
                              </button>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
