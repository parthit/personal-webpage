import type { Metadata } from "next";
import Image from "next/image";
import { HomeTeasers } from "@/components/content/HomeTeasers";
import { getLatestVideos } from "@/lib/content/videos";
import { getLatestPosts } from "@/lib/content/writing";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/site";
import { homeContent } from "../public/content/text/landing";

export const metadata: Metadata = {
  title: {
    absolute: SITE_TITLE,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    type: "website",
  },
};

export default function Home() {
  const latestPosts = getLatestPosts(1);
  const latestVideos = getLatestVideos(1);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-3xl">{homeContent.title}</h1>
      <p className="mb-4 font-sans">{homeContent.introduction}</p>
      {homeContent.images.length > 0 && (
        <div
          className={
            homeContent.images.length === 1
              ? "mb-4"
              : "mb-4 grid grid-cols-2 gap-4"
          }
        >
          {homeContent.images.map((image) => (
            <Image
              key={image.src}
              src={image.src}
              alt={image.alt}
              width={800}
              height={800}
              className="h-auto w-full max-w-[280px] rounded-lg"
              priority
            />
          ))}
        </div>
      )}
      <p className="mt-3 text-justify font-sans">
        {homeContent.additionalContent1}
      </p>
      <p
        className="mt-3 text-justify font-sans"
        dangerouslySetInnerHTML={{ __html: homeContent.additionalContent2 }}
      ></p>
      <p
        className="mt-3 text-justify font-sans"
        dangerouslySetInnerHTML={{ __html: homeContent.additionalContent3 }}
      ></p>
      <div className="mt-8 text-center">
        <a
          href="https://www.linkedin.com/in/parthit/"
          target="_blank"
          rel="noopener noreferrer"
          className="mx-4 text-gray-600 hover:text-blue-500 dark:text-gray-300"
        >
          LinkedIn
        </a>
        <a
          href="mailto:parthitpatel@gmail.com"
          className="mx-4 text-gray-600 hover:text-blue-500 dark:text-gray-300"
        >
          Email
        </a>
        <a
          href="https://x.com/parthitp"
          target="_blank"
          rel="noopener noreferrer"
          className="mx-4 text-gray-600 hover:text-blue-500 dark:text-gray-300"
        >
          X
        </a>
      </div>

      <HomeTeasers posts={latestPosts} videos={latestVideos} />
    </div>
  );
}
