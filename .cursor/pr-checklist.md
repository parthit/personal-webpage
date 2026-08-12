# PR checklist (read before opening a PR)

Agents and humans: read this before creating or updating a pull request.
It exists because work repeatedly shipped as “done” while still broken for real
viewers, and each miss cost another round of back-and-forth.

## Principles

1. **Judge the rendered experience, not the source.**
   If a human cannot see, read, or use the result in a running app, it is not
   fixed — even when the markdown/code “looks right” or unit/e2e checks pass.

2. **Verify on real viewports before calling layout done.**
   Check desktop and a narrow phone width. Clip, overflow, contrast, and control
   crowding show up there first. Green CI is not a substitute for looking.

3. **Only ship formats and features the pipeline actually supports.**
   Do not assume markdown extensions, math syntax, or embeds work unless the
   site is wired for them. Confirm in the rendered page, not in the editor.

4. **Overflow must remain usable.**
   Important content should not be silently cropped. If something is wider than
   its container, users need a clear way to reach it (usually in-card scroll),
   without breaking the whole page sideways.

5. **Interactive teaching UI must be paced for humans.**
   Educational walkthroughs should be slow enough to follow. “Snappy,”
   “optimized,” or “smoother” is not permission to make steps unreadable.
   Accessibility preferences may drop decoration; they should not gut the lesson.

6. **Solve the user’s stated problem in one pass.**
   Do not land a partial fix and plan to “tune later” for core UX. Avoid a trail
   of tiny follow-up PRs for the same visible failure mode.

7. **Describe what the user will notice.**
   PR writeups should state the visible behavior change, not only internals.

## Before you open or update a PR

- [ ] Re-read the request: does this change actually solve it for a viewer?
- [ ] For visual, timed, or layout-sensitive work: watch it in a running app on
      desktop and mobile.
- [ ] For content: skim the rendered page for unreadable text, broken structure,
      and unusable interactive bits.
- [ ] Tests relevant to the change are green — and you did not treat them as the
      only quality bar for UX.
- [ ] If this area regressed before, say so and do not reintroduce the same shortcut.

## Anti-patterns

- Declaring victory from source review or CI alone
- Shipping syntax the renderer does not understand
- Hiding overflow instead of making it reachable
- Speeding up teaching demos under a “performance” banner
- Treating reduced-motion as “skip the experience”
- Drip-feeding fixes across many PRs for one avoidable mistake

When in doubt: **what a person can see and follow beats what looks clever in code.**
