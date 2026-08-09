# Authoring guide

How to add writing and videos to this site.

## Add a writing post

1. Create `content/writing/<slug>.mdx`  
   Example: `content/writing/consistent-hashing.mdx` → `/writing/consistent-hashing`
2. Add frontmatter:

```mdx
---
title: "Consistent Hashing"
summary: "Why rings beat modulo when nodes come and go."
date: "2026-03-01"
tags: ["system-design", "caching"]
cover: "/content/images/writing/consistent-hashing/cover.webp"
draft: false
---
```

3. Put images in `public/content/images/writing/<slug>/`
4. Write markdown body. Optional mid-post video:

```mdx
<YouTube id="YOUR_YOUTUBE_ID" title="Consistent hashing explained" />
```

5. Run `npm run dev` and open `/writing/<slug>`
6. Set `draft: false` when ready. Drafts are hidden in production builds.

### Link an external post instead

If the article already lives on Medium/Substack/etc., you can still list it:

```mdx
---
title: "My Medium piece"
summary: "Short blurb for the index."
date: "2026-02-01"
tags: ["career"]
externalUrl: "https://medium.com/@you/your-post"
draft: false
---

Optional body is ignored for routing when externalUrl is set.
```

The index links out; `/writing/<slug>` is not generated for external-only posts.

## Add a video

Edit `content/videos.ts` and append:

```ts
{
  slug: "rate-limiting",
  title: "Rate Limiting",
  summary: "Token bucket vs sliding window, with Redis notes.",
  youtubeId: "xxxxxxxxxxx",
  topics: ["system-design"],
  publishedAt: "2026-03-10",
  featured: false,
},
```

- `youtubeId` is the value after `v=` in a YouTube URL
- Set `featured: true` to pin it at the top of `/videos`
- Optional `thumbnail` can point at a local image under `public/`

## Image checklist

- [ ] File lives under `public/content/images/writing/<slug>/`
- [ ] Markdown uses an absolute path starting with `/content/images/...`
- [ ] `alt` text describes the figure
- [ ] Cover (if any) is listed in frontmatter as `cover`
- [ ] SVG is fine for diagrams; photos should be WebP/JPG for best optimization

## Post checklist

- [ ] `title`, `summary`, `date` present
- [ ] Slug is lowercase kebab-case and stable
- [ ] Tags are short and reusable (`system-design`, not `System Design!!!`)
- [ ] Demo content removed or clearly replaced when publishing real work
- [ ] `npm run build` succeeds

## Available MDX extras

Registered in `components/content/mdx/components.tsx`:

| Name | Usage |
|---|---|
| Standard markdown | headings, lists, links, code, blockquotes |
| Images | `![alt](/content/images/...)` → optimized `next/image` |
| `YouTube` | `<YouTube id="..." title="..." />` |

To add a new custom block (callout, quiz, etc.):

1. Create the component under `components/content/mdx/`
2. Register it in `components.tsx`
3. Document it here

## Local preview

```bash
npm run dev
```

- Writing index: http://localhost:3000/writing
- Demo post: http://localhost:3000/writing/demo-url-shortener
- Videos: http://localhost:3000/videos

## Replacing demo content

1. Delete or set `draft: true` on `content/writing/demo-url-shortener.mdx`
2. Remove `public/content/images/writing/demo-url-shortener/` if unused
3. Replace the demo object in `content/videos.ts` with your videos

No route or loader changes needed.
