import type { Metadata } from "next";
import { VideoCard } from "@/components/content/VideoCard";
import { getAllVideos, getFeaturedVideos } from "@/lib/content/videos";

export const metadata: Metadata = {
  title: "Videos — Parthit Patel",
  description: "System design explainers and related videos.",
};

export default function VideosPage() {
  const featured = getFeaturedVideos();
  const featuredSlugs = new Set(featured.map((video) => video.slug));
  const rest = getAllVideos().filter((video) => !featuredSlugs.has(video.slug));

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-10">
        <h1 className="mb-3 text-3xl font-semibold">Videos</h1>
        <p className="text-gray-700 dark:text-gray-300">
          System design concepts I am learning and explaining. The featured
          item is demo content you can replace with your own YouTube links.
        </p>
      </header>

      {featured.length > 0 && (
        <section className="mb-12 space-y-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Featured
          </h2>
          {featured.map((video) => (
            <VideoCard key={video.slug} video={video} embed facade />
          ))}
        </section>
      )}

      {rest.length > 0 && (
        <section className="space-y-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            More videos
          </h2>
          {rest.map((video) => (
            <VideoCard key={video.slug} video={video} embed facade />
          ))}
        </section>
      )}

      {featured.length === 0 && rest.length === 0 && (
        <p className="text-gray-600 dark:text-gray-400">
          No videos yet. Add entries in <code>content/videos.ts</code>.
        </p>
      )}
    </div>
  );
}
