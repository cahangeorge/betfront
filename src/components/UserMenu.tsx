import * as React from 'react'

export default function UserMenu({ user }: { user: { email: string; name: string | null } }) {
  const [busy, setBusy] = React.useState(false)
  const initial = (user.name?.[0] ?? user.email[0] ?? '?').toUpperCase()

  async function logout() {
    setBusy(true)
    try {
      await fetch('/betfront/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/betfront/login'
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden sm:inline-flex items-center justify-center h-8 w-8 rounded-full bg-[var(--chip-bg)] border border-[var(--chip-line)] text-xs font-semibold text-[var(--sea-ink)]"
        title={user.email}
      >
        {initial}
      </span>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink-soft)] hover:bg-[var(--chip-bg)] hover:text-[var(--sea-ink)] border border-transparent disabled:opacity-50"
      >
        {busy ? '…' : 'Sign out'}
      </button>
    </div>
  )
}
