# Asset credits and licences

What third-party material ships in WORM³, where it came from, and what is still unconfirmed. Audited 2026-10-08 from the files themselves (embedded metadata) and the lockfile; nothing here was taken on trust from file names alone unless it says so.

**Why this matters before a public release.** The repo's `LICENSE` (MIT) covers the code. It does not cover the art in `public/`. Nine of the models are **CC BY 4.0**, which is only usable if the game credits each author, links the licence and says what was changed. Until this audit the game did none of that. It now does (Settings → About, from `src/utils/credits.js`), and `src/__tests__/assetCredits.test.js` keeps it true: it reads each model's own metadata and fails if the credits drift from it, or if a new asset lands in `public/` without an entry.

## 1. 3D models (`public/models/biomes/`)

| File | Title | Author | Licence | Status |
|---|---|---|---|---|
| `Blue/island.glb` | Low Poly Medieval Island | Boooooop | CC BY 4.0 | Credited in app |
| `Blue/oceanwave.glb` | Ocean Wave - w/Maya | Twin Dragon Studios | CC BY 4.0 | Credited in app |
| `Green/grass.glb` | Grass | MauroGonzalezA | CC BY 4.0 | Credited in app |
| `Orange/base.sand.glb` | sand/lanshaft_17k_face | hram356 | CC BY 4.0 | Credited in app |
| `Orange/colosseum.glb` | Colosseum/Flavian Amphitheatre | juanardanaz | CC BY 4.0 | Credited in app |
| `Red/volcano.glb` | Volcano V1 | JayT3D | CC BY 4.0 | Credited in app |
| `White/snowglobe.glb` | Snow Globe | celestial fox | CC BY 4.0 | Credited in app |
| `Yellow/cloud.glb` | Cloud | RandyGF | CC BY 4.0 | Credited in app |
| `Yellow/floatingisland.glb` | Floating Island With Roots And Rocks | Dennis | CC BY 4.0 | Credited in app |
| `Green/GreenManifold4-tree.glb` | — | — | **unknown** | **Unverified** (see below) |

Title, author, source URL and licence for the nine come from the `asset.extras` block Sketchfab writes into every download, so they are what the files themselves say. Source links are in `src/utils/credits.js`.

**Changes made** (CC BY asks that they be stated): the models are scaled to fit a tile, rotated, jittered and repeated, and their materials are forced opaque (`BiomeGLBCluster.jsx`). The in-app text says so. If anyone edits a model in a DCC tool, add what changed.

**`GreenManifold4-tree.glb`** was exported by `THREE.GLTFExporter` and carries no author or licence. It may be your own work, or a derivative of someone else's. Whoever made it should confirm, and either credit it or record it as original. Until then it is listed as unverified and the guard test will tell you if the file ever gains embedded provenance.

## 2. Environment maps (`public/environments/`)

| File | Size | Source |
|---|---|---|
| `lounge.exr` | 25 MB | **Poly Haven, "Aft Lounge"** (CC0). The EXR header records the Poly Haven conversion command. Credited in app. |
| `umbrella.exr` | 21 MB | **Poly Haven, "Outdoor Umbrellas"** (CC0). Same evidence. Credited in app. |
| `beach.hdr` | 21 MB | Unverified: no provenance in the file |
| `cave.exr` | 7.5 MB | Unverified |
| `cobblestone.exr` | 2.3 MB | Unverified |
| `desert.exr` | 2.2 MB | Unverified |
| `fireplace.exr` | 22 MB | Unverified |
| `forest.exr` | 9.6 MB | Unverified |
| `paris.exr` | 23 MB | Unverified |
| `shanghai.exr` | 4.9 MB | Unverified |
| `snow.exr` | 2.0 MB | Unverified |
| `stadium.exr` | 7.6 MB | Unverified |
| `sunset.exr` | 4.1 MB | Unverified |

