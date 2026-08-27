import { expect, test } from "@playwright/test";
import {
  CURATED_VIDEO,
  expectActiveNav,
  expectImageLoaded,
  expectNav,
} from "./helpers";

test.describe("videos section", () => {
  test("shows the featured recommended video with facade controls", async ({
    page,
  }) => {
    await page.goto("/videos");
    await expectNav(page);
    await expectActiveNav(page, "Videos");

    await expect(page.getByRole("heading", { name: "Videos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Featured" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: CURATED_VIDEO.title })
    ).toBeVisible();
    await expect(
      page.getByText(/Jackson Gabbard explains/i)
    ).toBeVisible();

    const playButton = page.getByRole("button", {
      name: new RegExp(`Play video: ${CURATED_VIDEO.title}`, "i"),
    });
    await expect(playButton).toBeVisible();

    const thumbnail = playButton.locator("img");
    await expectImageLoaded(thumbnail);
    await expect(thumbnail).toHaveAttribute(
      "src",
      "/content/images/videos/architecture-system-design-interviews/thumbnail.svg"
    );
  });

  test("loads the YouTube iframe after clicking the facade", async ({
    page,
  }) => {
    await page.goto("/videos");

    const playButton = page.getByRole("button", {
      name: new RegExp(`Play video: ${CURATED_VIDEO.title}`, "i"),
    });
    await playButton.click();

    const iframe = page.locator(
      `iframe[src*="youtube-nocookie.com/embed/${CURATED_VIDEO.youtubeId}"]`
    );
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute("title", CURATED_VIDEO.title);
    await expect(playButton).toHaveCount(0);
  });

  test("links the video title out to YouTube", async ({ page }) => {
    await page.goto("/videos");

    const titleLink = page.getByRole("link", { name: CURATED_VIDEO.title });
    await expect(titleLink).toHaveAttribute(
      "href",
      `https://www.youtube.com/watch?v=${CURATED_VIDEO.youtubeId}`
    );
    await expect(titleLink).toHaveAttribute("target", "_blank");
    await expect(titleLink).toHaveAttribute("rel", /noopener/);
  });
});
