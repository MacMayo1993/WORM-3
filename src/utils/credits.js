// Who made the third-party art WORM³ ships, and under what terms.
//
// The nine 3D biome models are CC BY 4.0 (Sketchfab), which makes crediting the
// author, linking the licence and saying what was changed a condition of using
// them, not a courtesy. `assetCredits.test.js` reads each model's own embedded
// Sketchfab metadata and fails if this list drifts from it, and fails when a new
// asset lands in public/ without an entry, so the credits screen cannot quietly
// fall behind the files. docs/ASSET_CREDITS.md has the full inventory, including
// what could not be verified.

export const CC_BY_4 = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };

// Paths are relative to public/. `title`, `author` and `source` are what the file
// itself says (extras on its glTF asset block).
export const MODEL_CREDITS = [
  { file: 'models/biomes/Blue/island.glb', title: 'Low Poly Medieval Island', author: 'Boooooop', authorUrl: 'https://sketchfab.com/boooop',
    source: 'https://sketchfab.com/3d-models/low-poly-medieval-island-361f02265937462a8969d78c5be1fc6c' },
  { file: 'models/biomes/Blue/oceanwave.glb', title: 'Ocean Wave - w/Maya', author: 'Twin Dragon Studios', authorUrl: 'https://sketchfab.com/RHALL',
    source: 'https://sketchfab.com/3d-models/ocean-wave-wmaya-03f0559f6b7646ea9014e2e72f71b198' },
  { file: 'models/biomes/Green/grass.glb', title: 'Grass', author: 'MauroGonzalezA', authorUrl: 'https://sketchfab.com/MauroGonzalezA',
    source: 'https://sketchfab.com/3d-models/grass-4b800e07ea3543e3870ad5e53b39d825' },
  { file: 'models/biomes/Orange/base.sand.glb', title: 'sand/lanshaft_17k_face', author: 'hram356', authorUrl: 'https://sketchfab.com/hram356',
    source: 'https://sketchfab.com/3d-models/sandlanshaft-17k-face-995d73e400d840f681502dcf9c097fb1' },
  { file: 'models/biomes/Orange/colosseum.glb', title: 'Colosseum/Flavian Amphitheatre', author: 'juanardanaz', authorUrl: 'https://sketchfab.com/JuanArdanaz',
    source: 'https://sketchfab.com/3d-models/colosseumflavian-amphitheatre-c3d2ef72566343139fcf9d5d8cfad5dd' },
  { file: 'models/biomes/Red/volcano.glb', title: 'Volcano V1', author: 'JayT3D', authorUrl: 'https://sketchfab.com/beardyjosh',
    source: 'https://sketchfab.com/3d-models/volcano-v1-cf92d35ac0c34b71a44870959ed3abc3' },
  { file: 'models/biomes/White/snowglobe.glb', title: 'Snow Globe', author: 'celestial fox', authorUrl: 'https://sketchfab.com/celestialfox',
    source: 'https://sketchfab.com/3d-models/snow-globe-090bfce9ce394b11bcef261636827b94' },
  { file: 'models/biomes/Yellow/cloud.glb', title: 'Cloud', author: 'RandyGF', authorUrl: 'https://sketchfab.com/RandyGF',
    source: 'https://sketchfab.com/3d-models/cloud-3a76eb255e3c4c0199bbfedb2b54342f' },
  { file: 'models/biomes/Yellow/floatingisland.glb', title: 'Floating Island With Roots And Rocks', author: 'Dennis', authorUrl: 'https://sketchfab.com/dennis.hafemann',
    source: 'https://sketchfab.com/3d-models/floating-island-with-roots-and-rocks-4c05ffef4d1c45ab847ac565b8184a5b' }
];

// CC BY 4.0 asks that changes be indicated. biomes are placed through BiomeGLBCluster.jsx.
export const MODEL_CHANGES = 'Scaled, rotated and repeated as biome backdrops, with materials made opaque for display.';

// Environment maps whose source is confirmed by the file itself: their EXR header
// records the Poly Haven conversion command (`phcloud/.../aft_lounge_4k`).
// Poly Haven publishes under CC0, which needs no credit; they get one anyway.
// The other maps in public/environments carry no provenance and are listed as
// unverified in docs/ASSET_CREDITS.md rather than credited on a guess.
export const ENVIRONMENT_CREDITS = [
  { file: 'environments/lounge.exr', title: 'Aft Lounge', slug: 'aft_lounge' },
  { file: 'environments/umbrella.exr', title: 'Outdoor Umbrellas', slug: 'outdoor_umbrellas' }
];
export const ENVIRONMENT_SOURCE = { name: 'Poly Haven', url: 'https://polyhaven.com/', license: 'CC0' };

// Files in public/ that ship without a verified source. Each is called out in
// docs/ASSET_CREDITS.md for the owner to resolve; the guard test refuses any new
// asset that is in neither this list nor the credits above.
export const UNVERIFIED_ASSETS = [
  'models/biomes/Green/GreenManifold4-tree.glb',   // exported by THREE.GLTFExporter; no author or licence embedded
  'environments/beach.hdr',
  'environments/cave.exr',
  'environments/cobblestone.exr',
  'environments/desert.exr',
  'environments/fireplace.exr',
  'environments/forest.exr',
  'environments/paris.exr',
  'environments/shanghai.exr',
  'environments/snow.exr',
  'environments/stadium.exr',
  'environments/sunset.exr'
];

export const FONT_CREDITS = ['Bungee', 'Nunito', 'Outfit'];
export const FONT_LICENSE = { name: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org/' };

export const SOFTWARE_CREDITS = ['three.js', 'React', 'React Three Fiber', 'drei', 'postprocessing', 'GSAP', 'Zustand', 'kociemba-wasm'];
