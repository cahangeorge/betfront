import * as React from 'react'
import { Card, Input, Button } from '#/components/ui'

type Mode = 'login' | 'signup'

export function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const url = mode === 'login' ? '/betfront/api/auth/login' : '/betfront/api/auth/signup'
      const body =
        mode === 'login'
          ? { email, password }
          : { email, password, name: name || undefined }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as any)?.error ?? `Request failed (${res.status})`)
      }
      window.location.href = (next || '/').replace(/^\/(?!betfront)/, '/betfront/')
    } catch (err: any) {
      setError(String(err?.message ?? err))
      setLoading(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'signup' && (
          <div>
            <label className="text-xs font-medium text-[var(--sea-ink-soft)]">Name (optional)</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-[var(--sea-ink-soft)]">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--sea-ink-soft)]">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'signup' ? 8 : 1}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {mode === 'signup' && (
            <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">Minimum 8 characters.</p>
          )}
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>
      </form>
    </Card>
  )
}
