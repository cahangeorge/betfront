import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '#/lib/query'
import {
  Card,
  Button,
  Input,
  Select,
  Badge,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '#/components/ui'
import * as jobsApi from '#/lib/client-actions/jobs'

type ScheduledJob = {
  id: number
  name: string
  kind: string
  cron: string
  payload: Record<string, unknown> | null
  isEnabled: boolean
  lastRunAt: string | Date | null
  lastStatus: string | null
  lastError: string | null
  runCount: number
  createdAt: string | Date
}

type SchedulerStatus = {
  started: boolean
  activeTasks: number
  totalJobs: number
  enabledJobs: number
  kinds: { value: string; label: string }[]
}

const CRON_PRESETS = [
  { label: 'Every 15 min', value: '*/15 * * * *' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Every 4h', value: '0 */4 * * *' },
  { label: 'Daily 06:00', value: '0 6 * * *' },
  { label: 'Daily 08:00', value: '0 8 * * *' },
  { label: 'Mon 06:00', value: '0 6 * * 1' },
]

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleString()
}

export function JobsPanel() {
  const qc = useQueryClient()

  const statusQ = useQuery<SchedulerStatus>({
    queryKey: ['jobs', 'status'],
    queryFn: () => jobsApi.getSchedulerStatus(),
  })
  const jobsQ = useQuery<ScheduledJob[]>({
    queryKey: ['jobs', 'list'],
    queryFn: () => jobsApi.listScheduledJobs(),
    refetchInterval: 5000,
  })

  const status = statusQ.data
  const jobs = jobsQ.data ?? []
  const kindOptions = (status?.kinds ?? []).map((k) => ({ value: k.value, label: k.label }))

  const [name, setName] = React.useState('')
  const [kind, setKind] = React.useState('scrape_upcoming')
  const [cronExpr, setCronExpr] = React.useState('0 */4 * * *')
  const [payload, setPayload] = React.useState('{}')
  const [isEnabled, setIsEnabled] = React.useState(true)
  const [createError, setCreateError] = React.useState<string | null>(null)

  const createMut = useMutation({
    mutationFn: async () => {
      let parsedPayload: Record<string, unknown> = {}
      if (payload.trim()) {
        try {
          parsedPayload = JSON.parse(payload)
        } catch {
          throw new Error('Payload must be valid JSON')
        }
      }
      return jobsApi.createScheduledJob({
        name: name.trim(),
        kind,
        cron: cronExpr.trim(),
        payload: parsedPayload,
        isEnabled,
      })
    },
    onSuccess: () => {
      setCreateError(null)
      setName('')
      setPayload('{}')
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (e: any) => setCreateError(String(e?.message ?? e)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => jobsApi.deleteScheduledJob({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  })
  const runMut = useMutation({
    mutationFn: (id: number) => jobsApi.runScheduledJobNow({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  })
  const toggleMut = useMutation({
    mutationFn: ({ id, isEnabled }: { id: number; isEnabled: boolean }) =>
      jobsApi.updateScheduledJob({ id, isEnabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  })

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-3 text-base font-semibold">Scheduler status</div>
        {statusQ.isLoading ? (
          <div className="text-sm text-[var(--sea-ink-soft)]">Loading…</div>
        ) : status ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div>
              <div className="text-xs uppercase text-[var(--sea-ink-soft)]">State</div>
              <div className="mt-1">
                <Badge status={status.started ? 'success' : 'pending'} label={status.started ? 'running' : 'idle'} />
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-[var(--sea-ink-soft)]">Active tasks</div>
              <div className="mt-1 text-lg font-semibold">{status.activeTasks}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-[var(--sea-ink-soft)]">Total jobs</div>
              <div className="mt-1 text-lg font-semibold">{status.totalJobs}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-[var(--sea-ink-soft)]">Enabled</div>
              <div className="mt-1 text-lg font-semibold">{status.enabledJobs}</div>
            </div>
          </div>
        ) : null}
      </Card>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="create">New job</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-base font-semibold">Scheduled jobs</div>
              <div className="text-xs text-[var(--sea-ink-soft)]">
                Auto-refresh every 5s
              </div>
            </div>
            {jobs.length === 0 ? (
              <EmptyState
                title="No scheduled jobs yet"
                description="Create a recurring scrape, prediction, or arbitrage scan from the New job tab."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-[var(--sea-ink-soft)]">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Kind</th>
                      <th className="py-2 pr-3">Cron</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Last run</th>
                      <th className="py-2 pr-3">Runs</th>
                      <th className="py-2 pr-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id} className="border-t border-[var(--line)] align-top">
                        <td className="py-2 pr-3 font-medium">{j.name}</td>
                        <td className="py-2 pr-3">
                          <code className="text-xs">{j.kind}</code>
                        </td>
                        <td className="py-2 pr-3">
                          <code className="text-xs">{j.cron}</code>
                        </td>
                        <td className="py-2 pr-3 space-y-1">
                          <div>
                            <Badge status={j.isEnabled ? 'success' : 'pending'} label={j.isEnabled ? 'enabled' : 'paused'} />
                          </div>
                          {j.lastStatus && (
                            <div>
                              <Badge status={j.lastStatus === 'success' ? 'success' : j.lastStatus === 'failed' ? 'failed' : 'running'} label={j.lastStatus} />
                            </div>
                          )}
                          {j.lastError && (
                            <div className="text-xs text-red-600 max-w-[240px] truncate" title={j.lastError}>
                              {j.lastError}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs text-[var(--sea-ink-soft)]">{formatDate(j.lastRunAt)}</td>
                        <td className="py-2 pr-3">{j.runCount}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => runMut.mutate(j.id)}
                              disabled={runMut.isPending}
                            >
                              Run now
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => toggleMut.mutate({ id: j.id, isEnabled: !j.isEnabled })}
                              disabled={toggleMut.isPending}
                            >
                              {j.isEnabled ? 'Pause' : 'Enable'}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                if (confirm(`Delete job "${j.name}"?`)) deleteMut.mutate(j.id)
                              }}
                              disabled={deleteMut.isPending}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <div className="mb-3 text-base font-semibold">Create scheduled job</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-[var(--sea-ink-soft)]">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Daily upcoming scrape" />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--sea-ink-soft)]">Kind</label>
                <Select value={kind} onValueChange={setKind} options={kindOptions} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[var(--sea-ink-soft)]">Cron expression</label>
                <Input value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} placeholder="0 */4 * * *" />
                <div className="mt-2 flex flex-wrap gap-1">
                  {CRON_PRESETS.map((p) => (
                    <Button key={p.value} size="sm" variant="ghost" onClick={() => setCronExpr(p.value)}>
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[var(--sea-ink-soft)]">Payload (JSON)</label>
                <textarea
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-mono"
                  placeholder='{"league":"Premier League"}'
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="job-enabled"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                />
                <label htmlFor="job-enabled" className="text-sm">
                  Enable immediately
                </label>
              </div>
            </div>
            {createError && <div className="mt-3 text-sm text-red-600">{createError}</div>}
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => createMut.mutate()}
                disabled={!name.trim() || !cronExpr.trim() || createMut.isPending}
              >
                {createMut.isPending ? 'Creating…' : 'Create job'}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
