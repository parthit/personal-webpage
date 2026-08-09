import Link from "next/link";
import type { Video } from "@/content/types";
import { YouTube } from "./YouTube";

type VideoCardProps = {
  video: Video;
  /** Render an embed/facade instead of just a link row. */
  embed?: boolean;
  facade?: boolean;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function VideoCard({
  video,
  embed = false,
  facade = true,
}: VideoCardProps) {
  return (
    <article className="space-y-3">
      {embed ? (
        <YouTube id={video.youtubeId} title={video.title} facade={facade} />
      ) : null}
      <div>
        <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
          {formatDate(video.publishedAt)}
        </p>
        <h2 className="mb-2 text-xl font-semibold">
          <Link
            href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {video.title}
          </Link>
        </h2>
        <p className="mb-3 text-gray-700 dark:text-gray-300">{video.summary}</p>
        {video.topics.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {video.topics.map((topic) => (
              <li
                key={topic}
                className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400"
              >
                {topic}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
