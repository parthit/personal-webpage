import type { Metadata } from "next";
import { PostList } from "@/components/content/PostList";
import { getAllPosts } from "@/lib/content/writing";

export const metadata: Metadata = {
  title: "Writing — Parthit Patel",
  description: "Notes and system-design writeups.",
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
