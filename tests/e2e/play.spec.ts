import { test, expect } from '@playwright/test'

// v2 games play >=15 scripted intro plies. `?delay=50` shrinks the
// per-move delay (default 600 ms) so tests reach the pattern moment fast.
const FAST = '?delay=50'

test.describe('Play page — Fork pattern', () => {
  test('page loads and chess board is visible', async ({ page }) => {
    await page.goto('/play/fork')
    await expect(page.getByTestId('chess-board')).toBeVisible({ timeout: 10_000 })
  })

  test('page heading includes pattern name', async ({ page }) => {
    await page.goto('/play/fork')
    await expect(page.getByRole('heading', { name: /fork/i })).toBeVisible()
  })

  test('scripted intro plays out and reaches the pattern moment', async ({ page }) => {
    await page.goto(`/play/fork${FAST}`)
    await expect(page.getByTestId('chess-board')).toBeVisible({ timeout: 10_000 })
    // >=15 scripted plies at 50 ms each, then the student is invited to move
    await expect(page.getByText(/your turn/i)).toBeVisible({ timeout: 30_000 })
  })
})

test.describe('Play page — Main game (game 6)', () => {
  test('main game loads directly via ?game=6', async ({ page }) => {
    await page.goto(`/play/fork${FAST}&game=6`)
    await expect(page.getByRole('heading', { name: /main game/i })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('chess-board')).toBeVisible()
  })

  test('student (white) is invited to move from the start', async ({ page }) => {
    await page.goto(`/play/fork${FAST}&game=6`)
    await expect(page.getByTestId('main-game-status')).toHaveText(/your move/i, { timeout: 10_000 })
  })

  test('no appreciation banner before any move', async ({ page }) => {
    await page.goto(`/play/fork${FAST}&game=6`)
    await expect(page.getByTestId('chess-board')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('appreciation-banner')).not.toBeVisible()
  })
})
