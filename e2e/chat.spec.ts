import { expect, test } from "@playwright/test";
import { expectActiveNav, expectNav } from "./helpers";

test.describe("chat / booking page", () => {
  test("loads the booking page shell with navigation", async ({ page }) => {
    await page.goto("/chat");
    await expectNav(page);
    await expectActiveNav(page, "chat");

    // Cal.com is a third-party embed; assert the host page mounts it without
    // depending on their remote UI remaining pixel-identical.
    await expect(page.locator("div.max-w-2xl")).toBeVisible();
  });
});
