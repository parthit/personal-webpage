import type { Video } from "./types";

/**
 * Curated system-design video catalog.
 * Add entries here to publish on /videos. Loader API stays stable if we
 * later migrate to content/videos/*.mdx.
 */
export const videos: Video[] = [
  {
    slug: "demo-url-shortener",
    title: "Demo: System Design — URL Shortener",
    summary:
      "A public walkthrough of the classic URL shortener design interview prompt. Replace this demo entry with your own explainers.",
    youtubeId: "fGpXjDuKd4M",
    topics: ["system-design", "demo"],
    publishedAt: "2025-01-15",
    featured: true,
  },
];
