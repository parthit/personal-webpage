import type { Metadata } from "next";
import { PostList } from "@/components/content/PostList";
import { getAllPosts } from "@/lib/content/writing";

export const metadata: Metadata = {
  title: "Writing",
  description:
    "Notes from Parthit Patel on applied AI, databases, and the engineering trade-offs behind everyday software.",
  alternates: {
    canonical: "/writing",
  },
  openGraph: {
    title: "Writing · Parthit Patel",
    description:
      "Notes from Parthit Patel on applied AI, databases, and the engineering trade-offs behind everyday software.",
    url: "/writing",
    type: "website",
  },
};

export default function WritingIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-10">
        <h1 className="mb-3 text-3xl font-semibold">Writing</h1>
        <p className="text-gray-700 dark:text-gray-300">
          Things I’ve been learning, with small demos you can poke at.
        </p>
      </header>
      <PostList posts={posts} />
    </div>
  );
}
