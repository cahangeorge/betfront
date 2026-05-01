import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '#/lib/query'
import { TrashIcon, ExternalLinkIcon } from '@radix-ui/react-icons'
import { cancelJob, getJobs, deleteJob, deleteJobs, getJobOutput, restartJob } from '#/lib/client-actions/scraper'
import { Badge, Button, Card, Spinner, Tooltip } from '#/components/ui'

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function duration(start: string | Date, end: string | Date | null) {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function ProgressBar({ pct, done, total }: { pct: number | null; done: number; total: number }) {
  const pctDisplay = pct !== null ? pct : 0
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-[10px] text-[var(--sea-ink-soft)]">
        <span>{done}/{total} matches</span>
        <span className="font-semibold">{pct !== null ? `${pct}%` : 'starting…'}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--sand)]">
        <div
          className="h-full rounded-full bg-[var(--lagoon-deep)] transition-all duration-500"
          style={{ width: `${pctDisplay}%` }}
        />
      </div>
    </div>
  )
}

function JobLogPanel({ jobId, isRunning }: { jobId: number; isRunning: boolean }) {
  const logRef = React.useRef<HTMLPreElement>(null)
  const [autoScroll, setAutoScroll] = React.useState(true)

  const { data } = useQuery({
    queryKey: ['job-output', jobId],
    queryFn: () => getJobOutput({ data: jobId }),
    refetchInterval: isRunning ? 2000 : false,
    staleTime: 0,
  })

  // Auto-scroll to bottom when new output arrives, unless user scrolled up
  React.useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [data?.output, autoScroll])

  const handleScroll = () => {
    const el = logRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }

  const lines = (data?.output ?? '').split('\n')

  return (
    <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
          Logs ({lines.length} lines)
        </span>
        {!autoScroll && (
          <button
            type="button"
            onClick={() => {
              setAutoScroll(true)
              if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
            }}
            className="text-[10px] font-semibold text-[var(--lagoon-deep)] hover:underline"
          >
            ↓ Scroll to bottom
          </button>
        )}
      </div>
      <pre
        ref={logRef}
        onScroll={handleScroll}
        className="max-h-72 overflow-y-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-[10px] leading-relaxed text-[var(--sea-ink)]"
      >
        {lines.map((line, i) => {
          const isError = /error|failed|exception|traceback/i.test(line)
          const isSuccess = /successfully|complete|success/i.test(line)
          const isWarn = /warning|warn/i.test(line)
          return (
            <span
              key={i}
              className={
                isError
                  ? 'block text-red-500 dark:text-red-400'
                  : isSuccess
                    ? 'block text-green-600 dark:text-green-400'
                    : isWarn
                      ? 'block text-amber-600 dark:text-amber-400'
                      : 'block'
              }
            >
              {line || ' '}
            </span>
          )
        })}
        {isRunning && (
          <span className="inline-flex items-center gap-1 text-[var(--sea-ink-soft)]">
            <Spinner className="h-2.5 w-2.5" />
            <span>running…</span>
          </span>
        )}
      </pre>
    </div>
  )
}

