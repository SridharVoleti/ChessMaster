import { test, expect } from '@playwright/test'

const FAST = '?delay=50'

// Fork game 1 ("The Pawn Wedge"): student is White, best move d4→d5.
// a2→a3 is a legal but wrong quiet move in the same position.
const BEST_MOVE  = { from: 'd4', to: 'd5' }
const WRONG_MOVE = { from: 'a2', to: 'a3' }

async function reachPatternMoment(page: import('@playwright/test').Page) {
  await page.goto(`/play/fork${FAST}`)
  await expect(page.getByText(/your turn/i)).toBeVisible({ timeout: 30_000 })
}

async function clickMove(
  page: import('@playwright/test').Page,
  move: { from: string; to: string },
) {
  await page.locator(`[data-square="${move.from}"]`).click()
  await page.locator(`[data-square="${move.to}"]`).click()
}

test.describe('Celebration — correct answer', () => {
  test('correct move fires confetti celebration with badge and self-dismisses', async ({ page }, testInfo) => {
    await reachPatternMoment(page)
    await clickMove(page, BEST_MOVE)

    const celebration = page.getByTestId('celebration')
    await expect(celebration).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.celebration-badge')).toHaveText(/brilliant/i)
    await expect(page.locator('.confetti').first()).toBeAttached()
    await expect(page.getByTestId('feedback-panel')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('celebration.png') })

    // overlay is decorative and must go away on its own
    await expect(celebration).not.toBeVisible({ timeout: 6_000 })
  })

  test('wrong move gets feedback but no celebration', async ({ page }) => {
    await reachPatternMoment(page)
    await clickMove(page, WRONG_MOVE)

    await expect(page.getByTestId('feedback-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('celebration')).not.toBeVisible()
  })
})

test.describe('Home page — animations', () => {
  test('hero has entrance animations and floating chess pieces', async ({ page }, testInfo) => {
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()
    expect(await page.locator('.hero-enter').count()).toBeGreaterThanOrEqual(5)
    expect(await page.locator('.float-piece').count()).toBeGreaterThanOrEqual(3)
    await page.screenshot({ path: testInfo.outputPath('home_hero.png') })
  })

  test('every section reveals after scrolling through the page', async ({ page }, testInfo) => {
    await page.goto('/')
    const reveals = page.locator('.reveal')
    expect(await reveals.count()).toBeGreaterThan(5)

    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 350) {
        window.scrollTo(0, y)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    })
    await page.waitForTimeout(800)

    const total   = await reveals.count()
    const visible = await page.locator('.reveal.reveal-visible').count()
    expect(visible).toBe(total)
    await page.screenshot({ path: testInfo.outputPath('home_full.png'), fullPage: true })
  })
})
