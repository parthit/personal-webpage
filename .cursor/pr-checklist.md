# PR checklist (read before opening a PR)

Agents and humans: consult this file before creating or updating a pull request.
It exists because interactive B-tree work shipped “done” repeatedly while still
broken for real viewers (unreadable math, clipped trees, unscrollable mobile
SVGs, near-instant animations), and each miss cost a follow-up PR.

## Hard rules from the B-tree **content / layout** incident

Triggered by the original `/writing/b-trees` post and the fix PRs that followed
(`#7`, `#8`, `#9`). Apply to MDX posts, `components/content/mdx/*`,
`lib/btree/btree.ts` layout, and writing-page chrome.

1. **Do not ship LaTeX without a renderer.**
   - This site has **no** KaTeX/MathJax. `\(\Theta(n)\)`, `t \ge 2`, `\log_t`
     render as raw junk.
   - Use Unicode / plain prose: `Θ(n)`, `t ≥ 2`, `O(logₜ n)`.
   - After writing math-y copy, **read the rendered page** — not only the MDX source.
2. **Fenced code contrast: nested `<code>` must not fight `<pre>`.**
   - Default inline-code chips (`bg-gray-200` on dark `pre`) produce white/light
     highlights on dark blocks — unreadable pseudocode.
   - Keep the pattern in `components/content/mdx/components.tsx`: light `pre` in
     light mode + `[&_code]:bg-transparent [&_code]:text-inherit` inside fences.
3. **GFM pipe tables need `remark-gfm`.**
   - Without it, `| Operation | … |` is not a `<table>` — it looks broken.
   - `MDXRemote` on writing posts must keep `remarkPlugins: [remarkGfm]`.
   - Assert real tables in e2e when a post depends on one (scope by column header
     so interactive heap tables do not collide).
4. **SVG tree layout: pad Y so roots are not clipped.**
   - Nodes centered at `y = 0` draw from `-NODE_H/2` — outside a `0 0 w h`
     viewBox — so the **top half of the root disappears**.
   - `layoutTree` must shift/pad so every node’s top/left ≥ 0 and bottom/right
     ≤ canvas. Keep the unit test that asserts bounds.
5. **Wide trees must scroll inside the card on mobile.**
   - `overflow-x-clip` on the article (or grid `min-width: auto`) clips content
     and **blocks** sideways scroll — users only see the left side.
   - Scroll containers need `min-w-0 w-full overflow-x-auto` plus an inner wrapper
     with an **explicit** SVG width (`minWidth: svgWidth`).
   - Prefer clipping only inside the figure card, not the whole article.
6. **Interactive demos should be wider than the prose column on desktop.**
   - Writing body is `max-w-2xl`; demos may break out (~56rem) so trees are usable.
   - Verify the breakout does not cause whole-page horizontal overflow.
7. **Visual QA both viewports before calling layout “fixed”.**
   - Desktop (~1280) **and** mobile (~390): math, pseudocode, both tree demos,
     index scroll, complexity table.
   - E2E green is not enough for clip/scroll/contrast bugs.

## Hard rules from the B-tree **demo animation** incident

These are non-negotiable for any change to `lib/btree/demo-animation.ts`,
`components/content/mdx/BTreeVisualizer.tsx`, `components/content/mdx/BTreeIndexDemo.tsx`,
or `app/globals.css` motion related to those demos.

1. **Educational walkthroughs must be slow enough to read.**
   - Short paths (2–4 nodes) need **long** dwells, not “snappy” UI timing.
   - Current baselines (do not lower without an explicit product ask + visual proof):
     - CRUD visualizer: `VIZ_STEP_MS` ≥ **2000**, `VIZ_HOLD_MS` ≥ **2800**
     - Index lookup: `INDEX_STEP_MS` ≥ **1400**, `INDEX_HOLD_MS` ≥ **2000**
     - Table scan: `DEMO_STEP_MS` ≥ **450**, `DEMO_HOLD_MS` ≥ **800**
