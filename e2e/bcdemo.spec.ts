import { expect, test } from "@playwright/test";
import { expectNav } from "./helpers";

test.describe("SHA-256 mining demo", () => {
  test("mines a trailing-zero hash and checks a specific nonce", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/bcdemo");
    await expectNav(page);
    await expect(
      page.getByRole("heading", {
        name: "Blockchain Mining Demonstration (SHA-256)",
      })
    ).toBeVisible();

    await page.getByRole("button", { name: "Start Mining" }).click();
    await expect(page.getByRole("button", { name: "Stop Mining" })).toBeVisible();
    await expect(page.getByText(/Found solution! Nonce:/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Start Mining" })).toBeVisible();

    await page.getByLabel("Check hash for a specific nonce").fill("0");
    await page.getByRole("button", { name: "Check Hash" }).click();
    await expect(page.getByText(/Hash for nonce 0:/i)).toBeVisible();

    await page.getByLabel("Check hash for a specific nonce").fill("");
    await page.getByRole("button", { name: "Check Hash" }).click();
    await expect(
      page.getByText(/Enter a whole number nonce/i)
    ).toBeVisible();
  });

  test("stop cancels an in-flight search", async ({ page }) => {
    await page.goto("/bcdemo");
    const difficulty = page.getByRole("slider", { name: "Target trailing zeros" });
    await difficulty.focus();
    await page.keyboard.press("End");
    await expect(difficulty).toHaveAttribute("aria-valuenow", "4");
    await page.getByRole("button", { name: "Start Mining" }).click();
    await expect(page.getByRole("button", { name: "Stop Mining" })).toBeVisible();
    await page.getByRole("button", { name: "Stop Mining" }).click();
    await expect(page.getByRole("button", { name: "Start Mining" })).toBeVisible();
    await expect(page.getByText(/Found solution/i)).toHaveCount(0);
  });
});
