import { expect, test } from "@playwright/test";
import { DEMO_POST } from "./helpers";

test.describe("SEO discovery", () => {
  test("serves robots.txt that allows crawling and points to the sitemap", async ({
    request,
  }) => {
    const response = await request.get("/robots.txt");
    expect(response.ok()).toBeTruthy();

    const body = await response.text();
    expect(body).toMatch(/User-Agent:\s*\*/i);
    expect(body).toMatch(/Allow:\s*\//i);
    expect(body).toMatch(/Sitemap:\s*https?:\/\/.+\/sitemap\.xml/i);
  });

  test("serves a sitemap that includes key portfolio routes", async ({
    request,
  }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBeTruthy();

    const body = await response.text();
    expect(body).toContain("<urlset");
    expect(body).toMatch(/https?:\/\/.+\/writing/);
    expect(body).toMatch(/https?:\/\/.+\/videos/);
    expect(body).toMatch(/https?:\/\/.+\/chat/);
    expect(body).toContain(`/writing/${DEMO_POST.slug}`);
  });

  test("home page exposes useful document metadata and JSON-LD", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Parthit Patel/i);

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute(
      "content",
      /fullstack engineer|system design|portfolio/i
    );

    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Parthit Patel/i
    );
    await expect(
      page.locator('meta[property="og:description"]')
    ).toHaveAttribute("content", /.+/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image"
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /parthitpatel\.com\/?$/
    );

    const jsonLd = page.locator('script[type="application/ld+json"]').first();
    await expect(jsonLd).toBeAttached();
    const payload = JSON.parse((await jsonLd.textContent()) ?? "{}");
    const graph = payload["@graph"] ?? [payload];
    const types = graph.map((node: { "@type"?: string }) => node["@type"]);
    expect(types).toEqual(expect.arrayContaining(["Person", "WebSite"]));
  });

  test("non-home routes do not inherit the homepage canonical", async ({
    page,
  }) => {
    await page.goto("/videos");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/videos\/?$/
    );
    await expect(page.locator('link[rel="canonical"]')).not.toHaveAttribute(
      "href",
      /parthitpatel\.com\/?$/
    );
  });
});
