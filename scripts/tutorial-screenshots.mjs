import { chromium } from '@playwright/test'
import { mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const OUT = path.resolve('docs/tutorial-tickets')
const BASE = 'http://127.0.0.1:3200'
const EMAIL = `tutorial-${Date.now()}@example.com`
const PASSWORD = 'tutorial-pass-123'

const shot = async (page, name) => {
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const el = document.querySelector('astro-dev-toolbar')
    if (el) (el).style.display = 'none'
  })
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log(`📸 ${name}.png`)
}

async function main() {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  // 1 — Signup
  await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' })
  await shot(page, '01-signup-empty')
  await page.locator('input[autocomplete="name"]').fill('Tutorial User')
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await shot(page, '02-signup-filled')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.waitForURL(`${BASE}/`, { waitUntil: 'domcontentloaded' })

  // 2 — Account page (auto-creates Default Paper Bankroll on first /account visit)
  await page.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Default Paper Bankroll', { timeout: 10_000 })
  await shot(page, '03-account-default-bankroll')

  // 3 — Tickets / Generate tab (form view)
  await page.goto(`${BASE}/tickets`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Generate ticket batch', { timeout: 10_000 })
  await page.waitForTimeout(1500)
  await shot(page, '04-tickets-generate-form')

  // 4 — Open Strategy dropdown to show all 8 options
  const strategyTrigger = page
    .locator('button[role="combobox"]')
    .filter({ hasText: /Highest EV|Highest probability|Kelly/i })
    .first()
  if (await strategyTrigger.count()) {
    await strategyTrigger.click()
    // Wait for any Radix Select option to appear in the portal
    await page.waitForSelector('[role="option"]', { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(300)
    await shot(page, '05-tickets-strategy-options')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }

  // 5 — Generate a batch via server script (panel UI has a payload-wrapping bug)
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

  // 6 — Batches tab now populated
  await page.goto(`${BASE}/tickets`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Generate ticket batch', { timeout: 10_000 })
  const batchesTab = page.getByRole('tab', { name: /batches/i }).first()
  await batchesTab.click()
  await page.waitForTimeout(1200)
  await shot(page, '06-tickets-batches-tab')

  // 7 — (Open button currently broken in panel — wraps payload as { data: ... })

  await browser.close()
  console.log(`\nDone — screenshots in ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
