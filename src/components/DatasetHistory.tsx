import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '#/lib/query'
import { Card, Spinner } from '#/components/ui'
import {
  listScrapedDatasets,
  getScrapedDataset,
  deleteScrapedDataset,
  type DatasetListItem,
} from '#/lib/client-actions/datasets'

const SOURCE_COLORS: Record<string, string> = {
  OddsHarvester: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  ESPN: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  FBref: 'bg-green-500/15 text-green-700 dark:text-green-300',
  Sofascore: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  Understat: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  ClubElo: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  MatchHistory: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  SoFIFA: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  WhoScored: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
}

const SOURCE_ICONS: Record<string, string> = {
  OddsHarvester: '🕷',
  ESPN: '📺',
  FBref: '📊',
  Sofascore: '🏆',
  Understat: '📈',
  ClubElo: '📉',
  MatchHistory: '📜',
  SoFIFA: '🎮',
  WhoScored: '⚽',
}

export function DatasetHistory() {
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = React.useState<number | null>(null)
  const [sourceFilter, setSourceFilter] = React.useState<string | null>(null)

  const listQ = useQuery({
    queryKey: ['scraped-datasets', sourceFilter],
    queryFn: () =>
      listScrapedDatasets({
        data: { source: sourceFilter ?? undefined, limit: 100 },
      }),
  })

  const detailQ = useQuery({
    queryKey: ['scraped-dataset-detail', expandedId],
    queryFn: () =>
      expandedId != null
        ? getScrapedDataset({ data: { id: expandedId } })
        : null,
    enabled: expandedId != null,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteScrapedDataset({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraped-datasets'] })
      setExpandedId(null)
    },
  })

  const datasets: DatasetListItem[] = listQ.data ?? []

  // Get unique sources for filter chips
  const sources = React.useMemo(() => {
    const s = new Set(datasets.map((d) => d.source))
    return Array.from(s).sort()
  }, [datasets])

  if (listQ.isLoading) {
    return (
      <Card className="flex items-center justify-center py-12">
        <Spinner className="h-5 w-5" />
      </Card>
    )
  }

  if (datasets.length === 0) {
    return (
      <Card className="py-12 text-center text-sm text-[var(--sea-ink-soft)]">
        No scraped datasets saved yet. Go to the Scrape tab to collect data.
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Source filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSourceFilter(null)}
          className={
            sourceFilter === null
              ? 'rounded-full border border-[var(--lagoon-deep)] bg-[var(--lagoon)]/20 px-3 py-1 text-xs font-semibold text-[var(--lagoon-deep)]'
              : 'rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)] transition'
          }
        >
          All ({datasets.length})
        </button>
        {sources.map((src) => (
          <button
            key={src}
            type="button"
            onClick={() => setSourceFilter(src === sourceFilter ? null : src)}
            className={
              sourceFilter === src
                ? 'rounded-full border border-[var(--lagoon-deep)] bg-[var(--lagoon)]/20 px-3 py-1 text-xs font-semibold text-[var(--lagoon-deep)]'
                : 'rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)] transition'
            }
          >
            {SOURCE_ICONS[src] ?? '📋'} {src} (
            {datasets.filter((d) => d.source === src).length})
          </button>
        ))}
      </div>

      {/* Dataset list */}
      <div className="space-y-2">
        {datasets
          .filter((d) => !sourceFilter || d.source === sourceFilter)
          .map((ds) => (
            <Card
              key={ds.id}
              className="cursor-pointer transition hover:ring-1 hover:ring-[var(--lagoon)]/30"
              onClick={() => setExpandedId(expandedId === ds.id ? null : ds.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      SOURCE_COLORS[ds.source] ??
                      'bg-gray-500/15 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {SOURCE_ICONS[ds.source] ?? '📋'} {ds.source}
                  </span>
                  <span className="text-sm font-medium text-[var(--sea-ink)] truncate">
                    {ds.operation}
                    {ds.statType ? ` (${ds.statType})` : ''}
                  </span>
                  {ds.league && (
                    <span className="text-xs text-[var(--sea-ink-soft)] truncate">
                      {ds.league}
                    </span>
                  )}
                  {ds.season && (
                    <span className="rounded bg-[var(--surface-strong)] px-1.5 py-0.5 text-[10px] text-[var(--sea-ink-soft)]">
                      {ds.season}
                    </span>
                  )}
                  {ds.sport && (
                    <span className="rounded bg-[var(--surface-strong)] px-1.5 py-0.5 text-[10px] text-[var(--sea-ink-soft)]">
                      {ds.sport}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="rounded-full bg-[var(--lagoon)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--lagoon-deep)]">
                    {ds.rowCount} rows
                  </span>
                  <span className="text-[10px] text-[var(--sea-ink-soft)] whitespace-nowrap">
                    {formatRelative(ds.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Delete this dataset?')) deleteMut.mutate(ds.id)
                    }}
                    className="rounded p-1 text-[var(--sea-ink-soft)] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 transition"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Expanded detail view */}
              {expandedId === ds.id && (
                <div className="mt-3 border-t border-[var(--line)] pt-3">
                  {detailQ.isLoading ? (
                    <div className="flex items-center gap-2 py-4">
                      <Spinner className="h-4 w-4" /> Loading data…
                    </div>
                  ) : detailQ.data ? (
                    <DatasetDetail
                      source={(detailQ.data as { source: string }).source}
                      rows={(detailQ.data as { data: Record<string, unknown>[] }).data}
                      summary={(detailQ.data as { summary: Record<string, unknown> | null }).summary}
                    />
                  ) : (
                    <p className="text-xs text-[var(--sea-ink-soft)]">
                      Failed to load dataset
                    </p>
                  )}
                </div>
              )}
            </Card>
          ))}
      </div>
    </div>
  )
}

function DatasetDetail({
  source,
  rows,
  summary,
}: {
  source: string
  rows: Record<string, unknown>[]
  summary: Record<string, unknown> | null
}) {
  if (!rows || rows.length === 0)
    return (
      <p className="text-xs text-[var(--sea-ink-soft)]">No rows in dataset</p>
    )

  const columns = Object.keys(rows[0])

  return (
    <div className="space-y-2">
      {summary && (
        <p className="text-xs text-[var(--sea-ink-soft)]">
          {Object.entries(summary)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' · ')}
        </p>
      )}
          {source === 'OddsHarvester' && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--sea-ink-soft)]">
          <span>
            This dataset stores summary rows only. Bookmaker odds are available in the detailed matches view.
          </span>
          <a href={`/data?tab=history`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 rounded-lg bg-[var(--lagoon)]/10 px-2.5 py-1 font-semibold text-[var(--lagoon-deep)] hover:bg-[var(--lagoon)]/20"
          >
            View detailed odds
          </a>
        </div>
      )}
      <div className="max-h-[400px] overflow-y-auto overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--sand)]">
        <table className="min-w-[640px] w-full text-xs sm:min-w-0">
          <thead className="sticky top-0 bg-[var(--sand)] z-10">
            <tr className="border-b border-[var(--line)]">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-2 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)] whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((row, j) => (
              <tr
                key={j}
                className={`border-b border-[var(--line)]/50 ${j % 2 === 0 ? '' : 'bg-[var(--surface)]/50'}`}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-2 py-1 text-[var(--sea-ink)] whitespace-nowrap"
                  >
                    {row[col] == null ? '—' : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 200 && (
          <p className="px-3 py-2 text-[10px] font-medium text-[var(--lagoon-deep)] bg-[var(--lagoon)]/10">
            Showing 200 of {rows.length} rows
          </p>
        )}
      </div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}
