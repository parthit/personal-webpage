import { expect, test } from "@playwright/test";
import {
  BTREE_POST,
  DEMO_POST,
  REPLICATION_POST,
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

    // SVG covers are fine in-page but not for social previews.
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute("content", /parthit\.jpeg/i);
    await expect(ogImage).not.toHaveAttribute("content", /\.svg/i);
  });

  test("renders the B-tree post with interactive demos", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/writing");
    await expect(page.getByRole("link", { name: BTREE_POST.title })).toBeVisible();

    await page.goto(BTREE_POST.path);
    await expect(
      page.getByRole("heading", { name: BTREE_POST.title })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Interactive B-tree" })
    ).toBeVisible();

    const visualizer = page.locator("[data-btree-visualizer]");
    await visualizer.scrollIntoViewIfNeeded();
    await expect(
      visualizer.getByRole("img", { name: "B-tree visualization" })
    ).toBeVisible();
    const insertBtn = visualizer.getByRole("button", { name: "Insert" });
    const searchBtn = visualizer.getByRole("button", { name: "Search" });
    const deleteBtn = visualizer.getByRole("button", { name: "Delete" });
    await expect(insertBtn).toBeVisible();
    await expect(searchBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    await visualizer.getByPlaceholder("e.g. 15 or 1, 8, 22").fill("99");
    await insertBtn.evaluate((el) =>
      el.scrollIntoView({ block: "center", inline: "nearest" })
    );
    await insertBtn.click();
    await expect(visualizer.locator("[data-btree-status]")).toContainText(
      /Insert 99|Descending|Placing 99|Inserted 99/i
    );
    await expect(visualizer.locator("[data-btree-status]")).toContainText(
      /Inserted 99/i,
      { timeout: 50_000 }
    );
    await expect(insertBtn).toBeEnabled({ timeout: 5_000 });

    await visualizer.getByPlaceholder("e.g. 15 or 1, 8, 22").fill("99");
    await searchBtn.evaluate((el) =>
      el.scrollIntoView({ block: "center", inline: "nearest" })
    );
    await searchBtn.click();
    await expect(visualizer.locator("[data-btree-status]")).toContainText(
      /Searching for 99|Visit node|Found 99/i
    );
    await expect(visualizer.locator("[data-btree-status]")).toContainText(
      /Found 99 after visiting/i,
      { timeout: 50_000 }
    );

    await visualizer.getByPlaceholder("e.g. 15 or 1, 8, 22").fill("99");
    await deleteBtn.evaluate((el) =>
      el.scrollIntoView({ block: "center", inline: "nearest" })
    );
    await deleteBtn.click();
    await expect(visualizer.locator("[data-btree-status]")).toContainText(
      /Delete 99|Found 99|Removing 99|Deleted 99/i
    );
    await expect(visualizer.locator("[data-btree-status]")).toContainText(
      /Deleted 99/i,
      { timeout: 50_000 }
    );
    await expect(deleteBtn).toBeEnabled({ timeout: 5_000 });

    await expect(
      page.getByRole("heading", { name: "Interactive index demo" })
    ).toBeVisible();

    const indexDemo = page.locator("[data-btree-index-demo]");
    await indexDemo.scrollIntoViewIfNeeded();
    const scanBtn = indexDemo.getByRole("button", { name: "Table scan" });
    const indexBtn = indexDemo.getByRole("button", { name: "Use B-tree index" });
    await scanBtn.evaluate((el) =>
      el.scrollIntoView({ block: "center", inline: "nearest" })
    );
    await scanBtn.click();
    await expect(indexDemo.locator("[data-index-status]")).toContainText(
      /Table scan|Page |Scan finished/i
    );
    await expect(indexDemo.locator("[data-index-status]")).toContainText(
      /Scan finished/i,
      { timeout: 40_000 }
    );
    await expect(indexDemo.locator("[data-io-count]")).toContainText(/[1-9]/);

    await indexBtn.evaluate((el) =>
      el.scrollIntoView({ block: "center", inline: "nearest" })
    );
    await indexBtn.click();
    await expect(indexDemo.locator("[data-index-status]")).toContainText(
      /B-tree index lookup|Read index node|Fetch heap page|Key absent/i
    );
    await expect(indexDemo.locator("[data-index-status]")).toContainText(
      /heap page|no heap fetch|Total:/i,
      { timeout: 30_000 }
    );
    await expect(indexDemo.locator("[data-io-comparison]")).toContainText(
      /fewer page reads with the B-tree|scan .+ I\/O vs index/i,
      { timeout: 5_000 }
    );

    await expect(
      page.getByRole("heading", { name: "Complexity cheatsheet" })
    ).toBeVisible();
    const cheatsheet = page
      .getByRole("table")
      .filter({ has: page.getByRole("columnheader", { name: "Operation" }) });
    await expect(cheatsheet).toBeVisible();
    await expect(cheatsheet.getByRole("cell", { name: "Search" })).toBeVisible();
    await expect(cheatsheet.getByRole("cell", { name: "Insert" })).toBeVisible();
  });

  test("B-tree demos stay usable on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BTREE_POST.path);

    const visualizer = page.locator("[data-btree-visualizer]");
    await visualizer.scrollIntoViewIfNeeded();
    await expect(visualizer).toBeVisible();
    await expect(visualizer.getByRole("button", { name: "Insert" })).toBeVisible();
    await expect(
      visualizer.getByRole("img", { name: "B-tree visualization" })
    ).toBeVisible();

    const indexDemo = page.locator("[data-btree-index-demo]");
    await indexDemo.scrollIntoViewIfNeeded();
    await expect(indexDemo.getByRole("button", { name: "Table scan" })).toBeVisible();
    await expect(
      indexDemo.getByRole("button", { name: "Use B-tree index" })
    ).toBeVisible();
    await expect(
      indexDemo.getByRole("img", { name: "B-tree index on user id" })
    ).toBeVisible();

    // Controls should not overflow the viewport width.
    const box = await indexDemo.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(390);
  });

  test("renders the replication post with interactive demos", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/writing");
    await expect(
      page.getByRole("link", { name: REPLICATION_POST.title })
    ).toBeVisible();

    await page.goto(REPLICATION_POST.path);
    await expect(
      page.getByRole("heading", { name: REPLICATION_POST.title })
    ).toBeVisible();

    const cover = page.locator(
      'img[src="/content/images/writing/replication/cover.svg"]'
    );
    await expectImageLoaded(cover);

    const leader = page.locator("[data-leader-follower-demo]");
    await leader.scrollIntoViewIfNeeded();
    await expect(
      leader.getByRole("img", { name: "Leader and two follower replicas" })
    ).toBeVisible();
    const writeBtn = leader.getByRole("button", { name: "Write to leader" });
    await writeBtn.evaluate((el) =>
      el.scrollIntoView({ block: "center", inline: "nearest" })
    );
    await writeBtn.click();
    await expect(leader.locator("[data-replication-status]")).toContainText(
      /Client sends SET likes=7|appends the write|acknowledged/i
    );
    await expect(leader.locator("[data-replication-status]")).toContainText(
      /acknowledged/i,
      { timeout: 40_000 }
    );
    await expect(writeBtn).toBeEnabled({ timeout: 5_000 });
    await expect(leader.locator('[data-replica-id="lon"]')).toContainText("0");
    await expect(leader.locator('[data-replica-id="nyc"]')).toContainText("7");

    const readLondon = leader.getByRole("button", { name: "Read London" });
    await expect(readLondon).toBeEnabled();
    await readLondon.click();
    await expect(leader.locator("[data-replication-status]")).toContainText(
      /stale/i,
      { timeout: 30_000 }
    );

    const stale = page.locator("[data-stale-read-demo]");
    await stale.scrollIntoViewIfNeeded();
    const writeThenFollower = stale.getByRole("button", {
      name: "Write, then read London",
    });
    await writeThenFollower.evaluate((el) =>
      el.scrollIntoView({ block: "center", inline: "nearest" })
    );
    await writeThenFollower.click();
    await expect(stale.locator("[data-replication-status]")).toContainText(
      /stale/i,
      { timeout: 50_000 }
    );
    await expect(stale.locator("[data-read-outcome]")).toContainText(/stale/i);

    const multi = page.locator("[data-multi-leader-demo]");
    await multi.scrollIntoViewIfNeeded();
    await multi.getByRole("button", { name: "Partition and write both" }).click();
    await expect(multi.locator("[data-replication-status]")).toContainText(
      /eggs/i,
      { timeout: 40_000 }
    );
    const healBtn = multi.getByRole("button", { name: "Heal and reconcile" });
    await expect(healBtn).toBeEnabled({ timeout: 8_000 });
    await healBtn.click();
    await expect(multi.locator("[data-replication-status]")).toContainText(
      /Last-write-wins|Dropped/i,
      { timeout: 30_000 }
    );

    const quorum = page.locator("[data-quorum-demo]");
    await quorum.scrollIntoViewIfNeeded();
    await expect(quorum.locator("[data-quorum-math]")).toContainText(/W\+R = 4/);
    await expect(quorum.locator("[data-quorum-math]")).toHaveAttribute(
      "data-last-write-w",
      "none"
    );
    await quorum.getByRole("button", { name: "Write" }).click();
    await expect(quorum.locator("[data-replication-status]")).toContainText(
      /Write succeeds/i,
      { timeout: 40_000 }
    );
    const quorumRead = quorum.getByRole("button", { name: "Read" });
    await expect(quorumRead).toBeEnabled({ timeout: 8_000 });
    await expect(quorum.locator("[data-quorum-math]")).toHaveAttribute(
      "data-last-write-w",
      "2"
    );
    await expect(quorum.locator("[data-quorum-math]")).toContainText(
      /Last completed write used W=2/
    );
    await quorumRead.click();
    await expect(quorum.locator("[data-replication-status]")).toContainText(
      /Missed version|stale|disjoint/i,
      { timeout: 30_000 }
    );
  });

  test("replication demos stay usable on a narrow viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(REPLICATION_POST.path);

    const leader = page.locator("[data-leader-follower-demo]");
    await leader.scrollIntoViewIfNeeded();
    await expect(leader).toBeVisible();
    await expect(
      leader.getByRole("button", { name: "Write to leader" })
    ).toBeVisible();
    const leaderBox = await leader.boundingBox();
    expect(leaderBox).not.toBeNull();
    expect(leaderBox!.width).toBeLessThanOrEqual(390);

    const quorum = page.locator("[data-quorum-demo]");
    await quorum.scrollIntoViewIfNeeded();
    await expect(quorum.getByRole("button", { name: "Write" })).toBeVisible();
    await expect(quorum.getByRole("button", { name: "Read" })).toBeVisible();
    const quorumBox = await quorum.boundingBox();
    expect(quorumBox).not.toBeNull();
    expect(quorumBox!.width).toBeLessThanOrEqual(390);
  });
});
