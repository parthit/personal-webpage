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
- Optional `thumbnail` can point at a local image under `public/` (used for the click-to-play facade on `/videos`)

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
- [ ] Examples, assumptions, and claims are accurate and clearly labeled
- [ ] `npm run build` succeeds

## Available MDX extras

Registered in `components/content/mdx/components.tsx`:

| Name | Usage |
|---|---|
| Standard markdown | headings, lists, links, code, blockquotes |
| GFM tables | pipe tables (`\| col \|`) via `remark-gfm` |
| Images | `![alt](/content/images/...)` → optimized `next/image` |
| `YouTube` | `<YouTube id="..." title="..." />` |
| `BTreeVisualizer` | `<BTreeVisualizer />` — interactive B-tree with animated insert/search/delete |
| `BTreeIndexDemo` | `<BTreeIndexDemo />` — animated table-scan vs B-tree index I/O comparison |
| `LeaderFollowerDemo` | `<LeaderFollowerDemo />` — single-leader sync/async replication, reads, failover |
| `StaleReadDemo` | `<StaleReadDemo />` — write then read leader vs follower (replication lag) |
| `MultiLeaderDemo` | `<MultiLeaderDemo />` — partitioned cart writes, LWW vs union merge |
| `QuorumDemo` | `<QuorumDemo />` — leaderless N/W/R quorums |
| `FieldMatchingDemo` | `<FieldMatchingDemo />` — OCR spans → schema matching with confidence thresholds |
| `VisionVsVlmDemo` | `<VisionVsVlmDemo />` — specialized detector vs VLM latency/accuracy walkthrough |

### Before you publish

Follow [`.cursor/pr-checklist.md`](../.cursor/pr-checklist.md): judge the
rendered page on desktop and mobile, not only the MDX source. Only use formats
the content pipeline supports, and make sure interactive bits stay readable and
reachable.

To add a new custom block (callout, quiz, etc.):

1. Create the component under `components/content/mdx/`
2. Register it in `components.tsx`
3. Document it here

### Add a step-based animation

Blog animations use the shared engine in `lib/animation/` with the React adapter
in `components/animation/`. Keep animation scripts outside MDX: the post should
only embed a registered demo component.

1. Define a serializable snapshot containing everything the renderer needs.
2. Build an ordered array of `AnimationStep<T>` values. Each step has a full
   `snapshot`, a human-readable `label`, and optional `durationMs` / `group`.
3. Pass the initial snapshot to `useAnimationPlayer`.
4. Render `player.current.snapshot` and add
   `<AnimationPlayer player={player} />`. It owns play/pause, replay at the end
   of the timeline, step forward/back, the scrub slider, a 0.5×–2× speed
   selector, a dwell meter for the current step, the playback status line, and
   the step history. Before the first run it collapses to a speed selector and a
   one-line hint, so seeding the player with a single idle step costs nothing.
5. Use `player.run(steps)` to append and play an operation. Use `player.reset`
   only when the demo itself resets; reset intentionally clears history.

Snapshots must be complete and side-effect free. Precompute mutations while
building steps instead of mutating application state when a frame plays. That
contract makes every animation reversible and directly seekable.

Two rules that keep figures honest:

- **The player is the only place that reports playback state.** Do not add a
  per-demo "Animating…" line; it double-announces with the demo's status text.
- **CSS motion inside a figure must know whether the timeline is running.**
  Read `player.status` and `player.currentDurationMs` and pass them down (see
  `ReplicaGraph`'s `playing` / `stepDurationMs` props) so motion pauses with the
  timeline, follows the viewer's speed, and does not replay on every scrub.

### Shared demo building blocks

| Component | Use it for |
|---|---|
| `SegmentedControl` | A single choice between demo modes. Filled `Button`s already mean "primary action" inside a figure, so never build a mode toggle out of them. Pass `hint` to explain the selected option. |
| `Slider` | Numeric demo parameters. Native `<input type="range">` is unthemed and inconsistent with the timeline. |
| `ScrollableFigure` | Any diagram wider than its container. Adds edge fades and a scroll hint so cropped content does not read as a rendering bug. |

## Local preview

```bash
npm run dev
```

- Writing index: http://localhost:3000/writing
- Videos: http://localhost:3000/videos
