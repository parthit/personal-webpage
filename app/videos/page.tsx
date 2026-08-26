import type { Metadata } from "next";
import { VideoCard } from "@/components/content/VideoCard";
import { getAllVideos, getFeaturedVideos } from "@/lib/content/videos";

export const metadata: Metadata = {
  title: "Videos",
  description:
    "A curated collection of system design and software architecture videos recommended by Parthit Patel.",
  alternates: {
    canonical: "/videos",
  },
  openGraph: {
    title: "Videos · Parthit Patel",
    description:
      "A curated collection of system design and software architecture videos recommended by Parthit Patel.",
    url: "/videos",
    type: "website",
  },
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
          Talks and explainers I recommend for learning system design,
          architecture, and technical decision-making.
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
          I’m updating this collection. In the meantime, you can explore my
          interactive notes in the writing section.
        </p>
      )}
    </div>
  );
}
