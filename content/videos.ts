import type { Video } from "./types";

/**
 * Curated system-design video catalog.
 * Add entries here to publish on /videos. Loader API stays stable if we
 * later migrate to content/videos/*.mdx.
 */
export const videos: Video[] = [
  {
    slug: "demo-system-design-intro",
    title: "Demo: Intro to Architecture and Systems Design Interviews",
    summary:
      "A public intro to system-design interview thinking. Replace this demo entry with your own YouTube explainers.",
    youtubeId: "ZgdS0EUmn70",
    topics: ["system-design", "demo"],
    publishedAt: "2025-01-15",
    featured: true,
    thumbnail: "/content/images/videos/demo-system-design-intro/thumbnail.svg",
  },
];
