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

    const cornell = page.getByRole("link", { name: "Cornell Tech" });
    await expect(cornell).toBeVisible();
    await expect(cornell).toHaveAttribute("href", /tech\.cornell\.edu/);
    await expect(page.getByRole("link", { name: "AugmentED" })).toHaveAttribute(
      "href",
      /augmentedcornell/
    );
    await expect(
      page.getByRole("link", { name: /Dakka.?s Bakery/i })
    ).toHaveAttribute("href", /instagram\.com/);

    const portrait = page.getByRole("img", { name: /Portrait of Parthit Patel/i });
    await expect(portrait).toBeVisible();
    const box = await portrait.boundingBox();
    expect(box).toBeTruthy();
    expect(Math.abs((box?.width ?? 0) - (box?.height ?? 0))).toBeLessThan(8);
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