The file names resemble common Poly Haven and similar HDRI libraries, but a name is not evidence, so they are not credited on a guess. Environment maps from Poly Haven are CC0 (no credit required); other libraries are not all so permissive, and some forbid redistributing the raw files, which is what a `public/` folder does. Each needs its source confirmed.

`environments/thumbnails/` holds generated previews of the above; they inherit each map's status.

### Runtime third-party fetch

`SafeEnvironment` loads one more environment map at runtime, `potsdamer_platz_1k.hdr`, through drei's `Environment` preset. That resolves to `raw.githack.com/pmndrs/drei-assets/...`, a third-party CDN, on every cold start. The game continues without reflections when it fails to load (it logged exactly that in every blocked-network run), but a public release depends on that host's uptime and privacy practices. It is a Poly Haven CC0 map, so self-hosting it in `public/` is allowed and removes the dependency.

## 3. Images and art

| Path | Status |
|---|---|
| `public/images/modes/*.jpg` | Gameplay screenshots per `public/images/modes/README.md`. Original, if taken from this game. Confirm. |
| `public/images/arcade/*.webp` | The carousel illustrations. `docs/carousel-art-prompts.json` holds generation prompts, so these appear to be **AI-generated**. Confirm the tool, that its terms allow commercial use, and whether any storefront you plan to use requires disclosure. |
| `public/Mobi.png`, `Mobi.webp`, `src/assets/mobi.json` | The Mobi character (the JSON is a Rive/Lottie export). Confirm authorship. |
| `public/projectiscope/index.html` | A self-contained page with no external requests. Confirm it is original. |

## 4. Fonts

Bungee, Nunito and Outfit are bundled through Fontsource under the **SIL Open Font License 1.1**. The OFL allows bundling and redistribution; it asks that the copyright notice and licence travel with the font, which the in-app credits line and the package metadata cover. `@fontsource/annie-use-your-telescope` is a dependency but nothing imports it, so it ships nothing; consider removing it.

## 5. Software (production dependencies, 100 packages)

Read from each package's own `package.json`, transitive dependencies included:

| Licence | Packages |
|---|---|
| MIT | 81 |
| Apache-2.0 | 5 (`@mediapipe/tasks-vision`, `promise-worker-transferable`, `hls.js`, `@dimforge/rapier3d-compat`, `draco3d`) |
| ISC | 5 (including `kociemba-wasm`, `n8ao`) |
| OFL-1.1 | 4 (the fonts above) |
| BSD-3-Clause | 2 |
| Zlib | 1 (`postprocessing`) |
| GSAP "Standard no charge" licence | 1 (`gsap`: free for commercial use, but not an OSI licence, and not allowed in a product that competes with GSAP's owner's visual animation tools) |
| No `license` field | 1 (`webgl-constants`; its `LICENSE` file is MIT) |

No GPL, AGPL or other copyleft licence is in the production tree. Apache-2.0 packages ask that their `NOTICE` text be kept if they have one.

## 6. Housekeeping

Three one-byte placeholder files are tracked and unreferenced: `public/models/biomes/Green/cabin.glb`, `public/models/biomes/Green/tree.glb` and `public/environments/test`. The code already notes `cabin.glb` is "not a valid GLB". They can be deleted.

## What still needs a human

In order of how much they could hurt:

1. Confirm the source and licence of the **eleven unverified environment maps**, or replace them with maps whose licence you can state (Poly Haven is the easy answer). Several are also 20 MB+; replacing them is a chance to ship 2K versions.
2. Confirm **`GreenManifold4-tree.glb`**.
3. Confirm the **AI-generated carousel art** terms and any disclosure rule for your storefront.
4. Confirm authorship of **Mobi** and **projectiscope**.
5. Self-host the one runtime environment map.
6. Decide whether you want a longer, stand-alone licences file (npm package notices) for distribution; the in-app credits cover the attribution-required items and name the rest.

## Keeping it true

Adding an asset to `public/models` or `public/environments` fails `assetCredits.test.js` until it is credited (`src/utils/credits.js`) or explicitly listed as unverified, and until its file name appears in this document.
