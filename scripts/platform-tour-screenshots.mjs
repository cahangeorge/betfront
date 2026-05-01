// End-to-end platform tour. Captures screenshots of every main page so the
// "How to use the platform" tutorial can embed them.
//
// Prereqs: dev server running on http://127.0.0.1:3200 against tutorial.db
// (see docs/TUTORIAL-platform.md "Reproducing this tutorial" section).

import { chromium } from '@playwright/test'
import { mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const OUT = path.resolve('docs/tutorial-platform')
const BASE = 'http://127.0.0.1:3200'
const EMAIL = `tour-${Date.now()}@example.com`
const PASSWORD = 'tour-pass-123'

const shot = async (page, name, opts = {}) => {
  await page.waitForTimeout(opts.wait ?? 600)
  await page.evaluate(() => {
    const el = document.querySelector('astro-dev-toolbar')
    if (el) el.style.display = 'none'
  })
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: opts.fullPage ?? true })
  console.log(`📸 ${name}.png`)
}

async function main() {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  // 1 — Home (logged out)
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await shot(page, '01-home-logged-out')

  // 2 — Signup
  await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="name"]').fill('Tour User')
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await shot(page, '02-signup')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.waitForURL(`${BASE}/`, { waitUntil: 'domcontentloaded' })

  // 3 — Home (logged in) — same URL but nav now shows account
  await page.waitForTimeout(400)
  await shot(page, '03-home-logged-in')

  // 4 — Account page (auto-creates Default Paper Bankroll)
  await page.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Default Paper Bankroll', { timeout: 10_000 })
  await shot(page, '04-account')

  // 5 — Data page · Scrape tab (default)
  await page.goto(`${BASE}/data?tab=scrape`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await shot(page, '05-data-scrape')

  // 6 — Data page · History tab (browse seeded matches)
  await page.goto(`${BASE}/data?tab=history`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await shot(page, '06-data-history')

  // 7 — Predict page · Pillar tab (default) — shows seeded prediction run
  await page.goto(`${BASE}/predict?tab=pillar`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  await shot(page, '07-predict-pillar')

  // 8 — Tickets · Generate form
  await page.goto(`${BASE}/tickets?tab=pillar`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Generate ticket batch', { timeout: 10_000 })
  await page.waitForTimeout(1200)
  await shot(page, '08-tickets-generate')

  // 9 — Generate batch via server script (panel UI bug — workaround)
  console.log('Generating batch via server script…')
  const r = spawnSync('pnpm', ['exec', 'tsx', 'scripts/seed-tutorial-batch.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'file:./tutorial.db' },
    encoding: 'utf8',
  })
  console.log(r.stdout)
  if (r.status !== 0) {
    console.error(r.stderr)
    throw new Error('seed-tutorial-batch failed')
  }

  // 10 — Tickets · Batches tab
  await page.goto(`${BASE}/tickets?tab=pillar`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Generate ticket batch', { timeout: 10_000 })
  const batchesTab = page.getByRole('tab', { name: /batches/i }).first()
  await batchesTab.click()
  await page.waitForTimeout(1500)
  await shot(page, '09-tickets-batches')

  // 11 — Jobs (scheduler)
  await page.goto(`${BASE}/jobs`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await shot(page, '10-jobs')

  await browser.close()
  console.log(`\nDone — screenshots in ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
