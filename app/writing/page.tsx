import type { Metadata } from "next";
import { PostList } from "@/components/content/PostList";
import { getAllPosts } from "@/lib/content/writing";

export const metadata: Metadata = {
  title: "Writing",
  description:
    "Essays and system-design notes by Parthit Patel on scalable systems, data structures, and software engineering.",
  alternates: {
    canonical: "/writing",
  },
  openGraph: {
    title: "Writing · Parthit Patel",
    description:
      "Essays and system-design notes on scalable systems, data structures, and software engineering.",
    url: "/writing",
    type: "website",
  },
  twitter: {
    title: "Writing · Parthit Patel",
    description:
      "Essays and system-design notes on scalable systems, data structures, and software engineering.",
  },
};

export default function WritingIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-10">
        <h1 className="mb-3 text-3xl font-semibold">Writing</h1>
        <p className="text-gray-700 dark:text-gray-300">
          Essays and system-design notes. The demo post below shows how MDX
          content is rendered on this site.
        </p>
      </header>
      <PostList posts={posts} />
    </div>
  );
}
