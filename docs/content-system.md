# Content system

This site publishes **writing** (MDX pages) and **videos** (a typed catalog of YouTube explainers). Content is git-versioned. Routes stay thin; all reads go through `lib/content/*` so sources can change later without rewriting pages.

## Goals

- Add posts by dropping MDX files into the repo
- Curate system-design YouTube videos from a typed list
- Keep images local and optimized via `next/image`
- Stay extensible for tags, series, RSS, and a future CMS

## Folder map

```text
content/
  types.ts                 # shared contracts
  videos.ts                # video catalog
  writing/*.mdx            # posts (filename = slug)

lib/content/
  writing.ts               # getAllPosts, getPostBySlug, …
  videos.ts                # getAllVideos, getFeaturedVideos, …

components/content/
  PostList.tsx
  VideoCard.tsx
  HomeTeasers.tsx
  YouTube.tsx              # embed + optional click-to-play facade
  mdx/
    MDXImage.tsx
    components.tsx         # markdown → React element map

app/
  writing/page.tsx
  writing/[slug]/page.tsx
  videos/page.tsx

public/content/images/
  writing/<slug>/…         # per-post images
```

## Architecture rules

1. **Pages call loaders only.** Never `fs.readFile` from a React component outside `lib/content`.
2. **Filename is the slug.** `content/writing/rate-limiting.mdx` → `/writing/rate-limiting`.
3. **Drafts are hidden in production.** `draft: true` still renders in `next dev`.
4. **External posts are first-class.** Set `externalUrl` to list a Medium/Substack link without a local body route.
5. **Videos are YouTube IDs**, not binary uploads in git.
6. **MDX components are registered in one place** (`components/content/mdx/components.tsx`).

## Schemas

### Writing frontmatter

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Page title |
| `summary` | yes | Index + SEO description |
| `date` | yes | ISO `YYYY-MM-DD` |
| `tags` | no | string array |
| `cover` | no | public path under `/content/images/...` |
| `draft` | no | default `false` |
| `externalUrl` | no | if set, index links out |
| `series` | no | reserved for future grouping |

### Video entry (`content/videos.ts`)

| Field | Required | Notes |
|---|---|---|
| `slug` | yes | stable id |
| `title` | yes | |
| `summary` | yes | |
| `youtubeId` | yes | 11-char id |
| `topics` | yes | string array |
| `publishedAt` | yes | ISO date |
| `featured` | no | shown at top of `/videos` |
| `thumbnail` | no | optional local override |

## Media

### Images

- Store under `public/content/images/writing/<slug>/`
- Reference with absolute paths in MDX: `![alt](/content/images/writing/<slug>/diagram.svg)`
- Markdown images render through `MDXImage` → `next/image`
- Prefer WebP/JPG for photos and SVG/PNG for diagrams
- SVG files are rendered with `unoptimized` (Next.js image optimization rejects SVG by default)
- Always include meaningful `alt` text

### Videos

- Use `<YouTube id="..." title="..." />` inside MDX
- `/videos` uses the same component with a thumbnail facade (`facade`)
- Embeds use `https://www.youtube-nocookie.com/embed/<id>`
- Do not commit large lecture `.mp4` files

## Routes

| Route | Source |
|---|---|
| `/writing` | `getAllPosts()` |
| `/writing/[slug]` | `getPostBySlug(slug)` + MDX render |
| `/videos` | `getFeaturedVideos()` + `getAllVideos()` |
| `/` teasers | `getLatestPosts(1)` + `getLatestVideos(1)` |

Nav labels live in `app/components/Header.tsx`: `home | writing | videos | chat`.

## Demo content

Shipped so the pipeline is obvious:

- Post: `content/writing/demo-url-shortener.mdx`
- Images: `public/content/images/writing/demo-url-shortener/`
- Video: featured entry in `content/videos.ts`

Replace or delete demos when real content is ready. No route changes required.

## Future extensions

These should plug in without rewriting the loader boundary:

1. **Tag pages** — `/writing/tags/[tag]` using `post.tags`
2. **Video detail pages** — `/videos/[slug]` (optionally migrate catalog to MDX)
3. **RSS + sitemap** — generate from `getAllPosts()` / `getAllVideos()`
4. **OG images** — `app/writing/[slug]/opengraph-image.tsx`
5. **Series** — group by `series` frontmatter
6. **Build-time validation** — fail CI when required frontmatter is missing
7. **CMS adapter** — keep `lib/content` signatures; swap file reads for API fetches

## What not to do

- Read the filesystem from page/UI components
- Iframe third-party blog platforms (usually blocked / poor UX)
- Put multi‑hundred‑MB videos in `public/`
- Change slugs casually (add redirects if you must rename)
- Bypass `mdxComponents` with one-off styling in individual posts

## Related docs

- Authoring recipes: [`authoring-guide.md`](./authoring-guide.md)
- Testing / CI: [`testing.md`](./testing.md)
- Project overview: [`../README.md`](../README.md)
