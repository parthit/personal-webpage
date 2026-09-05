import { expect, test } from "@playwright/test";
import {
  BTREE_POST,
  DOCUMENT_AI_POST,
  ISOLATION_POST,
  REPLICATION_POST,
  VISION_VLM_POST,
  expectActiveNav,
  expectImageLoaded,
  expectNav,
} from "./helpers";

test.describe("writing section", () => {
  test("lists published writing with useful metadata", async ({ page }) => {
    await page.goto("/writing");
    await expectNav(page);
    await expectActiveNav(page, "Writing");

    await expect(page.getByRole("heading", { name: "Writing" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: DOCUMENT_AI_POST.title })
    ).toBeVisible();
    await expect(page.getByText("applied-ai").first()).toBeVisible();
    await expect(page.getByText(/Sep 5, 2026/i)).toBeVisible();
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

  test("keeps document metadata useful for SEO", async ({ page }) => {
    await page.goto(DOCUMENT_AI_POST.path);
    await expect(page).toHaveTitle(new RegExp(DOCUMENT_AI_POST.title));

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute(
      "content",
      /messy document text/i
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
      page.getByRole("heading", { name: "Break one yourself" })
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
    const player = visualizer.locator("[data-animation-player]");
    const timeline = player.getByRole("slider", { name: "Animation step" });

    await visualizer.getByPlaceholder("e.g. 15 or 1, 8, 22").fill("99");
    await insertBtn.evaluate((el) =>
      el.scrollIntoView({ block: "center", inline: "nearest" })
    );
    await insertBtn.click();
    await expect(player).toHaveAttribute("data-playback-status", "playing");
    await timeline.focus();
    await timeline.press("Home");
    await expect(player).toHaveAttribute("data-playback-status", "paused");
    await expect(player).toHaveAttribute("data-playback-index", "0");
    const resumeButton = player.getByRole("button", {
      name: "Play animation",
    });
    await expect(resumeButton).toBeEnabled();
    await resumeButton.click();
    await expect(visualizer.locator("[data-btree-status]")).toContainText(
      /Insert 99|Descending|Placing 99|Inserted 99/i
    );
    await expect(visualizer.locator("[data-btree-status]")).toContainText(
      /Inserted 99/i,
      { timeout: 50_000 }
    );
    await expect(insertBtn).toBeEnabled({ timeout: 5_000 });

    await expect(timeline).toBeVisible();
    await expect(player.locator("[data-animation-history] li")).not.toHaveCount(1);
    const completedIndex = Number(
      (await player.getAttribute("data-playback-index")) ?? "0"
    );
    await timeline.focus();
    await timeline.press("ArrowLeft");
    await expect(player).toHaveAttribute(
      "data-playback-index",
      String(completedIndex - 1)
    );
    await expect(
      player.getByRole("button", { name: "Next step" })
    ).toBeEnabled();
    await timeline.press("End");
    await expect(player).toHaveAttribute(
      "data-playback-index",
      String(completedIndex)
    );
    const historyCount = await player.locator("[data-animation-history] li").count();
    await visualizer.getByPlaceholder("e.g. 15 or 1, 8, 22").fill("");
    await insertBtn.click();
    await expect(visualizer.locator("[data-btree-status]")).toContainText(
      "Enter one or more numbers to insert."
    );
    await expect(player.locator("[data-animation-history] li")).toHaveCount(
      historyCount
    );

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
      page.getByRole("heading", { name: "Watch the page reads" })
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
    const indexPlayer = indexDemo.locator("[data-animation-player]");
    const indexHistoryCount = await indexPlayer
      .locator("[data-animation-history] li")
      .count();
    await indexDemo.getByLabel("Lookup id").fill("not-a-number");
    await scanBtn.click();
    await expect(indexDemo.locator("[data-index-status]")).toContainText(
      "Enter a numeric lookup id."
    );
    await expect(
      indexPlayer.locator("[data-animation-history] li")
    ).toHaveCount(indexHistoryCount);

    await expect(
      page.getByRole("heading", { name: "Costs at a glance" })
    ).toBeVisible();
    const cheatsheet = page
      .getByRole("table")
      .filter({ has: page.getByRole("columnheader", { name: "Operation" }) });
    await expect(cheatsheet).toBeVisible();
    await expect(cheatsheet.getByRole("cell", { name: "Search" })).toBeVisible();
    await expect(cheatsheet.getByRole("cell", { name: "Insert" })).toBeVisible();
  });

  test("timeline offers replay and viewer-controlled pacing", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(REPLICATION_POST.path);

    const demo = page.locator("[data-leader-follower-demo]");
    await demo.scrollIntoViewIfNeeded();
    const player = demo.locator("[data-animation-player]");

    // Nothing has run yet, so the transport stays out of the way.
    await expect(player).toHaveAttribute("data-playback-status", "idle");
    await expect(
      player.getByRole("button", { name: /Play animation/ })
    ).toHaveCount(0);
    await expect(
      player.getByRole("slider", { name: "Animation step" })
    ).toHaveCount(0);
    await expect(player.locator("[data-animation-history]")).toHaveCount(0);
    await expect(player).toContainText(/Run an operation above/i);

    // A faster rate keeps this test honest about the animation still running.
    const speed = player.locator('[data-segmented-control="playback-rate"]');
    await speed.getByRole("radio", { name: "2×", exact: true }).click();
    await expect(player).toHaveAttribute("data-playback-rate", "2");

    const writeBtn = demo.getByRole("button", { name: "Write to leader" });
    await writeBtn.evaluate((el) =>
      el.scrollIntoView({ block: "center", inline: "nearest" })
    );
    await writeBtn.click();
    await expect(player).toHaveAttribute("data-playback-status", "playing");
    await expect(player).toHaveAttribute("data-playback-status", "complete", {
      timeout: 40_000,
    });

    // A finished timeline must not dead-end on a disabled play button.
    await expect(player).toHaveAttribute("data-playback-at-end", "true");
    const replay = player.getByRole("button", { name: "Replay animation" });
    await expect(replay).toBeEnabled();
    await replay.click();
    await expect(player).toHaveAttribute("data-playback-index", "0");
    await expect(player).toHaveAttribute("data-playback-status", "playing");
  });

  test("pausing holds a step where it stopped", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(REPLICATION_POST.path);

    const demo = page.locator("[data-leader-follower-demo]");
    await demo.scrollIntoViewIfNeeded();
    const player = demo.locator("[data-animation-player]");

    const writeBtn = demo.getByRole("button", { name: "Write to leader" });
    await writeBtn.evaluate((el) =>
      el.scrollIntoView({ block: "center", inline: "nearest" })
    );
    await writeBtn.click();
    await expect(player).toHaveAttribute("data-playback-status", "playing");

    // Land somewhere inside a step, not on its boundary.
    await page.waitForTimeout(700);
    await player.getByRole("button", { name: "Pause animation" }).click();
    await expect(player).toHaveAttribute("data-playback-status", "paused");

    const served = Number(await player.getAttribute("data-playback-progress"));
    expect(served).toBeGreaterThan(0);
    expect(served).toBeLessThan(1);

    // The dwell meter holds its position: seeded partway, clock stopped.
    const meter = player.locator("[data-animation-step-progress]");
    const paused = await meter.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { delay: cs.animationDelay, playState: cs.animationPlayState };
    });
    expect(paused.playState).toBe("paused");
    expect(Number.parseFloat(paused.delay)).toBeLessThan(0);

    // Resuming must not rewind the meter or restart the step's full dwell.
    await player.getByRole("button", { name: "Play animation" }).click();
    await expect(player).toHaveAttribute("data-playback-status", "playing");
    await expect(player).toHaveAttribute(
      "data-playback-progress",
      served.toFixed(3)
    );
    const running = await meter.evaluate(
      (el) => getComputedStyle(el).animationPlayState
    );
    expect(running).toBe("running");

    // Scrubbing to a step shows it from the start of its dwell instead.
    await player.getByRole("button", { name: "Previous step" }).click();
    await expect(player).toHaveAttribute("data-playback-progress", "0.000");
  });

  test("a speed change mid-step does not rewind the figures", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(REPLICATION_POST.path);

    const demo = page.locator("[data-leader-follower-demo]");
    await demo.scrollIntoViewIfNeeded();
    const player = demo.locator("[data-animation-player]");
    const speed = player.locator('[data-segmented-control="playback-rate"]');

    // The slowest rate leaves a wide window inside a single step.
    const writeBtn = demo.getByRole("button", { name: "Write to leader" });
    await writeBtn.evaluate((el) =>
      el.scrollIntoView({ block: "center", inline: "nearest" })
    );
    await writeBtn.click();
    await expect(player).toHaveAttribute("data-playback-status", "playing");
    await speed.getByRole("radio", { name: "0.5×", exact: true }).click();
    await page.waitForTimeout(900);

    // Watch every DOM state the dwell meter passes through as the rate changes:
    // publishing the served fraction late would paint one frame back at zero.
    const samples = await player.evaluate(async (root, label) => {
      const readProgress = () => {
        const meter = root.querySelector("[data-animation-step-progress]");
        const timing = meter?.getAnimations()[0]?.effect?.getComputedTiming();
        return typeof timing?.progress === "number" ? timing.progress : null;
      };
      const seen: (number | null)[] = [readProgress()];
      const observer = new MutationObserver(() => seen.push(readProgress()));
      observer.observe(root, {
        subtree: true,
        attributes: true,
        childList: true,
      });
      const option = [...root.querySelectorAll("[data-segmented-option]")].find(
        (el) => el.textContent?.trim() === label
      );
      (option as HTMLElement | undefined)?.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
      observer.disconnect();
      return seen;
    }, "1×");

    await expect(player).toHaveAttribute("data-playback-rate", "1");
    expect(samples.length).toBeGreaterThan(1);
    const start = samples[0];
    expect(start).not.toBeNull();
    expect(start!).toBeGreaterThan(0.1);
    for (const seen of samples.slice(1)) {
      expect(seen, "the meter never restarts mid-step").toBeGreaterThan(
        start! - 0.05
      );
    }
  });

  test("write mode reads as one choice, not two actions", async ({ page }) => {
    await page.goto(REPLICATION_POST.path);

    const demo = page.locator("[data-leader-follower-demo]");
    await demo.scrollIntoViewIfNeeded();
    const control = demo.locator('[data-segmented-control="write-mode"]');
    const async = control.getByRole("radio", {
      name: "Asynchronous",
      exact: true,
    });
    const sync = control.getByRole("radio", {
      name: "Synchronous",
      exact: true,
    });

    await expect(async).toHaveAttribute("aria-checked", "true");
    await expect(sync).toHaveAttribute("aria-checked", "false");
    await expect(control.locator("[data-segmented-hint]")).toContainText(
      /answers the client first/i
    );

    await sync.click();
    await expect(control).toHaveAttribute("data-segmented-value", "synchronous");
    await expect(sync).toHaveAttribute("aria-checked", "true");
    await expect(async).toHaveAttribute("aria-checked", "false");
    await expect(control.locator("[data-segmented-hint]")).toContainText(
      /waits for a follower/i
    );

    // Arrow keys move between options like a native radio group.
    await sync.press("ArrowRight");
    await expect(control).toHaveAttribute(
      "data-segmented-value",
      "asynchronous"
    );
    await expect(async).toBeFocused();
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
    await expect(leader.locator('[data-repl-graph="leader-tree"]')).toBeVisible();
    await expect(
      leader.locator('[data-repl-edge="replication"]')
    ).toHaveCount(2);
    await expect(leader.locator('[data-repl-edge="client"]')).toHaveCount(1);
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
    await expect(multi.locator('[data-repl-graph="multi-leader"]')).toBeVisible();
    await expect(multi.locator('[data-repl-edge="peer"]')).toHaveAttribute(
      "data-repl-edge-broken",
      "false"
    );
    await multi.getByRole("button", { name: "Partition and write both" }).click();
    await expect(multi.locator("[data-replication-status]")).toContainText(
      /eggs/i,
      { timeout: 40_000 }
    );
    await expect(multi.locator('[data-repl-edge="peer"]')).toHaveAttribute(
      "data-repl-edge-broken",
      "true"
    );
    const healBtn = multi.getByRole("button", { name: "Heal and reconcile" });
    await expect(healBtn).toBeEnabled({ timeout: 8_000 });
    await healBtn.click();
    await expect(multi.locator('[data-repl-edge="peer"]')).toHaveAttribute(
      "data-repl-edge-broken",
      "false"
    );
    await expect(multi.locator("[data-replication-status]")).toContainText(
      /Last-write-wins|Dropped|partition heals/i,
      { timeout: 30_000 }
    );

    const quorum = page.locator("[data-quorum-demo]");
    await quorum.scrollIntoViewIfNeeded();
    await expect(quorum.locator('[data-repl-graph="quorum"]')).toBeVisible();
    await expect(quorum.locator('[data-repl-edge="peer"]')).toHaveCount(5);
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
    await expect(
      leader.locator('[data-repl-graph="leader-tree"]')
    ).toBeVisible();
    await expect(leader.locator('[data-repl-edge="replication"]')).toHaveCount(2);

    const quorum = page.locator("[data-quorum-demo]");
    await quorum.scrollIntoViewIfNeeded();
    await expect(quorum.getByRole("button", { name: "Write" })).toBeVisible();
    await expect(quorum.getByRole("button", { name: "Read" })).toBeVisible();
    const quorumBox = await quorum.boundingBox();
    expect(quorumBox).not.toBeNull();
    expect(quorumBox!.width).toBeLessThanOrEqual(390);
    await expect(quorum.locator('[data-repl-graph="quorum"]')).toBeVisible();
    const quorumGraph = quorum.locator('[data-repl-graph="quorum"]');
    const sizes = await quorumGraph.evaluate((el) => ({
      client: el.clientWidth,
      scroll: el.scrollWidth,
    }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(400);
  });

  test("renders Document AI post with field-matching playground", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/writing");
    await expect(
      page.getByRole("link", { name: DOCUMENT_AI_POST.title })
    ).toBeVisible();

    await page.goto(DOCUMENT_AI_POST.path);
    await expect(
      page.getByRole("heading", { name: DOCUMENT_AI_POST.title })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "From a page to a field" })
    ).toBeVisible();

    const cover = page.locator(
      'img[src="/content/images/writing/document-ai-field-matching/cover.svg"]'
    );
    await expectImageLoaded(cover);

    const demo = page.locator("[data-field-matching-demo]");
    await demo.scrollIntoViewIfNeeded();
    await expect(demo.getByRole("button", { name: "Run matcher" })).toBeVisible();
    await demo.getByRole("button", { name: "Run matcher" }).click();
    await expect(demo.locator("[data-field-matching-status]")).toContainText(
      /OCR|threshold|auto|ask/i,
      { timeout: 60_000 }
    );
    await expect(demo.locator("[data-field-matching-status]")).toContainText(
      /Done —/i,
      { timeout: 60_000 }
    );
    await expect(demo.locator('[data-decision="auto"]').first()).toBeVisible();
    const reviewField = demo.locator('[data-field-id="vendor"]');
    await expect(reviewField.locator('[data-decision="review"]')).toBeVisible();
    await expect(demo.locator('[data-ocr-span="s_vendor"]')).toHaveClass(
      /ring-amber-400/
    );
    const player = demo.locator("[data-animation-player]");
    await expect(player.locator("[data-animation-history] li")).not.toHaveCount(1);
  });

  test("renders specialized vision vs VLM post with comparison playground", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(VISION_VLM_POST.path);
    await expect(
      page.getByRole("heading", { name: VISION_VLM_POST.title })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Why the gap gets so large" })
    ).toBeVisible();

    const cover = page.locator(
      'img[src="/content/images/writing/specialized-vision-vs-vlm/cover.svg"]'
    );
    await expectImageLoaded(cover);

    const demo = page.locator("[data-vision-vs-vlm-demo]");
    await demo.scrollIntoViewIfNeeded();
    await expect(demo.getByRole("button", { name: "Run both paths" })).toBeVisible();
    await expect(demo.locator("[data-speedup-callout]")).toContainText(/30×/);
    await demo.getByRole("button", { name: "Run both paths" }).click();
    await expect(demo.locator("[data-vision-compare-status]")).toContainText(
      /forklift|Specialized|VLM|distill/i,
      { timeout: 60_000 }
    );
    await expect(demo.locator("[data-vision-compare-status]")).toContainText(
      /Open vocabulary|specialized detector/i,
      { timeout: 60_000 }
    );
    await expect(
      demo.locator('[data-camera-pane="Specialized detector"] [data-detected="true"]')
    ).toHaveCount(1, { timeout: 60_000 });
  });

  test("new AI posts stay usable on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(DOCUMENT_AI_POST.path);
    const fieldDemo = page.locator("[data-field-matching-demo]");
    await fieldDemo.scrollIntoViewIfNeeded();
    const fieldBox = await fieldDemo.boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(fieldBox!.width).toBeLessThanOrEqual(390);

    await page.goto(VISION_VLM_POST.path);
    const visionDemo = page.locator("[data-vision-vs-vlm-demo]");
    await visionDemo.scrollIntoViewIfNeeded();
    const visionBox = await visionDemo.boundingBox();
    expect(visionBox).not.toBeNull();
    expect(visionBox!.width).toBeLessThanOrEqual(390);
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(400);
  });

  test("renders the isolation post with sequence-diagram playgrounds", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/writing");
    await expect(
      page.getByRole("link", { name: ISOLATION_POST.title })
    ).toBeVisible();

    await page.goto(ISOLATION_POST.path);
    await expect(
      page.getByRole("heading", { name: ISOLATION_POST.title })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "What “committed” is for" })
    ).toBeVisible();

    const cover = page.locator(
      'img[src="/content/images/writing/transaction-isolation/cover.svg"]'
    );
    await expectImageLoaded(cover);

    const dirty = page.locator('[data-isolation-demo="dirty-read"]');
    await dirty.scrollIntoViewIfNeeded();
    await expect(
      dirty.getByRole("img", { name: "Dirty read sequence diagram" })
    ).toBeVisible();
    await expect(dirty.locator("[data-sequence-actor=alice]")).toBeVisible();
    await expect(dirty.locator("[data-sequence-actor=acc1]")).toBeVisible();

    const speed = dirty.locator('[data-segmented-control="playback-rate"]');
    await speed.getByRole("radio", { name: "2×", exact: true }).click();
    const runDirty = dirty.getByRole("button", { name: "Run the interleaving" });
    await runDirty.evaluate((el) =>
      el.scrollIntoView({ block: "center", inline: "nearest" })
    );
    await runDirty.click();
    await expect(dirty.locator("[data-animation-player]")).toHaveAttribute(
      "data-playback-status",
      "playing"
    );
    const diagram = dirty.locator("[data-sequence-diagram]");
    const playheadAtStart = Number(await diagram.getAttribute("data-playhead"));
    await expect
      .poll(async () => Number(await diagram.getAttribute("data-playhead")), {
        timeout: 4_000,
      })
      .toBeGreaterThan(playheadAtStart);
    await expect(dirty.locator("[data-isolation-status]")).toContainText(
      /never committed|Bob read 600/i,
      { timeout: 80_000 }
    );
    await expect(dirty.locator("[data-sequence-event=abort]")).toBeVisible();

    const level = dirty.locator('[data-segmented-control="isolation-level"]');
    await level.getByRole("radio", { name: "Read committed", exact: true }).click();
    await dirty.getByRole("button", { name: "Run the interleaving" }).click();
    await expect(dirty.locator("[data-isolation-status]")).toContainText(
      /did not leak/i,
      { timeout: 80_000 }
    );

    const lost = page.locator('[data-isolation-demo="lost-update"]');
    await lost.scrollIntoViewIfNeeded();
    await lost.getByRole("button", { name: "Run the interleaving" }).click();
    await expect(lost.locator("[data-isolation-status]")).toContainText(
      /vanished/i,
      { timeout: 80_000 }
    );
    await expect(lost.locator('[data-record-id="acc1"]')).toHaveAttribute(
      "data-record-committed",
      "600"
    );

    const skew = page.locator('[data-isolation-demo="write-skew"]');
    await skew.scrollIntoViewIfNeeded();
    await expect(
      skew.getByRole("img", { name: "Write skew sequence diagram" })
    ).toBeVisible();
    await skew.getByRole("button", { name: "Run the interleaving" }).click();
    await expect(skew.locator("[data-isolation-status]")).toContainText(
      /Both went off call/i,
      { timeout: 80_000 }
    );
  });

  test("isolation diagrams stay usable on a narrow viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ISOLATION_POST.path);

    const dirty = page.locator('[data-isolation-demo="dirty-read"]');
    await dirty.scrollIntoViewIfNeeded();
    await expect(
      dirty.getByRole("button", { name: "Run the interleaving" })
    ).toBeVisible();
    const box = await dirty.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(390);
    const graph = dirty.locator("[data-sequence-diagram]");
    const sizes = await graph.evaluate((el) => ({
      client: el.clientWidth,
      scroll: el.scrollWidth,
    }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
    const pageWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    expect(pageWidth).toBeLessThanOrEqual(400);
  });
});
