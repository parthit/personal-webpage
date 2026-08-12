# PR checklist (read before opening a PR)

Agents and humans: consult this file before creating or updating a pull request.
It exists because interactive B-tree demo work shipped “fixed” pacing that was
still near-instant for real viewers, and took multiple follow-up PRs to correct.

## Hard rules from the B-tree demo incident

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
- [ ] If the change is visual or timed: **watch it** in a running app, not only
      unit/e2e logs.
- [ ] If you touch animation timing: quote the step/hold values in the PR body
      and note that reduced-motion still keeps delays.
- [ ] If you previously shipped a regression in this area: say so in the PR and
      link the follow-up; do not quietly reintroduce the same shortcut.
- [ ] Unit tests + relevant Playwright specs green; bump e2e timeouts when you
      intentionally slow demos.
- [ ] PR description states user-visible behavior, not only implementation detail.

## Anti-patterns (do not ship)

- Treating `prefers-reduced-motion` as “skip the whole demo.”
- Speeding up demos under a “performance” or “smoothness” banner.
- Relying on status-text e2e alone for animation quality.
- Multiple tiny follow-up PRs for one pacing mistake — get dwell right before
  the first review request.

## Where the timing lives

| Constant | File | Used by |
|---|---|---|
| `VIZ_STEP_MS` / `VIZ_HOLD_MS` | `lib/btree/demo-animation.ts` | `BTreeVisualizer` |
| `INDEX_STEP_MS` / `INDEX_HOLD_MS` | `lib/btree/demo-animation.ts` | `BTreeIndexDemo` (index mode) |
| `DEMO_STEP_MS` / `DEMO_HOLD_MS` | `lib/btree/demo-animation.ts` | `BTreeIndexDemo` (table scan) |
| Decorative motion CSS | `app/globals.css` | pulse / key-pop / io-tick / reduced-motion |

When in doubt: **slower and readable beats faster and clever.**