2. **Never set frame delays to `0` for `prefers-reduced-motion`.**
   - Reduced motion disables *decorative* CSS (pulse/pop/tick) only.
   - Step/hold pacing must stay so the walkthrough remains comprehensible.
   - `effectiveStepMs` must return the real dwell, not `0`.
3. **“Performance” and “smoother” do not mean faster frame clocks.**
   - Prefer compositor-friendly motion, batched React updates, rAF-aligned sleeps,
     and scroll-follow for focused nodes.
   - Do **not** “optimize” by shrinking step/hold constants unless the user
     explicitly asks for faster demos.
4. **Passing e2e is not proof the animation is watchable.**
   - E2E only checks that final status text eventually appears.
   - Before PR: manually run Insert / Search / Delete and both index modes and
     confirm you can read each step message while it is on screen.
5. **Keep focused nodes on screen.**
   - Overflow tree panes must auto-scroll to the focused node during a walk.
   - Late keys (e.g. id `69`) were previously highlighted off-screen — treat
     that as a product bug, not a polish item.

## General PR gate (all changes)

Before opening or updating a PR:

- [ ] Re-read the user request; confirm the PR actually solves the stated problem
      on the first attempt (no “we can tune later” for core UX).
- [ ] If the change is visual, timed, or layout-sensitive: **watch it** in a
      running app on **desktop and mobile**, not only unit/e2e logs.
- [ ] Writing/MDX changes: skim the rendered post for raw LaTeX, broken tables,
      and unreadable code blocks.
- [ ] SVG / interactive demos: confirm roots are fully visible and wide trees
      scroll inside their cards on a ~390px viewport.
- [ ] If you touch animation timing: quote the step/hold values in the PR body
      and note that reduced-motion still keeps delays.
- [ ] If you previously shipped a regression in this area: say so in the PR and
      link the follow-up; do not quietly reintroduce the same shortcut.
- [ ] Unit tests + relevant Playwright specs green; bump e2e timeouts when you
      intentionally slow demos.
- [ ] PR description states user-visible behavior, not only implementation detail.

## Anti-patterns (do not ship)

- LaTeX/`\(...\)` in MDX without a math plugin.
- Dark `pre` + light inline-code chips (white highlight on dark pseudocode).
- Assuming markdown `| tables |` work without `remark-gfm`.
- SVG nodes at `y = 0` with a viewBox origin of `0` (clipped roots).
- `overflow-x-clip` / missing `min-w-0` that hides overflow instead of scrolling.
- Treating `prefers-reduced-motion` as “skip the whole demo.”
- Speeding up demos under a “performance” or “smoothness” banner.
- Relying on status-text e2e alone for animation or layout quality.
- Multiple tiny follow-up PRs for one avoidable mistake — get the visible
  behavior right before the first review request.

## Where the timing lives

| Constant | File | Used by |
|---|---|---|
| `VIZ_STEP_MS` / `VIZ_HOLD_MS` | `lib/btree/demo-animation.ts` | `BTreeVisualizer` |
| `INDEX_STEP_MS` / `INDEX_HOLD_MS` | `lib/btree/demo-animation.ts` | `BTreeIndexDemo` (index mode) |
| `DEMO_STEP_MS` / `DEMO_HOLD_MS` | `lib/btree/demo-animation.ts` | `BTreeIndexDemo` (table scan) |
| Decorative motion CSS | `app/globals.css` | pulse / key-pop / io-tick / reduced-motion |

## Where the layout / MDX contracts live

| Concern | File(s) |
|---|---|
| GFM tables + MDX render | `app/writing/[slug]/page.tsx` (`remark-gfm`) |
| `pre` / `code` / `table` styles | `components/content/mdx/components.tsx` |
| Tree SVG layout bounds | `lib/btree/btree.ts` (`layoutTree`) + `lib/btree/btree.test.ts` |
| Demo shells / scroll panes | `BTreeVisualizer.tsx`, `BTreeIndexDemo.tsx` |
| Authoring notes | `docs/authoring-guide.md` |

When in doubt: **readable on a phone beats clever in source.**
Slower walkthroughs beat faster clocks.
