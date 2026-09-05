# Optimization review — 2026-09-05

What the repository-wide optimization review recommended, what landed in this
pass, and what was deliberately left alone (with the reason, so the next pass
does not re-litigate it from scratch).

## Landed

### P0 — deterministic installs

`npm ci` failed from a clean checkout with `Missing: json-schema-traverse@0.4.1
from lock file`. The lockfile was generated under npm's legacy peer-dependency
algorithm (the R3F stack needs it), but a bare `npm ci` takes no flags and
resolved a different tree. CI papered over this by running `npm install
--legacy-peer-deps`, which succeeds by *rewriting the lockfile in place* — so
every CI run built from a slightly different dependency graph and no bundle or
performance number was comparable to the one before it.

- `.npmrc` pins `legacy-peer-deps=true`, so every install path — local,
  devcontainer, CI — resolves the tree the lockfile actually describes.
- CI, the devcontainer and the docs now run `npm ci`.
- Node is pinned to 20 in `.nvmrc`, `engines`, CI and the devcontainer, which
  previously disagreed (18 / 18 / 20).
- The build job now runs `npm run bundle:check`, which it never did.

Verified: `npm ci` from an empty directory with only `package.json`,
`package-lock.json` and `.npmrc` succeeds, and fails without `.npmrc`.

### P1 — render loops no longer schedule React work per frame

| Where | Was | Now |
|---|---|---|
| `Level10Cutscene` | `setEmissive(...)` every frame re-rendered 98 cubies (~250 sticker elements) for 15 seconds | shared per-colour materials, mutated directly; `CutsceneCubie` is memoised and renders once |
| `Level10Cutscene` | `setBlackHolePulse(Date.now())` on every frame inside a 1%-wide progress band | one commit per beat, re-armed on replay |
| `useHolonomyMode` | `setTwist(...)` every frame | `twistRef`, read by the renderer |
| `HolonomyTracer` swirl field | a fresh `BufferGeometry` **per face per frame**, never disposed — a GPU leak, not just garbage | one geometry per face for its lifetime, position attribute rewritten in place, disposed on unmount |

The cutscene's material sharing also collapses ~350 per-sticker GPU resources
into two geometries and seven materials.

### P1 — no allocations in particle frame loops

- `WormParticle` allocated ~10 `Vector3`s and a `CatmullRomCurve3` per instance
  per frame. Waypoints and the curve are now allocated once per worm and mutated
  in place (`CatmullRomCurve3.getPoint` reads `points` on every call and caches
  nothing, so this is equivalent); `getPoint` writes into scratch targets.
- `TunnelSparkShower` allocated three `Vector3`s per frame; those are module
  scratch now.

Both use module-level scratch that is only ever touched inside a single
synchronous `useFrame` body, matching the pattern already established in this
directory.

### P1 — bundle budgets measure the route, not just the file

`scripts/check-bundle-size.mjs` kept its per-asset ceilings and gained:

- **initial-route aggregate**, walked from the Vite build manifest
  (`build.manifest` is now on) following *static* imports only — dynamic imports
  are exactly what `React.lazy` defers, so counting them would make the budget
  meaningless. Measured raw **and Brotli**, plus a request count.
- **largest lazy chunk** ceiling, so an optional mode stays optional.
- `--report` mode that prints the numbers without enforcing them, for trends.

Baseline at time of writing: **7 files, 2152.0 KB raw, 568.8 KB brotli**;
budgets 10 / 2300 KB / 640 KB. Largest lazy chunk: `HealerWormMode` at 223 KB.

The graph walk lives in `scripts/bundleGraph.mjs` as pure functions and is unit
tested (`src/__tests__/bundleGraph.test.js`) — cycles, dangling imports, diamond
imports, and the dynamic-import exclusion.

### P3 — smaller items

- `handleSaveState` uses `structuredClone` instead of a JSON round-trip.
- Biome GLB paths, merge-mode PNG paths, and every PWA path (`start_url`,
  `scope`, `navigateFallback`, the media runtime-cache regex) now derive from the
  deploy base instead of repeating the `/WORM-3/` literal. `VITE_BASE` overrides
  it, so an optimized-asset experiment can be smoke-tested under a preview base
  or CDN prefix without editing source.

## Deliberately not done

### PWA precaching (P1 in the review) — the recommendation conflicts with a recorded incident

The review recommends precaching only the app shell and runtime-caching optional
hashed chunks. The comment in `vite.config.js` records why precaching is
exhaustive: GitHub Pages replaces `dist/` wholesale, so a deploy **deletes** the
old hashed chunks. A client holding a precached `index.html` from the previous
deploy that has never opened, say, Teach Mode would then fail its lazy import —
the blank-menu/reload-loop failure the current strategy was introduced to fix.
`registerType: 'prompt'` makes this worse, not better: a client can sit on the
old build for as long as it likes.

Making this safe needs a deploy that retains N previous builds' assets (or a
fallback that force-updates the worker on a failed chunk fetch). That is a
deployment change, not a config tweak, so it should be its own task rather than a
side effect of an optimization pass.

### Media pipeline (P1) — needs asset tooling and art review

`public/` is 261 MB, topped by a ~26 MB EXR and a ~25.6 MB GLB. The fix
(`gltf-transform` with Meshopt/Draco, KTX2/Basis textures, downsampled
environment maps) is the single largest win available, but it changes what
players see and needs a visual sign-off per asset plus tooling this repo does not
yet carry. The `VITE_BASE` work above is the prerequisite that landed here.

### Mode exclusivity (P2), monolith splitting (P2), `src/coming-soon` (P2)

Behaviour-affecting refactors with a real regression surface. `getActiveMode`
resolving conflicting flags for display only is a genuine hazard, but converting
the independent booleans into one discriminated `activeMode` touches every mode's
enter/exit path and deserves its own change with its own transition tests.
`src/coming-soon` (12 files, ~2,700 lines) is unreachable from runtime imports —
deleting or archiving it is a call for whoever owns that prototype, not a
janitorial side effect.

### Note on the review's P0 diagnosis

The review reported the clean install failing on Node 24.15.0 / npm 11.4.2 and
attributed it to an AJV graph mismatch. The failure reproduces on Node 22 / npm
10.9.7 as well, and the cause is the peer-resolution mode rather than the Node
version — which is why the `.npmrc` pin fixes it rather than a lockfile
regeneration alone.

## Verified

- `npm run ci` green: 0 lint errors, 86 test files / 1417 tests, build, budgets.
- Browser smoke (Chromium, dev server): welcome → main menu → Start Demo renders
  and animates; the only console errors are the documented sandbox HDR fetch
  failures.
- Holonomy mode and the Level 10 cutscene were each driven in isolation through a
  temporary probe page (removed): the swirl field renders and animates, the
  tracer accumulates seams and flips parity, and the cutscene runs all four
  phases to completion with correct per-face colours.

## Still open, in priority order

1. Media pipeline (transfer, decode, GPU memory).
2. PWA precache scope, once deploys retain previous builds' assets.
3. Mode exclusivity as a single discriminated state.
4. Coverage thresholds and browser performance scenarios (menu startup, 7×7
   chaos, healer worm, biome switching, Level 10) capturing long tasks, p95 frame
   time, React commits, draw calls and renderer memory.
5. Splitting the critical monoliths (`App.css` 4,194 lines, `StickerPlane.jsx`
   2,463, `wormSim.js` 2,006, `App.jsx` 1,811) along render/simulation seams,
   opportunistically when touched.
