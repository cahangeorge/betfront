import { test, expect } from '@playwright/test'

const ts = Date.now()
const email = `flow-${ts}@example.com`
const password = 'password123'
const name = 'Flow Tester'

async function signup(page: any) {
  await page.goto('/signup')
  await page.locator('input[autocomplete="name"]').fill(name)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await Promise.all([
    page.waitForURL((u: URL) => !u.pathname.startsWith('/signup'), { timeout: 10_000 }),
    page.getByRole('button', { name: /create account/i }).click(),
  ])
}

test.describe('Authenticated user flows', () => {
  test('can navigate scrape → predict → tickets pages', async ({ page }) => {
    await signup(page)

    // scrape page reachable
    await page.goto('/scrape', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1, .display-title')).toContainText(/scrape|harvest/i)

    // predict page reachable + Backtest tab works
    await page.goto('/predict?tab=backtest', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/per-model brier scores/i)).toBeVisible({ timeout: 10_000 })

    // ensemble weights compute (no data yet → uniform fallback message)
    await page.getByRole('button', { name: /^compute$/i }).click()
    await expect(page.getByText(/falling back to uniform|allocation/i).first()).toBeVisible({
      timeout: 10_000,
    })

    // tickets page reachable
    await page.goto('/tickets', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1, .display-title').first()).toBeVisible()

    // jobs page reachable
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1, .display-title').first()).toBeVisible()

    // account page reachable + shows new user email
    await page.goto('/account', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(email).first()).toBeVisible({ timeout: 10_000 })
  })
})
