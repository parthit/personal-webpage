import Link from "next/link";

export default function WritingNotFound() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-3 text-3xl font-semibold">Post not found</h1>
      <p className="mb-6 text-gray-700 dark:text-gray-300">
        That writing slug does not exist, or the post is still a draft.
      </p>
      <Link href="/writing" className="text-blue-600 hover:underline dark:text-blue-400">
        ← Back to writing
      </Link>
    </div>
  );
}
