import { test, expect } from '@playwright/test'

const ts = Date.now()
const email = `predict-e2e-${ts}@example.com`
const password = 'password123'
const name = 'Prediction Tester'

async function signup(page: any) {
  await page.goto('/signup')
  await page.locator('input[autocomplete="name"]').fill(name)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await Promise.all([
    page.waitForURL((u: URL) => !u.pathname.startsWith('/signup'), { timeout: 30_000 }),
    page.getByRole('button', { name: /create account/i }).click(),
  ])
}

test.describe('Prediction target mode validation', () => {
  test('predictions for future matches target unplayed games', async ({ page }) => {
    await signup(page)

    // Navigate to the current prediction workflow
    await page.goto('/predict?tab=prediction', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1, .display-title')).toContainText(/predict/i)

    // The current workflow defaults to future, unplayed fixtures.
    await expect(page.getByRole('heading', { name: /select league/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /load historical data/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /select future matches/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /run predictions/i })).toBeVisible()

    const upcomingOnly = page.getByRole('checkbox', { name: /upcoming matches only/i })
    await expect(upcomingOnly).toBeChecked()

    // Exercise the future-match targeting toggle and confirm it returns to the default.
    await upcomingOnly.uncheck()
    await expect(upcomingOnly).not.toBeChecked()
    await upcomingOnly.check()
    await expect(upcomingOnly).toBeChecked()

    // Without a selected league/history load, the workflow should prevent fetching matches.
    await expect(page.getByRole('button', { name: /load history/i })).toBeDisabled()
    await expect(page.getByRole('button', { name: /load matches/i })).toBeDisabled()
  })
})
