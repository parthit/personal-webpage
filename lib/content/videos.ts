import { videos } from "@/content/videos";
import type { Video } from "@/content/types";

/** All videos, newest first. */
export function getAllVideos(): Video[] {
  return [...videos].sort((a, b) =>
    a.publishedAt < b.publishedAt ? 1 : -1
  );
}

export function getVideoBySlug(slug: string): Video | null {
  return videos.find((video) => video.slug === slug) ?? null;
}

export function getFeaturedVideos(): Video[] {
  const featured = getAllVideos().filter((video) => video.featured);
  if (featured.length > 0) return featured;
  const [first] = getAllVideos();
  return first ? [first] : [];
}

export function getLatestVideos(limit = 2): Video[] {
  return getAllVideos().slice(0, limit);
}

export function getVideosByTopic(topic: string): Video[] {
  return getAllVideos().filter((video) => video.topics.includes(topic));
}
