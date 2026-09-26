# Live cube carousel

The mode selector uses the existing physical, rotating six-face cube in the single shared WebGL canvas. The DOM stage is transparent; the paper grid is drawn behind the cube inside the scene. A measured stage rectangle fits the cube on phones, desktop and landscape, including when disclosures expand or scroll. Camera-relative presentation keeps depth visible off center.

The existing face selection, swipe/arrow controls, saved mode, animated launch dive, and mode entry flows remain. Controls use the shared typography tokens, tactile buttons, mode-colored dots and one primary action. The mode name stays on the cube rather than appearing as another heading below it.

Keyboard Enter respects disclosure summaries. Launch is blocked during the 150 ms selection transition. Cancelling WORM restores the mode selector for both Back and Escape.

## Text-only faces

Each colored face shows only its centered mode title: WORM, FLIP CUBE, TEACH, CHAOS, RANDOM or STORE. Longer names use smaller type to fit on one line. The carousel does not create illustration textures or request the mode pictures.

The previous artwork assets, prompts in `carousel-art-prompts.json`, and `live-cube-carousel-mobile.png` are retained as historical references. The screenshot predates the text-only layout. The geometric artwork authoring tools remain in `scripts/carousel-art/` and `scripts/render-carousel-art.mjs`.
