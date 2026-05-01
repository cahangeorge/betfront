import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const dbPath = path.join(root, 'prisma', 'e2e.db')

export default async function globalSetup() {
  // Wipe any old e2e database for a clean slate per run.
  for (const f of [dbPath, `${dbPath}-journal`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }
  // Push schema with prisma against the e2e DATABASE_URL.
  execSync(
    `pnpm exec prisma db push --schema ${path.join(root, 'prisma', 'schema.prisma')} --accept-data-loss`,
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: 'file:./e2e.db' },
    },
  )
}
