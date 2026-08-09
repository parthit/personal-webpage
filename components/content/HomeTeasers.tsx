import Link from "next/link";
import type { Video } from "@/content/types";
import type { WritingPostSummary } from "@/content/types";

type HomeTeasersProps = {
  posts: WritingPostSummary[];
  videos: Video[];
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function HomeTeasers({ posts, videos }: HomeTeasersProps) {
  if (posts.length === 0 && videos.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 space-y-10 border-t border-gray-200 pt-10 dark:border-gray-700">
      {posts.length > 0 && (
        <div>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold">Latest writing</h2>
            <Link
              href="/writing"
              className="text-sm text-gray-600 hover:underline dark:text-gray-400"
            >
              All writing
            </Link>
          </div>
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.slug}>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(post.date)}
                </p>
                <Link
                  href={post.externalUrl ?? `/writing/${post.slug}`}
                  className="font-medium hover:underline"
                  {...(post.externalUrl
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {post.title}
                </Link>
                <p className="text-gray-700 dark:text-gray-300">{post.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {videos.length > 0 && (
        <div>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold">Watch</h2>
            <Link
              href="/videos"
              className="text-sm text-gray-600 hover:underline dark:text-gray-400"
            >
              All videos
            </Link>
          </div>
          <ul className="space-y-4">
            {videos.map((video) => (
              <li key={video.slug}>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(video.publishedAt)}
                </p>
                <Link href="/videos" className="font-medium hover:underline">
                  {video.title}
                </Link>
                <p className="text-gray-700 dark:text-gray-300">{video.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
