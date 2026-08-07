import { test, expect } from "@playwright/test";

test.describe("ChessQuest smoke", () => {
  test("homepage returns HTTP 200", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
  });

  test("homepage contains ChessQuest heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /chessquest/i })).toBeVisible();
  });
});
