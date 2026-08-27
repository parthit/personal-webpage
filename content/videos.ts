import type { Video } from "./types";

/**
 * Curated system-design video catalog.
 * Add entries here to publish on /videos. Loader API stays stable if we
 * later migrate to content/videos/*.mdx.
 */
export const videos: Video[] = [
  {
    slug: "architecture-system-design-interviews",
    title: "Intro to Architecture and Systems Design Interviews",
    summary:
      "Jackson Gabbard explains what architecture interviews evaluate and how to communicate trade-offs, constraints, and technical leadership.",
    youtubeId: "ZgdS0EUmn70",
    topics: ["system-design", "interviews"],
    publishedAt: "2016-07-31",
    featured: true,
    thumbnail:
      "/content/images/videos/architecture-system-design-interviews/thumbnail.svg",
  },
];
