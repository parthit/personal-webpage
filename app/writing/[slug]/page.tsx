import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/content/mdx/components";
import { getAllWritingSlugs, getPostBySlug } from "@/lib/content/writing";
import {
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  socialShareImage,
} from "@/lib/site";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllWritingSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  // External-only posts are listed on /writing but have no local page.
  if (!post || post.externalUrl) {
    return {
      title: "Post not found",
      robots: { index: false, follow: false },
    };
  }

  const path = `/writing/${post.slug}`;
  const shareImage = socialShareImage(post.cover, post.title);

  return {
    title: post.title,
    description: post.summary,
    alternates: {
      canonical: path,
    },
    authors: [{ name: SITE_NAME }],
    openGraph: {
      title: post.title,
      description: post.summary,
      url: path,
      type: "article",
      publishedTime: post.date,
      authors: [SITE_NAME],
      tags: post.tags,
      images: [shareImage],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary,
      images: [shareImage.url],
    },
  };
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function WritingPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post || post.externalUrl) {
    notFound();
  }

  const path = `/writing/${post.slug}`;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Person",
      name: SITE_NAME,
      url: SITE_URL,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(path),
    },
    image: [absoluteUrl(socialShareImage(post.cover, post.title).url)],
    keywords: post.tags.join(", "),
  };

  return (
    <article className="mx-auto w-full max-w-2xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Link
        href="/writing"
        className="mb-6 inline-block text-sm text-gray-600 hover:underline dark:text-gray-400"
      >
        ← All writing
      </Link>

      <header className="mb-8">
        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
          {formatDate(post.date)} · {post.readingTime}
        </p>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">
          {post.title}
        </h1>
        <p className="mb-4 text-lg text-gray-700 dark:text-gray-300">
          {post.summary}
        </p>
        {post.tags.length > 0 && (
          <ul className="mb-6 flex flex-wrap gap-2">
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
        {post.cover ? (
          <Image
            src={post.cover}
            alt=""
            width={1200}
            height={630}
            className="pointer-events-none h-auto w-full max-w-full rounded-lg"
            priority
            unoptimized={post.cover.toLowerCase().endsWith(".svg")}
          />
        ) : null}
      </header>

      <div className="writing-prose">
        <MDXRemote
          source={post.content}
          components={mdxComponents}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
            },
          }}
        />
      </div>
    </article>
  );
}
