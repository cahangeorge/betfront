import { test, expect } from '@playwright/test'

const ts = Date.now()
const email = `e2e-${ts}@example.com`
const password = 'password123'
const name = 'E2E Tester'

test.describe('Auth flow', () => {
  test('signup → home → logout → login', async ({ page, context }) => {
    // Unauthenticated visit → redirected to /login
    await page.goto('/account')
    await expect(page).toHaveURL(/\/login/)

    // Go to signup
    await page.goto('/signup')
    await page.locator('input[autocomplete="name"]').fill(name)
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith('/signup'), { timeout: 10_000 }),
      page.getByRole('button', { name: /create account/i }).click(),
    ])

    // Now logged in — UserMenu shows Sign out button
    await expect(page.getByRole('button', { name: /sign\s*out/i })).toBeVisible()

    // Logout
    await Promise.all([
      page.waitForURL(/\/login/, { timeout: 10_000 }),
      page.getByRole('button', { name: /sign\s*out/i }).click(),
    ])

    // Cookie should be cleared
    const cookies = await context.cookies()
    expect(cookies.find((c) => c.name === 'betfront_session')).toBeUndefined()

    // Login back
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 10_000 }),
      page.getByRole('button', { name: /sign\s*in/i }).click(),
    ])
    await expect(page.getByRole('button', { name: /sign\s*out/i })).toBeVisible()
  })

  test('rejects bad credentials', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill('wrong-password')
    await page.getByRole('button', { name: /sign\s*in/i }).click()
    await expect(page.locator('.text-red-700')).toBeVisible({ timeout: 5_000 })
  })
})
