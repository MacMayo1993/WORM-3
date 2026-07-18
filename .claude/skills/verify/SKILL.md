---
name: verify
description: Build, launch, and drive WORM-3 in a browser to verify changes at the real UI.
---

# Verifying WORM-3

## Launch

```bash
npm install --legacy-peer-deps        # once
npm run dev                            # Vite on http://localhost:5173/WORM-3/  (note the /WORM-3/ base path)
```

## Drive (Playwright)

- Install playwright in a scratch dir (`npm i playwright`), then launch with the
  pre-installed browser: `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`
  — `npx playwright install` will fail / mismatch versions.
- Mobile: `devices['Pixel 7']` context.
- Entry flow: ENTER button on the welcome screen → main menu → "Start Demo" button.

## Gotchas

- Several demo buttons have `aria-label`s that differ from their visible text —
  `getByRole('button', { name })` matches the label, not the text:
  "Skip All ▶" is `Skip views`, step-intro skip is `Skip step`.
- The demo forecast picker's skip is exactly `Skip ▶`.
- HDR environment (`potsdamer_platz_1k.hdr`) fails to fetch in the sandbox
  (proxy) — SafeEnvironment falls back; the pageerror is environmental noise.
- Fresh profile: first flip normally triggers the first-flip tutorial;
  suppressed in demo mode (see useCubeState.js).

## Flows worth driving

- Full demo: ENTER → Start Demo → per-step Mobi dialogue (Next ▶ … ▶ Start) →
  coach "Next ▶" pill → step 4 spotlighted Views button → worm step (pill after
  first tunnel, up to ~60s) → forecast picker Skip ▶ → store on step 8.
