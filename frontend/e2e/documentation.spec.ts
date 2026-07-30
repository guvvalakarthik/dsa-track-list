import { expect, test } from "@playwright/test";
import path from "node:path";

const problem = (
  id: number,
  title: string,
  platform: "leetcode" | "gfg",
  topic: string,
  rating: number | null,
) => ({
  id,
  platform,
  external_id: String(id),
  slug: title.toLowerCase().replaceAll(" ", "-"),
  title,
  url: platform === "leetcode" ? `https://leetcode.com/problems/${title.toLowerCase().replaceAll(" ", "-")}/` : "https://www.geeksforgeeks.org/",
  difficulty: rating && rating > 1750 ? "Hard" : rating && rating > 1350 ? "Medium" : "Easy",
  rating,
  contest: rating ? "weekly-contest" : null,
  question_index: rating ? "C" : null,
  topics: [topic],
  custom_topics: [],
  auto_solved: true,
  manual_override: null,
  solved: true,
  group_solved: true,
  solved_at: "2026-07-30T10:00:00Z",
  source: platform,
  equivalence_key: null,
});

const recent = [
  problem(1, "Minimum Window Substring", "leetcode", "Sliding Window", 2062),
  problem(2, "Serialize and Deserialize Binary Tree", "leetcode", "Trees", 1894),
  problem(3, "Longest Increasing Subsequence", "leetcode", "Dynamic Programming", 1716),
  problem(4, "Merge K Sorted Arrays", "gfg", "Heaps", null),
  problem(5, "Number of Islands", "leetcode", "Graphs", 1383),
];

test("captures the portfolio dashboard", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/summary")) {
      await route.fulfill({
        json: {
          total: 684,
          solved: 327,
          leetcode_solved: 278,
          gfg_solved: 49,
          completion: 47.8,
          recent_solved: recent,
          topics: [
            { name: "Arrays", total: 126, solved: 89 },
            { name: "Dynamic Programming", total: 98, solved: 61 },
            { name: "Trees", total: 86, solved: 54 },
            { name: "Graphs", total: 72, solved: 38 },
            { name: "Binary Search", total: 54, solved: 41 },
            { name: "Sliding Window", total: 38, solved: 29 },
            { name: "Heaps", total: 31, solved: 15 },
          ],
        },
      });
      return;
    }
    await route.fulfill({ json: { items: recent, count: 684, limit: 5000, offset: 0 } });
  });

  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Every accepted solution/ })).toBeVisible();
  await expect(page.locator(".completion-orbit strong")).toHaveText("47.8%");
  await page.screenshot({
    path: path.resolve(process.cwd(), "../docs/images/dashboard.png"),
    fullPage: true,
  });
});