/**
 * Shared content contracts for writing and videos.
 * Keep page components dependent on these types via lib/content loaders,
 * not on filesystem details, so sources can change later (CMS, etc.).
 */

export type WritingPostMeta = {
  title: string;
  summary: string;
  date: string;
  tags: string[];
  cover?: string;
  draft?: boolean;
  /** When set, index links out instead of opening a local MDX body. */
  externalUrl?: string;
  /** Optional grouping key for future series pages. */
  series?: string;
};

export type WritingPost = WritingPostMeta & {
  slug: string;
  content: string;
  readingTime: string;
};

export type WritingPostSummary = Omit<WritingPost, "content">;

export type Video = {
  slug: string;
  title: string;
  summary: string;
  youtubeId: string;
  topics: string[];
  publishedAt: string;
  featured?: boolean;
  /** Optional local override; otherwise YouTube thumbnail is used. */
  thumbnail?: string;
};
