# Live cube carousel

The mode selector uses the existing physical, rotating six-face cube in the single shared WebGL canvas. The DOM stage is transparent; the paper grid is drawn behind the cube inside the scene. A measured stage rectangle fits the cube on phones, desktop and landscape, including when disclosures expand or scroll. Camera-relative presentation keeps depth visible off center.

The existing face selection, swipe/arrow controls, saved mode, animated launch dive, and mode entry flows remain. Controls use the shared typography tokens, tactile buttons, mode-colored dots and one primary action. The mode name stays on the cube rather than appearing as another heading below it.

Keyboard Enter respects disclosure summaries. Launch is blocked during the 150 ms selection transition. Cancelling WORM restores the mode selector for both Back and Escape.

## Live preview

Captured at 390×844 from the running app with the WebGL cube visible.

![Live cube carousel on a phone](live-cube-carousel-mobile.png)

## Artwork

Generated with the built-in image tool, then resized to 768×768 WebP with transparency. Project assets:

- `public/images/arcade/worm.webp`
- `public/images/arcade/cube.webp`
- `public/images/arcade/chaos.webp`
- `public/images/arcade/teach.webp`

Teach uses a small blue cube guide from the approved mockup. Random and Store reuse the cube illustration. The illustrations are painted onto cube-face textures; they are never DOM hero images. Vector decals remain as loading/offline fallbacks. All asset URLs respect Vite's deployment base.

Prompt template:

> Use case: stylized-concept. Asset type: production transparent mobile game hero artwork for WORM³ Pocket Arcade. Subject: [subject below] Style: premium playful soft 3D toy render, beveled glossy plastic with soft warm studio lighting, clear forms, tactile highlights, candy colors. Centered square composition fills 90% of canvas, entire object visible, transparent background, subtle tight contact shadow only. NO background scene, NO labels, NO text, NO UI, NO frame, NO watermark. Render with the polish of the approved mobile game card mockup.

Subjects:

- **Worm:** One adorable lime green segmented worm with exactly ONE head, two big expressive eyes and small smile, tail is round tapered WITHOUT eyes or face. Worm crawls in a smooth arch across the top of a chunky rounded 3x3 puzzle cube with ivory, emerald green, royal blue, yellow and coral red tiles. 3/4 view shows cube top and two sides, hero product illustration.
- **Cube:** A single chunky rounded 3x3 puzzle cube, slightly unsolved with ivory, royal blue, yellow, emerald green and coral red tiles, top layer turned 20 degrees. 3/4 view shows cube top and two sides. No creatures, no extra props, no arrows.
- **Chaos:** A chunky rounded 3x3 puzzle cube dramatically exploding into a controlled cluster of 15 floating colorful rounded cubelets, navy charcoal, coral red and golden yellow, some blue. Strong central silhouette, playful sparkling burst action, no text.

Teach prompt:

> Use case: stylized-concept. Asset type: production transparent hero artwork for the TEACH mode of WORM³ Pocket Arcade. A chunky, beautifully rounded glossy 3x3 puzzle cube in three-quarter view, ivory tiles with a few bright blue, yellow, coral red and green tiles. In front of it at bottom left stands a very small friendly translucent sky-blue cube character, with large black eyes, tiny smiling mouth, small blue arms and feet. The cube character is one fifth the size of the puzzle cube. One smooth golden yellow curved arrow floats at the right of the large cube, suggesting a turn. Style: premium playful soft 3D mobile game toy render, beveled plastic, warm studio highlights, candy colors. Centered square composition, entire scene visible with tight framing filling 90% of canvas. Genuinely transparent background, subtle tight contact shadow only. No text, no letters, no UI, no frame, no watermark. This is decorative mode-card artwork, not an algorithm diagram.
