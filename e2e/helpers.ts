import { expect, type Locator, type Page } from "@playwright/test";

export const DEMO_POST = {
  slug: "demo-url-shortener",
  title: "Demo: Designing a URL Shortener",
  path: "/writing/demo-url-shortener",
} as const;

export const BTREE_POST = {
  slug: "b-trees",
  title: "B-Trees: Balanced Search for Memory and Disk",
  path: "/writing/b-trees",
} as const;

export const REPLICATION_POST = {
  slug: "replication",
  title: "Replication: Keeping Copies in Sync",
  path: "/writing/replication",
} as const;

export const DOCUMENT_AI_POST = {
  slug: "document-ai-field-matching",
  title: "Document AI: matching fields without trusting OCR",
  path: "/writing/document-ai-field-matching",
} as const;

export const VISION_VLM_POST = {
  slug: "specialized-vision-vs-vlm",
  title: "When a specialized vision model beats a VLM",
  path: "/writing/specialized-vision-vs-vlm",
} as const;

export const DEMO_VIDEO = {
  slug: "demo-system-design-intro",
  title: "Demo: Intro to Architecture and Systems Design Interviews",
  youtubeId: "ZgdS0EUmn70",
} as const;

export async function expectNav(page: Page) {
  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("link", { name: "home", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "writing", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "videos", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "chat", exact: true })).toBeVisible();
}

export async function expectActiveNav(page: Page, label: string) {
  const link = page.getByRole("navigation").getByRole("link", {
    name: label,
    exact: true,
  });
  await expect(link).toHaveAttribute("aria-current", "page");
}

export async function expectImageLoaded(image: Locator) {
  await expect(image).toBeVisible();
  await expect
    .poll(async () =>
      image.evaluate((el) => {
        const img = el as HTMLImageElement;
        return img.complete && img.naturalWidth > 0 ? img.naturalWidth : 0;
      })
    )
    .toBeGreaterThan(0);
}