export function JobsList({ source }: { source?: string } = {}) {
  const qc = useQueryClient()
  const [expandedLogs, setExpandedLogs] = React.useState<Set<number>>(new Set())
  const [selected, setSelected] = React.useState<Set<number>>(new Set())

  const { data: jobs, isLoading, refetch } = useQuery({
    queryKey: ['jobs', source ?? 'all'],
    queryFn: () => getJobs(source ? { data: { source } as any } : undefined),
    refetchInterval: (q) => {
      const rows = q.state.data ?? []
      const hasRunning = rows.some((j: any) => j.status === 'running')
      return hasRunning ? 3000 : false
    },
  })

  const del = useMutation({
    mutationFn: (id: number) => deleteJob({ data: id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  })

  const bulkDel = useMutation({
    mutationFn: (ids: number[]) => deleteJobs({ data: ids }),
    onSuccess: () => {
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  const cancel = useMutation({
    mutationFn: (id: number) => cancelJob({ data: id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  })

  const restart = useMutation({
    mutationFn: (id: number) => restartJob({ data: id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  })

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (!jobs) return
    const nonRunning = jobs.filter((j: any) => j.status !== 'running').map((j: any) => j.id)
    const allSelected = nonRunning.every((id: number) => selected.has(id))
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(nonRunning))
    }
  }

  function toggleLogs(id: number) {
    setExpandedLogs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
        <Spinner className="h-4 w-4" /> Loading jobs…
      </div>
    )
  }

  if (!jobs || jobs.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-sm text-[var(--sea-ink-soft)]">No scrape jobs yet. Run a scrape above!</p>
      </Card>
    )
  }

  const nonRunningIds = (jobs ?? []).filter((j: any) => j.status !== 'running').map((j: any) => j.id)
  const allSelected = nonRunningIds.length > 0 && nonRunningIds.every((id: number) => selected.has(id))
  const someSelected = selected.size > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
            onChange={toggleSelectAll}
            className="h-3.5 w-3.5 cursor-pointer accent-[var(--lagoon-deep)]"
            title="Select all deletable jobs"
          />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
            Recent Jobs ({jobs.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {someSelected && (
            <button
              type="button"
              onClick={() => bulkDel.mutate(Array.from(selected))}
              disabled={bulkDel.isPending}
              className="flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700/50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <TrashIcon className="h-3 w-3" />
              Delete {selected.size}
            </button>
          )}
          <Button variant="ghost" onClick={() => refetch()} className="text-xs">
            ↻ Refresh
          </Button>
        </div>
      </div>

      {jobs.map((job: any) => {
        const isRunning = job.status === 'running'
        const logsOpen = expandedLogs.has(job.id)
        const isSelected = selected.has(job.id)
        return (
          <Card key={job.id} className={`py-3 transition-colors ${isSelected ? 'ring-1 ring-[var(--lagoon-deep)]/40' : ''}`}>
            <div className="flex items-start gap-4">
              <div className="pt-0.5 shrink-0">
                {!isRunning && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(job.id)}
                    className="h-3.5 w-3.5 cursor-pointer accent-[var(--lagoon-deep)]"
                    aria-label={`Select job ${job.id}`}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge status={job.status} />
                  <span className="text-sm font-semibold text-[var(--sea-ink)] capitalize">
                    #{job.id} {job.command}
                  </span>
                  <span className="rounded-full bg-[var(--sand)] px-2 py-0.5 text-xs text-[var(--sea-ink-soft)]">
                    {job.sport}
                  </span>
                  {job.league && (
                    <span className="text-xs text-[var(--sea-ink-soft)]">{job.league}</span>
                  )}
                  {isRunning && job.progress.pct !== null && (
                    <span className="ml-auto rounded-full bg-[var(--lagoon)]/20 px-2 py-0.5 text-xs font-bold text-[var(--lagoon-deep)]">
                      {job.progress.pct}%
                    </span>
                  )}
                </div>
                {job.markets && (
                  <div className="mt-0.5 truncate text-[11px] text-[var(--sea-ink-soft)]" title={job.markets}>
                    [{job.markets}]
                  </div>
                )}
                <div className="mt-1 flex gap-4 text-xs text-[var(--sea-ink-soft)]/70">
                  <span>Started: {formatDate(job.startedAt)}</span>
                  <span>Duration: {duration(job.startedAt, job.finishedAt)}</span>
                  <span>Matches: {job._count.matches}</span>
                </div>
                {isRunning && (
                  <ProgressBar
                    pct={job.progress.pct}
                    done={job.progress.done}
                    total={job.progress.total}
                  />
                )}
                {logsOpen && <JobLogPanel jobId={job.id} isRunning={isRunning} />}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleLogs(job.id)}
                  title={logsOpen ? 'Hide logs' : 'Show logs'}
                  className="rounded-lg p-1.5 text-[10px] font-semibold text-[var(--sea-ink-soft)] hover:bg-[var(--sand)] hover:text-[var(--sea-ink)]"
                >
                  {logsOpen ? '▾ logs' : '▸ logs'}
                </button>
                <Tooltip content="View matches">
                  <a href={`/data?tab=history&jobId=${job.id}`}
                    className="inline-flex items-center rounded-lg p-1.5 text-[var(--sea-ink-soft)] hover:bg-[var(--sand)] hover:text-[var(--sea-ink)]"
                    aria-label={`View matches for job ${job.id}`}
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                  </a>
                </Tooltip>
                {isRunning ? (
                  <Tooltip content="Cancel job">
                    <button
                      onClick={() => cancel.mutate(job.id)}
                      className="rounded-lg border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-700/50 dark:text-amber-300 dark:hover:bg-amber-900/20"
                      aria-label={`Cancel job ${job.id}`}
                    >
                      Cancel
                    </button>
                  </Tooltip>
                ) : (
                  <>
                    <Tooltip content="Re-run job with same parameters">
                      <button
                        onClick={() => restart.mutate(job.id)}
                        disabled={restart.isPending}
                        className="rounded-lg p-1.5 text-[var(--sea-ink-soft)] hover:bg-[var(--sand)] hover:text-[var(--lagoon-deep)] disabled:opacity-50"
                        aria-label={`Re-run job ${job.id}`}
                      >
                        ↺
                      </button>
                    </Tooltip>
                    <Tooltip content="Delete job">
                      <button
                        onClick={() => del.mutate(job.id)}
                        className="rounded-lg p-1.5 text-[var(--sea-ink-soft)] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
                        aria-label={`Delete job ${job.id}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </>
                )}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
