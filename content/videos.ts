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
      "A clear explanation from Jackson Gabbard of what these interviews are really testing—and how to talk through the trade-offs without hand-waving.",
    youtubeId: "ZgdS0EUmn70",
    topics: ["system-design", "interviews"],
    publishedAt: "2016-07-31",
    featured: true,
    thumbnail:
      "/content/images/videos/architecture-system-design-interviews/thumbnail.svg",
  },
];
