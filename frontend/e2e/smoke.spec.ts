import { expect, test } from "@playwright/test";

test("loads dashboard data and navigates to the problem checklist", async ({ page }) => {
  await page.route("http://localhost:8000/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/summary")) {
      await route.fulfill({
        json: {
          total: 1,
          solved: 1,
          leetcode_solved: 1,
          gfg_solved: 0,
          completion: 100,
          recent_solved: [],
          topics: [{ name: "Arrays", total: 1, solved: 1 }],
        },
      });
      return;
    }
    await route.fulfill({ json: { items: [], count: 1, limit: 100, offset: 0 } });
  });

  await page.goto("/");
  await expect(page.locator(".completion-orbit strong")).toBeVisible();
  await page.getByRole("button", { name: /Problem checklist/ }).click();
  await expect(page.getByRole("heading", { name: "Problem checklist" })).toBeVisible();
});