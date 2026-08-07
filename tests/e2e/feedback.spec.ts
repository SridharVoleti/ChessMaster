import { test, expect } from '@playwright/test'

const FAST = '?delay=50'

test.describe('FeedbackPanel — fork game', () => {
  test('feedback panel is not visible before the pattern moment', async ({ page }) => {
    await page.goto(`/play/fork${FAST}`)
    // Panel must not be rendered while scripted moves are playing
    await expect(page.getByTestId('feedback-panel')).not.toBeVisible()
  })

  test('feedback panel is absent until a move is made', async ({ page }) => {
    await page.goto(`/play/fork${FAST}`)
    // Wait for pattern moment (>=15 fast scripted plies)
    await expect(page.getByText(/your turn/i)).toBeVisible({ timeout: 30_000 })
    // No feedback yet
    await expect(page.getByTestId('feedback-panel')).not.toBeVisible()
  })

  test('play-again button is absent during pattern moment', async ({ page }) => {
    await page.goto(`/play/fork${FAST}`)
    await expect(page.getByText(/your turn/i)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: /play again/i })).not.toBeVisible()
  })
})
