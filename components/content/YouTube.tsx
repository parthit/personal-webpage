"use client";

import { useState } from "react";

type YouTubeProps = {
  id: string;
  title?: string;
  /** When true, show thumbnail first and load iframe on click. */
  facade?: boolean;
  /** Optional local/remote override for the facade image. */
  thumbnail?: string;
};

function defaultThumbnailUrl(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function YouTube({
  id,
  title = "YouTube video",
  facade = false,
  thumbnail,
}: YouTubeProps) {
  const [active, setActive] = useState(!facade);
  const facadeSrc = thumbnail || defaultThumbnailUrl(id);

  return (
    <div className="my-6 overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
      <div className="relative aspect-video w-full">
        {active ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <button
            type="button"
            onClick={() => setActive(true)}
            className="group absolute inset-0 h-full w-full"
            aria-label={`Play video: ${title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={facadeSrc}
              alt=""
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/40">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow">
                ▶
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
