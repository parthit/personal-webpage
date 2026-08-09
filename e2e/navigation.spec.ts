import { expect, test } from "@playwright/test";
import {
  DEMO_POST,
  DEMO_VIDEO,
  expectActiveNav,
  expectNav,
} from "./helpers";

test.describe("site navigation", () => {
  test("exposes primary nav on every content page", async ({ page }) => {
    for (const path of ["/", "/writing", "/videos", "/chat"]) {
      await page.goto(path);
      await expectNav(page);
    }
  });

  test("marks the active nav item for nested writing routes", async ({
    page,
  }) => {
    await page.goto(DEMO_POST.path);
    await expectActiveNav(page, "writing");
  });

  test("supports a full browsing journey across content sections", async ({
    page,
  }) => {
    await page.goto("/");
    await expectActiveNav(page, "home");
    await expect(
      page.getByRole("heading", { name: /hey, I'm Parthit/i })
    ).toBeVisible();

    await page.getByRole("navigation").getByRole("link", { name: "writing" }).click();
    await expect(page).toHaveURL(/\/writing$/);
    await expectActiveNav(page, "writing");
    await expect(page.getByRole("heading", { name: "Writing" })).toBeVisible();

    await page.getByRole("link", { name: DEMO_POST.title }).click();
    await expect(page).toHaveURL(new RegExp(`${DEMO_POST.path}$`));
    await expect(
      page.getByRole("heading", { name: DEMO_POST.title })
    ).toBeVisible();

    await page.getByRole("link", { name: "← All writing" }).click();
    await expect(page).toHaveURL(/\/writing$/);

    await page.getByRole("navigation").getByRole("link", { name: "videos" }).click();
    await expect(page).toHaveURL(/\/videos$/);
    await expectActiveNav(page, "videos");
    await expect(
      page.getByRole("heading", { name: DEMO_VIDEO.title })
    ).toBeVisible();

    await page.getByRole("navigation").getByRole("link", { name: "home" }).click();
    await expect(page).toHaveURL("/");
    await expectActiveNav(page, "home");
  });
});
