import { expect, test } from "@playwright/test";
import {
  DEMO_VIDEO,
  expectActiveNav,
  expectImageLoaded,
  expectNav,
} from "./helpers";

test.describe("videos section", () => {
  test("shows the featured demo video with facade controls", async ({
    page,
  }) => {
    await page.goto("/videos");
    await expectNav(page);
    await expectActiveNav(page, "videos");

    await expect(page.getByRole("heading", { name: "Videos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Featured" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_VIDEO.title })
    ).toBeVisible();
    await expect(
      page.getByText(/public intro to system-design interview thinking/i)
    ).toBeVisible();

    const playButton = page.getByRole("button", {
      name: new RegExp(`Play video: ${DEMO_VIDEO.title}`, "i"),
    });
    await expect(playButton).toBeVisible();

    const thumbnail = playButton.locator("img");
    await expectImageLoaded(thumbnail);
    await expect(thumbnail).toHaveAttribute(
      "src",
      new RegExp(`i\\.ytimg\\.com/vi/${DEMO_VIDEO.youtubeId}/`)
    );
  });

  test("loads the YouTube iframe after clicking the facade", async ({
    page,
  }) => {
    await page.goto("/videos");

    const playButton = page.getByRole("button", {
      name: new RegExp(`Play video: ${DEMO_VIDEO.title}`, "i"),
    });
    await playButton.click();

    const iframe = page.locator(
      `iframe[src*="youtube-nocookie.com/embed/${DEMO_VIDEO.youtubeId}"]`
    );
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute("title", DEMO_VIDEO.title);
    await expect(playButton).toHaveCount(0);
  });

  test("links the video title out to YouTube", async ({ page }) => {
    await page.goto("/videos");

    const titleLink = page.getByRole("link", { name: DEMO_VIDEO.title });
    await expect(titleLink).toHaveAttribute(
      "href",
      `https://www.youtube.com/watch?v=${DEMO_VIDEO.youtubeId}`
    );
    await expect(titleLink).toHaveAttribute("target", "_blank");
    await expect(titleLink).toHaveAttribute("rel", /noopener/);
  });
});
