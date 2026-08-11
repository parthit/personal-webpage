import { expect, test } from "@playwright/test";
import {
  BTREE_POST,
  DEMO_VIDEO,
  expectActiveNav,
  expectNav,
} from "./helpers";

test.describe("home page", () => {
  test("renders about content and social links", async ({ page }) => {
    await page.goto("/");
    await expectNav(page);
    await expectActiveNav(page, "home");

    await expect(
      page.getByRole("heading", { name: /hey, I'm Parthit/i })
    ).toBeVisible();
    await expect(page.getByText(/Fullstack Engineer at Intuit/i)).toBeVisible();

    await expect(
      page.getByRole("link", { name: "LinkedIn" })
    ).toHaveAttribute("href", /linkedin\.com/);
    await expect(page.getByRole("link", { name: "Email" })).toHaveAttribute(
      "href",
      /^mailto:/
    );
    await expect(
      page.getByRole("link", { name: "Twitter" })
    ).toHaveAttribute("href", /x\.com|twitter\.com/);
  });

  test("surfaces latest writing and video teasers", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Latest writing" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: BTREE_POST.title })).toHaveAttribute(
      "href",
      BTREE_POST.path
    );

    await expect(page.getByRole("heading", { name: "Watch" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: DEMO_VIDEO.title })
    ).toBeVisible();

    await page.getByRole("link", { name: "All writing" }).click();
    await expect(page).toHaveURL(/\/writing$/);
  });
});
