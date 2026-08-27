import { expect, test } from "@playwright/test";
import {
  CURATED_VIDEO,
  DOCUMENT_AI_POST,
  expectActiveNav,
  expectNav,
} from "./helpers";

test.describe("site navigation", () => {
  test("exposes primary nav on every content page", async ({ page }) => {
    for (const path of ["/", "/projects", "/writing", "/videos", "/chat"]) {
      await page.goto(path);
      await expectNav(page);
    }
  });

  test("marks the active nav item for nested writing routes", async ({
    page,
  }) => {
    await page.goto(DOCUMENT_AI_POST.path);
    await expectActiveNav(page, "Writing");
  });

  test("supports a full browsing journey across content sections", async ({
    page,
  }) => {
    await page.goto("/");
    await expectActiveNav(page, "Home");
    await expect(
      page.getByRole("heading", { name: /Hi, I’m Parthit/i })
    ).toBeVisible();

    await page.getByRole("navigation").getByRole("link", { name: "Writing" }).click();
    await expect(page).toHaveURL(/\/writing$/);
    await expectActiveNav(page, "Writing");
    await expect(page.getByRole("heading", { name: "Writing" })).toBeVisible();

    await page.getByRole("link", { name: DOCUMENT_AI_POST.title }).click();
    await expect(page).toHaveURL(new RegExp(`${DOCUMENT_AI_POST.path}$`));
    await expect(
      page.getByRole("heading", { name: DOCUMENT_AI_POST.title })
    ).toBeVisible();

    await page.getByRole("link", { name: "← All writing" }).click();
    await expect(page).toHaveURL(/\/writing$/);

    await page.getByRole("navigation").getByRole("link", { name: "Videos" }).click();
    await expect(page).toHaveURL(/\/videos$/);
    await expectActiveNav(page, "Videos");
    await expect(
      page.getByRole("heading", { name: CURATED_VIDEO.title })
    ).toBeVisible();

    await page.getByRole("navigation").getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL("/");
    await expectActiveNav(page, "Home");
  });
});
