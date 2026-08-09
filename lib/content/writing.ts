import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";
import type { WritingPost, WritingPostMeta, WritingPostSummary } from "@/content/types";

const WRITING_DIR = path.join(process.cwd(), "content", "writing");

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/** Coerce YAML/JSON frontmatter draft values without treating "false" as true. */
export function parseDraftFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "" || normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
  }
  return false;
}

function parseMeta(data: Record<string, unknown>, slug: string): WritingPostMeta {
  if (!data.title || !data.summary || !data.date) {
    throw new Error(
      `Post "${slug}" is missing required frontmatter (title, summary, date).`
    );
  }

  return {
    title: String(data.title),
    summary: String(data.summary),
    date: String(data.date),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    cover: data.cover ? String(data.cover) : undefined,
    draft: parseDraftFlag(data.draft),
    externalUrl: data.externalUrl ? String(data.externalUrl) : undefined,
    series: data.series ? String(data.series) : undefined,
  };
}

function readPostFile(slug: string): WritingPost | null {
  const filePath = path.join(WRITING_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const { content, data } = matter(raw);
  const meta = parseMeta(data as Record<string, unknown>, slug);
  const stats = readingTime(content);

  return {
    ...meta,
    slug,
    content,
    readingTime: stats.text,
  };
}

function listSlugs(): string[] {
  if (!fs.existsSync(WRITING_DIR)) {
    return [];
  }

  return fs
    .readdirSync(WRITING_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));
}

function toSummary(post: WritingPost): WritingPostSummary {
  const { content: _content, ...summary } = post;
  return summary;
}

/** All non-draft posts (drafts included in development). Newest first. */
export function getAllPosts(): WritingPostSummary[] {
  return listSlugs()
    .map((slug) => readPostFile(slug))
    .filter((post): post is WritingPost => post !== null)
    .filter((post) => !post.draft || !isProduction())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(toSummary);
}

export function getPostBySlug(slug: string): WritingPost | null {
  const post = readPostFile(slug);
  if (!post) return null;
  if (post.draft && isProduction()) return null;
  return post;
}

export function getLatestPosts(limit = 2): WritingPostSummary[] {
  return getAllPosts().slice(0, limit);
}

export function getAllWritingSlugs(): string[] {
  return getAllPosts()
    .filter((post) => !post.externalUrl)
    .map((post) => post.slug);
}
