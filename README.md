# Parthit's webpage

Personal site built with [Next.js](https://nextjs.org/) (App Router), TypeScript, and Tailwind CSS.

## Features

- Home / about page
- Cal.com booking at `/chat`
- **Writing** — MDX posts at `/writing`
- **Videos** — curated YouTube system-design catalog at `/videos`

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Content

Content is git-versioned and loaded through `lib/content/*`.

| Add… | Where |
|---|---|
| A blog/system-design post | `content/writing/<slug>.mdx` |
| Post images | `public/content/images/writing/<slug>/` |
| A YouTube explainer | `content/videos.ts` |

Demo content is included:

- Post: [/writing/demo-url-shortener](http://localhost:3000/writing/demo-url-shortener)
- Videos: [/videos](http://localhost:3000/videos)

### Docs

- [Content system architecture](./docs/content-system.md) — structure, schemas, extension points
- [Authoring guide](./docs/authoring-guide.md) — how to add posts, images, and videos

## Scripts

```bash
npm run dev     # local development
npm run build   # production build
npm run start   # serve production build
npm run lint    # eslint
```

## Deploy

Deploy on [Vercel](https://vercel.com) or any host that supports Next.js.
