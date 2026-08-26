# Parthit's webpage

Personal site built with [Next.js](https://nextjs.org/) (App Router), TypeScript, and Tailwind CSS.

## Features

- Home / about page
- Selected projects at `/projects`
- Cal.com booking at `/chat`
- **Writing** — MDX posts at `/writing`
- **Videos** — curated YouTube system-design catalog at `/videos`
- **SEO** — metadata, Open Graph, JSON-LD, `/robots.txt`, and `/sitemap.xml`

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Canonical site URL defaults to `https://www.parthitpatel.com` (Vercel redirects the apex domain there). Override with `NEXT_PUBLIC_SITE_URL` if needed.

## Content

Content is git-versioned and loaded through `lib/content/*`.

| Add… | Where |
|---|---|
| A blog/system-design post | `content/writing/<slug>.mdx` |
| Post images | `public/content/images/writing/<slug>/` |
| A recommended YouTube video | `content/videos.ts` |

### Docs

- [Content system architecture](./docs/content-system.md) — structure, schemas, extension points
- [Authoring guide](./docs/authoring-guide.md) — how to add posts, images, and videos

## Scripts

```bash
npm run dev            # local development
npm run build          # production build
npm run start          # serve production build
npm run lint           # eslint
npm run test:unit      # node:test unit suite
npm run test:e2e       # Playwright end-to-end tests (builds + starts app)
npm run test           # unit + e2e
npm run test:e2e:ui    # Playwright UI mode
npm run test:e2e:report
```

CI runs lint, unit tests, build, and Playwright on every pull request and push to `main`. See [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) and [`docs/testing.md`](./docs/testing.md).

## Deploy

Deploy on [Vercel](https://vercel.com) or any host that supports Next.js.
