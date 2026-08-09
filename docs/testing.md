# Testing

This project uses [Playwright](https://playwright.dev/) for end-to-end coverage of the personal site and content system.

## What the E2E suite covers

| Area | Spec | Assertions |
|---|---|---|
| Navigation | `e2e/navigation.spec.ts` | Primary nav on all pages, active states, full browse journey |
| Home | `e2e/home.spec.ts` | About copy, social links, writing/video teasers |
| Writing | `e2e/writing.spec.ts` | Index metadata, MDX body, cover/diagram images, YouTube embed, 404, SEO meta |
| Videos | `e2e/videos.spec.ts` | Featured catalog, facade thumbnail, click-to-iframe, outbound YouTube link |
| Chat | `e2e/chat.spec.ts` | Booking page shell + nav (does not assert Cal.com remote UI) |

Projects:

- `chromium` — desktop Chrome
- `mobile-chrome` — Pixel 7 viewport (same Chromium engine)

## Local commands

```bash
# Install browsers once (CI does this automatically)
npx playwright install chromium --with-deps

# Run the suite against a production build
npm run test:e2e

# Interactive debugger
npm run test:e2e:ui

# Open the last HTML report
npm run test:e2e:report
```

`playwright.config.ts` starts the app via `webServer`:

- Locally: `npm run build && next start` (or reuses a server already on port 3000)
- CI: expects `npm run build` to have already run, then starts `next start`

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

1. **Lint and build** — `npm ci`, `npm run lint`, `npm run build`
2. **End-to-end tests** — install Chromium, rebuild, `npm run test:e2e`
3. On E2E failure, uploads `playwright-report/` and `test-results/` artifacts

## Writing new E2E tests

1. Prefer user-visible flows (`getByRole`, `getByText`) over CSS internals
2. Put shared demo constants/helpers in `e2e/helpers.ts`
3. Assert images with `expectImageLoaded` so broken media fails loudly
4. Avoid depending on third-party remote UI (Cal.com, YouTube player chrome) beyond what we control (facade button, iframe `src`/`title`)
5. Keep tests independent — no shared mutable state between files

## Future extensions

- Add a content-loader unit suite if frontmatter validation grows
- Shard Playwright jobs if the suite becomes slow
- Add visual regression only if layout contracts matter more than content contracts
