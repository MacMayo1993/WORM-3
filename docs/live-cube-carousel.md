# Live cube carousel

The mode selector uses the existing physical, rotating six-face cube in the single shared WebGL canvas. The DOM stage is transparent; the paper grid is drawn behind the cube inside the scene. A measured stage rectangle fits the cube on phones, desktop and landscape, including when disclosures expand or scroll. Camera-relative presentation keeps depth visible off center.

The existing face selection, swipe/arrow controls, saved mode, animated launch dive, and mode entry flows remain. Controls use the shared typography tokens, tactile buttons, mode-colored dots and one primary action. The mode name stays on the cube rather than appearing as another heading below it.

Keyboard Enter respects disclosure summaries. Launch is blocked during the 150 ms selection transition. Cancelling WORM restores the mode selector for both Back and Escape.

## Live preview

Captured at 390×844 from the running app with the WebGL cube visible.

![Live cube carousel on a phone](live-cube-carousel-mobile.png)

## Artwork

All six decals are authored as reproducible Three.js scenes in `scripts/carousel-art/model.js`, then exported as 768×768 transparent WebP. The puzzle stickers come from `makeCubies(3)` and `rotateSliceCubies`; no sticker colors are invented or painted independently.

| Mode | Image |
| --- | --- |
| WORM | Solved 3×3 with a green worm resting on top |
| CUBE | Legal three-turn scramble |
| TEACH | Solved 3×3 with a golden turn arrow |
| CHAOS | Legal scramble with one intact outer layer partway through a turn |
| RANDOM | A different legal scramble with two directional arrows |
| STORE | Gift box with a ribbon; no puzzle stickers |

The recipe lists every completed move. Tests reverse each sequence back to the solved cube, check all 54 stickers and their face normals, and verify that the turning layer contains exactly nine intact cubies. These are decorative mode illustrations, not algorithm instructions.

To re-render, install the optional authoring browser without changing the project dependencies:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node scripts/render-carousel-art.mjs
```

The exporter also accepts `PLAYWRIGHT_MODULE`, `CHROMIUM_EXECUTABLE` and `CHROMIUM_ARGS` for an existing browser installation. It uses the local Vite base and no remote assets. The renderer and its environment stay outside the application bundle; the live carousel only loads the exported images onto its existing faces.
