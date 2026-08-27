import { expect, test } from "@playwright/test";
import {
  CURATED_VIDEO,
  DOCUMENT_AI_POST,
  expectActiveNav,
  expectNav,
} from "./helpers";

test.describe("home page", () => {
  test("renders about content and social links", async ({ page }) => {
    await page.goto("/");
    await expectNav(page);
    await expectActiveNav(page, "Home");

    await expect(
      page.getByRole("heading", { name: /Hi, I’m Parthit/i })
    ).toBeVisible();
    await expect(page.getByText(/full-stack engineer at Intuit/i)).toBeVisible();

    await expect(
      page.getByRole("link", { name: "LinkedIn" })
    ).toHaveAttribute("href", /linkedin\.com/);
    await expect(page.getByRole("link", { name: "Email" })).toHaveAttribute(
      "href",
      /^mailto:/
    );
    await expect(
      page.getByRole("link", { name: "X" })
    ).toHaveAttribute("href", /x\.com|twitter\.com/);
  });

  test("surfaces latest writing and video teasers", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Latest writing" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: DOCUMENT_AI_POST.title })).toHaveAttribute(
      "href",
      DOCUMENT_AI_POST.path
    );

    await expect(page.getByRole("heading", { name: "Watch" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: CURATED_VIDEO.title })
    ).toBeVisible();

    await page.getByRole("link", { name: "All writing" }).click();
    await expect(page).toHaveURL(/\/writing$/);
  });
});
