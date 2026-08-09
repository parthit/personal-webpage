import Link from "next/link";
import type { WritingPostSummary } from "@/content/types";

type PostListProps = {
  posts: WritingPostSummary[];
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function PostList({ posts }: PostListProps) {
  if (posts.length === 0) {
    return (
      <p className="text-gray-600 dark:text-gray-400">
        No posts yet. Add an MDX file under <code>content/writing/</code>.
      </p>
    );
  }

  return (
    <ul className="space-y-8">
      {posts.map((post) => {
        const href = post.externalUrl ?? `/writing/${post.slug}`;
        const external = Boolean(post.externalUrl);

        return (
          <li key={post.slug} className="border-b border-gray-200 pb-8 last:border-0 dark:border-gray-700">
            <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
              {formatDate(post.date)}
              {post.readingTime ? ` · ${post.readingTime}` : ""}
            </p>
            <h2 className="mb-2 text-xl font-semibold">
              <Link
                href={href}
                className="hover:underline"
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {post.title}
                {external ? " ↗" : ""}
              </Link>
            </h2>
            <p className="mb-3 text-gray-700 dark:text-gray-300">{post.summary}</p>
            {post.tags.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <li
                    key={tag}
                    className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
