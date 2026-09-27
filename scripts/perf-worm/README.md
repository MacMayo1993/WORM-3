# WORM performance harness

Drives a real WORM free-play run in headless Chromium and reports per-frame CPU cost, draw calls, GPU uploads, shader compiles and React commits. Every number in `docs/worm-mode-performance-audit-2026-09-27.md` came from these scripts, so a fix can be checked against the same measurement.

Nothing here ships: `scripts/` is outside the bundle and ESLint's scope, and Playwright is not a project dependency.

## Setup

```bash
# Playwright in a scratch directory (it is not a devDependency)
mkdir -p /tmp/pw && (cd /tmp/pw && npm init -y >/dev/null && npm i playwright@1)
export PLAYWRIGHT=/tmp/pw/node_modules/playwright/index.mjs
export CHROMIUM=/opt/pw-browsers/chromium   # the container's browser; omit to use Playwright's own
```

Measure a **production** build for absolute numbers (development React is several times slower to reconcile):

```bash
npx vite build --config scripts/perf-worm/vite.perf.config.mjs     # → dist-perf/ (gitignored)
npx vite preview --config scripts/perf-worm/vite.perf.config.mjs --port 4173
```

That config is the deploy config, unminified (so profiles keep function names) with `window.__store` exposed. The dev server works too (`npm run dev`, default `--url`), and its component names are the easiest to read.

## Modes

```bash
node scripts/perf-worm/run.mjs --mode=frames    --url=http://localhost:4173/WORM-3/ --ms=45000
node scripts/perf-worm/run.mjs --mode=frames    --url=... --throttle=4          # mid-range-phone CPU proxy
node scripts/perf-worm/run.mjs --mode=frames    --url=... --profile             # + CPU self time by function
node scripts/perf-worm/run.mjs --mode=attribute --url=... --ms=20000            # draws/uploads/compiles by component
node scripts/perf-worm/run.mjs --mode=react     --url=... --ms=20000            # which components re-render
node scripts/perf-worm/run.mjs --mode=ab        --url=... --seq=base,A,B,AB     # price a fix on a frozen scene
```

Common flags: `--size=5` (board size in the wizard), `--mobile` (412×915 touch viewport), `--draw` (keep real draw calls), `--out=result.json`.

| Mode | Output |
| --- | --- |
| `frames` | fps, script ms per frame (p50/p95/mean/max), draws, triangles, program switches, uniform calls, upload KB, shader links, React commit rate and the extra script time on frames that carry a commit, phase histogram, heap |
| `attribute` | render passes; draws and triangles per frame by owning component; uploads by attribute; materials that force three.js back through program selection every frame; every shader link attributed to the draw that triggered it |
| `react` | commit rates plus render counts per component (DOM root and R3F root) |
| `ab` | pauses the run so every window renders the same scene, then toggles in-page patches: **A** transparent double-sided materials in one pass, **B** instanced attributes upload only the live range, **C** hidden subtrees skip world-matrix updates, **D** inward-facing antipodal sticker backs hidden |

## What the numbers mean

- **Draw calls are suppressed by default.** In a container WebGL runs on SwiftShader, and rasterisation would gate every frame (about 2 fps, and 95% of the JS profile shows as native "(program)"). Suppression skips only the `draw*` calls. three.js still does all its CPU work per frame (culling, sorting, program selection, uniform and buffer uploads), and so do React and every `useFrame`. `script` is therefore the main thread's per-frame CPU cost. It is not GPU time. Pass `--draw` on a machine with a real GPU.
- `--throttle=4` is Chrome's CPU throttling, the usual stand-in for a mid-range phone. It says nothing about that phone's GPU or thermals.
- Shader links are counted on the main thread. On a real device the driver compile runs on top, so each link costs more than it does here.
- Runs retry automatically after a death. `phases` shows how many frames fell in each state (`gamePhase|wormPhase|turning|element|FX tier`), so a window that wandered into the death screen is visible.
- Tunnel rides are not exercised: the scripted worm never deliberately jumps onto a raised flipped tile.
