import { expect, type Locator, type Page } from "@playwright/test";

export const BTREE_POST = {
  slug: "b-trees",
  title: "Why database indexes use wide, short trees",
  path: "/writing/b-trees",
} as const;

export const REPLICATION_POST = {
  slug: "replication",
  title: "Replication gets interesting when the copies disagree",
  path: "/writing/replication",
} as const;

export const DOCUMENT_AI_POST = {
  slug: "document-ai-field-matching",
  title: "OCR read the invoice. Now what?",
  path: "/writing/document-ai-field-matching",
} as const;

export const VISION_VLM_POST = {
  slug: "specialized-vision-vs-vlm",
  title: "You probably don’t need a VLM on every frame",
  path: "/writing/specialized-vision-vs-vlm",
} as const;

export const CURATED_VIDEO = {
  slug: "architecture-system-design-interviews",
  title: "Intro to Architecture and Systems Design Interviews",
  youtubeId: "ZgdS0EUmn70",
} as const;

export async function expectNav(page: Page) {
  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Writing", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Videos", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Contact", exact: true })).toBeVisible();
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
