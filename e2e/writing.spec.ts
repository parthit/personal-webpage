import { expect, test } from "@playwright/test";
import {
  BTREE_POST,
  DEMO_POST,
  expectActiveNav,
  expectImageLoaded,
  expectNav,
} from "./helpers";

test.describe("writing section", () => {
  test("lists the demo post with metadata", async ({ page }) => {
    await page.goto("/writing");
    await expectNav(page);
    await expectActiveNav(page, "writing");

    await expect(page.getByRole("heading", { name: "Writing" })).toBeVisible();
    await expect(page.getByRole("link", { name: DEMO_POST.title })).toBeVisible();
    await expect(
      page.getByText(/sample system-design post that shows how MDX/i)
    ).toBeVisible();
    await expect(page.getByText("system-design").first()).toBeVisible();
    await expect(page.getByText("demo").first()).toBeVisible();
    await expect(page.getByText(/Jan 15, 2025/i)).toBeVisible();
  });

  test("renders the MDX post with cover, diagram, and YouTube embed", async ({
    page,
  }) => {
    await page.goto(DEMO_POST.path);

    await expect(
      page.getByRole("heading", { name: DEMO_POST.title })
    ).toBeVisible();
    await expect(page.getByText(/January 15, 2025/i)).toBeVisible();
    await expect(page.getByText(/min read/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "High-level design" })
    ).toBeVisible();

    const cover = page.locator(
      'img[src="/content/images/writing/demo-url-shortener/cover.svg"]'
    );
    const diagram = page.locator(
      'img[src="/content/images/writing/demo-url-shortener/diagram.svg"]'
    );
    await expectImageLoaded(cover);
    await expectImageLoaded(diagram);

    const youtube = page.locator(
      'iframe[src*="youtube-nocookie.com/embed/ZgdS0EUmn70"]'
    );
    await expect(youtube).toBeVisible();
    await expect(youtube).toHaveAttribute(
      "title",
      /Intro to Architecture and Systems Design Interviews/i
    );
  });

  test("returns a useful not-found page for unknown slugs", async ({ page }) => {
    const response = await page.goto("/writing/this-post-does-not-exist");
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole("heading", { name: "Post not found" })
    ).toBeVisible();
    await page.getByRole("link", { name: "← Back to writing" }).click();
    await expect(page).toHaveURL(/\/writing$/);
  });

  test("lists external posts but 404s their local slug with matching metadata", async ({
    page,
  }) => {
    await page.goto("/writing");
    const externalLink = page.getByRole("link", {
      name: /Demo: External System Design Notes/,
    });
    await expect(externalLink).toHaveAttribute(
      "href",
      "https://example.com/demo-external-system-design"
    );

    const response = await page.goto("/writing/demo-external");
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle(/Post not found/i);
    await expect(
      page.getByRole("heading", { name: "Post not found" })
    ).toBeVisible();
  });

  test("keeps document metadata useful for SEO", async ({ page }) => {
    await page.goto(DEMO_POST.path);
    await expect(page).toHaveTitle(new RegExp(DEMO_POST.title));

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute(
      "content",
      /sample system-design post/i
    );
  });

  test("renders the B-tree post with interactive demos", async ({ page }) => {
    await page.goto("/writing");
    await expect(page.getByRole("link", { name: BTREE_POST.title })).toBeVisible();

    await page.goto(BTREE_POST.path);
    await expect(
      page.getByRole("heading", { name: BTREE_POST.title })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Interactive B-tree" })
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "B-tree visualization" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Insert" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();

    await page.getByPlaceholder("e.g. 15 or 1, 8, 22").fill("99");
    await page.getByRole("button", { name: "Insert" }).click();
    await expect(page.getByText(/Inserted 99/i)).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Interactive index demo" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Use B-tree index" }).click();
    await expect(page.getByText(/Index walk visited/i)).toBeVisible();
  });
});
