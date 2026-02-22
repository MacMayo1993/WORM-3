# BIOME MODE — WORM³-CUBE Full Implementation Spec

## Concept

Biome Mode places a living 3D city on each of the cube's 6 faces. Each city has a distinct architectural identity driven by its face's base color. When the player rotates a slice, adjacent face edges begin **asymmetric seam pulsing** — each city's border tiles flash in their own city color, at a frequency and rhythm determined by the color relationship between the two cities meeting at that seam. Antipodal city pairs (opposite faces) pulse at the same frequency even when not physically adjacent — they remain entangled through the manifold.

**Flip mode works.** Chaos mode is disabled. No win state — purely generative and exploratory. No neighbor merge mechanics yet (planned for future). No city evolution over time yet (planned for future). No tile style shaders driving city identity yet — the 3D building geometry IS the city for this phase.

---

## City Roster

Six cities, one per face, permanently assigned by face color. The player picks which city goes on which face in the setup wizard.

| City | Face Color | Tile Style Base | Architecture | Seam Pulse Color |
|---|---|---|---|---|
| **Frozen Citadel** | White | `ice` | Crystalline spires, low flat slabs, angular faceted towers | `#B8E4FF` (white-blue) |
| **Deep Station** | Blue | `water` | Hab-rings, pressure domes, vertical pipe clusters | `#00CED1` (teal) |
| **Volcanic Foundry** | Red | `lava` | Brutalist stacks, smokestack clusters, industrial pylons | `#FF4500` (orange-red) |
| **Solar Arcology** | Yellow | `pulse` | Parabolic dish arrays, lattice towers, light-collection spires | `#FFD700` (gold-amber) |
| **Bio-Dome** | Green | `grass` | Organic canopy arches, spiral towers, root-buttress bases | `#39FF14` (bio-green) |
| **Neural Hub** | Orange | `neural` | Floating antenna forests, signal towers, data-bridge connectors | `#8B00FF` (violet) |

---

## Antipodal Pairs & Seam Interaction Table

Standard cube opposites: **1↔4 (White↔Yellow), 2↔5 (Blue↔Green), 3↔6 (Red↔Orange)**

Antipodal pairs pulse at the **same frequency** regardless of physical adjacency — manifold entanglement. All other pairs pulse at a frequency derived from their color-wheel distance.

| Seam | Pair Type | Citadel-Side Color | Partner-Side Color | Pulse Character | Frequency |
|---|---|---|---|---|---|
| Ice ↔ Solar | Antipodal · Thermal Max | `#B8E4FF` | `#FFD700` | Maximum contrast — hard alternating flash, no blend | 2.4 Hz |
| Deep ↔ Bio | Antipodal · Cool Harmony | `#00CED1` | `#39FF14` | Slow symbiotic breathing, soft fade in/out | 0.8 Hz |
| Foundry ↔ Neural | Antipodal · Warm Ambiguous | `#FF4500` | `#8B00FF` | Fast chaotic flicker, irregular rhythm | 3.2 Hz |
| Ice ↔ Deep | Cross-cool | `#B8E4FF` | `#00CED1` | Calm, similar frequencies, gentle overlap | 1.0 Hz |
| Ice ↔ Bio | Luminance bridge | `#B8E4FF` | `#39FF14` | Ice side amplifies Bio side, white leads | 1.2 Hz |
| Ice ↔ Neural | Cold + Compute | `#B8E4FF` | `#8B00FF` | Crisp alternating, high contrast | 2.0 Hz |
| Solar ↔ Foundry | Thermal Clash | `#FFD700` | `#FF4500` | Hot on hot — fast overlap, orange interference at seam | 2.8 Hz |
| Solar ↔ Neural | Luminance + Compute | `#FFD700` | `#8B00FF` | Most striking non-antipodal — gold/violet interference | 2.2 Hz |
| Solar ↔ Deep | Cross-temperature | `#FFD700` | `#00CED1` | Warm/cool interference, mid-speed | 1.8 Hz |
| Solar ↔ Bio | Warm + Organic | `#FFD700` | `#39FF14` | Warm nurturing pulse, slow | 1.0 Hz |
| Deep ↔ Neural | Cool + Compute | `#00CED1` | `#8B00FF` | Slow deep interference, long fade | 1.4 Hz |
| Deep ↔ Foundry | Cross-temperature | `#00CED1` | `#FF4500` | Fast interference, visible third color at seam midpoint | 3.0 Hz |
| Foundry ↔ Bio | Thermal vs Organic | `#FF4500` | `#39FF14` | Classic opposition, medium speed | 2.0 Hz |
| Bio ↔ Neural | Organic + Compute | `#39FF14` | `#8B00FF` | Interesting medium — life meets mind, slow build | 1.6 Hz |

**Seam pulse behavior (all cases):** Both border tile rows flash simultaneously in their respective city colors. Asymmetric — each side uses its own color. The pulse is a sine-wave opacity modulation on an emissive overlay mesh placed just above the sticker plane (`z + 0.012`). It does NOT modify the sticker's material directly.

**Antipodal entanglement:** Even when antipodal faces are not adjacent (most of the time), their border tiles pulse at their paired frequency but at low ambient intensity (20% opacity max). This creates a subtle visual hum showing the manifold connection is always alive.

---

## 3D City Geometry System

### Core Principle: Manifold-Split Cities

Each face is **one unified city** at the face scale. The grid dimension determines how finely the city is subdivided. The building geometry is generated once per face using a seeded deterministic PRNG (seed = faceId), then distributed across tiles based on grid size.

**2×2 grid:** Each tile = one large district. 3–5 landmark buildings per tile, large footprints, maximum height. The city feels monumental.

**3×3 grid:** Each tile = one neighborhood block. 4–8 buildings per tile, medium footprints, mixed heights.

**4×4 grid:** Each tile = dense urban block. 6–10 buildings per tile, small footprints, high variety.

**5×5 grid:** Each tile = micro-district. 8–14 buildings per tile, very fine grain, maximum detail.

Building count and size scale inversely with grid dimension so total visual density per face stays roughly constant.

### Building Geometry Per City

All buildings are R3F/Three.js geometry. Use `InstancedMesh` where building types repeat. Seed all randomness with `mulberry32(faceId * 1000 + tileIndex)` so geometry is stable across renders and re-renders.

Buildings sit on a flat base plane (the sticker plane itself, or a thin slab replacing it). Buildings extrude **outward** from the face — positive local Z. Maximum building height should not exceed `0.6` units (tile width is `~0.9` units) to avoid clipping adjacent face geometry during rotation.

---

#### Frozen Citadel (White / Ice)

**Palette:** White `#FFFFFF`, pale blue `#B8E4FF`, silver `#C0C0C0`

**Building types:**
- **Primary tower:** `BoxGeometry` with tapered top (scale X/Y down at upper segment). Width 0.08–0.18, height 0.25–0.55. Faceted appearance via flat shading.
- **Crystal shard:** `ConeGeometry(0.04, 0.3, 6)` — hexagonal spire. Clusters of 2–4 at random angles (±15°).
- **Low slab:** `BoxGeometry` wide and flat, height 0.04–0.08, width 0.3–0.5. Ice shelf bases.
- **Material:** `MeshStandardMaterial`, color white, metalness 0.3, roughness 0.1, transparent true, opacity 0.92. Slight blue emissive `#B8E4FF` at intensity 0.05.

**Layout rule:** 1 primary tower per tile (center-ish, slight random offset), 0–3 crystal shards clustered near it, 0–1 low slab as base platform.

---

#### Deep Station (Blue / Water)

**Palette:** Dark blue `#003366`, teal `#00CED1`, gunmetal `#2C3E50`

**Building types:**
- **Hab-ring:** `TorusGeometry(0.12, 0.025, 8, 16)` rotated to stand vertically. Height varies — stack 1–3 rings at different radii.
- **Pressure dome:** `SphereGeometry(0.1, 8, 6, 0, Math.PI*2, 0, Math.PI/2)` — hemisphere. Flat bottom sits on base plane.
- **Pipe cluster:** 3–5 `CylinderGeometry(0.012, 0.012, height, 6)` grouped, varying heights 0.1–0.4, slight random lean.
- **Material:** `MeshStandardMaterial`, color `#003366`, metalness 0.7, roughness 0.3. Teal emissive `#00CED1` at intensity 0.08 on rings only.

**Layout rule:** 1 pressure dome as anchor, 1 hab-ring beside it, 1 pipe cluster. Avoid tile center — spread to quadrants.

---

#### Volcanic Foundry (Red / Lava)

**Palette:** Dark red `#8B0000`, orange `#FF4500`, charcoal `#1C1C1C`

**Building types:**
- **Smokestack:** `CylinderGeometry(0.025, 0.04, height, 8)` — tapered bottom. Height 0.2–0.5. Groups of 2–4.
- **Brutalist block:** `BoxGeometry` wide and heavy, height 0.08–0.2, no taper. Dominant base structure.
- **Industrial pylon:** `CylinderGeometry(0.015, 0.015, 0.35, 4)` — square cross-section, tall and thin.
- **Vent cap:** `ConeGeometry(0.035, 0.06, 8)` inverted, sitting atop stacks.
- **Material:** `MeshStandardMaterial`, color `#1C1C1C`, metalness 0.8, roughness 0.6. Orange-red emissive `#FF4500` at intensity 0.15 on vent caps. Main blocks have no emissive.

**Layout rule:** 1 brutalist block dominating center-left, 2–3 smokestacks to the right, pylons scattered. Dense and crowded.

---

#### Solar Arcology (Yellow / Pulse)

**Palette:** Gold `#FFD700`, warm white `#FFF8DC`, bronze `#CD7F32`

**Building types:**
- **Lattice tower:** Tall thin `BoxGeometry(0.02, 0.02, height)` with `WireframeGeometry` overlay at wider scale — gives skeletal lattice look. Height 0.3–0.6.
- **Parabolic dish:** `SphereGeometry` hemisphere open-face-up, scale Y to 0.3 to flatten. Radius 0.08–0.14. Mounted on short stem.
- **Light spire:** `ConeGeometry(0.01, 0.4, 4)` — very narrow, tall. Emissive tip.
- **Solar panel array:** Flat `PlaneGeometry(0.2, 0.12)` tilted 30° on Y — angled toward imaginary sun.
- **Material:** `MeshStandardMaterial`, color `#CD7F32`, metalness 0.9, roughness 0.2. Gold emissive `#FFD700` at intensity 0.2 on spire tips and dish rims. Panel array uses `#FFD700` color with low metalness.

**Layout rule:** 1–2 lattice towers dominant, 1 dish array on a stem, 1–2 light spires, 1 panel array flat on base. Spread across tile — this city breathes.

---

#### Bio-Dome (Green / Grass)

**Palette:** Deep green `#006400`, lime `#39FF14`, bark brown `#4A2F1A`

**Building types:**
- **Canopy arch:** `TorusGeometry(0.15, 0.02, 6, 12, Math.PI)` — half-torus arch shape. Placed as gate/dome frame.
- **Spiral tower:** `CylinderGeometry` with per-segment rotation applied — approximate spiral with 6–8 stacked segments each rotated 15°. Height 0.25–0.45.
- **Root buttress:** `BoxGeometry` very thin and angled (rotateZ 30–45°) at base of towers, like flying buttresses. Width 0.015, length 0.12.
- **Dome cap:** `SphereGeometry(0.09, 8, 8, 0, Math.PI*2, 0, Math.PI/2)` — hemisphere, green, sits over low structure.
- **Material:** `MeshStandardMaterial`, color `#006400`, metalness 0.0, roughness 0.8. Lime emissive `#39FF14` at intensity 0.12 on dome cap edges and arch tops. Brown for buttresses.

**Layout rule:** 1 spiral tower, 1 canopy arch framing it, 2–3 root buttresses, 1 dome cap on a low platform. Organic — nothing perfectly centered.

---

#### Neural Hub (Orange / Neural)

**Palette:** Dark charcoal `#1A1A2E`, violet `#8B00FF`, orange `#FF6B00`

**Building types:**
- **Signal tower:** `CylinderGeometry(0.015, 0.02, height, 6)` with a `RingGeometry(0.04, 0.055, 16)` floating ring at top. Height 0.3–0.5.
- **Antenna cluster:** 4–6 very thin `CylinderGeometry(0.005, 0.005, 0.15–0.3, 4)` at slight random angles (±20°) from a shared base point.
- **Data bridge:** Thin `BoxGeometry(length, 0.008, 0.008)` connecting two towers — horizontal connector. Must have two towers within range to place.
- **Hub node:** `SphereGeometry(0.04, 8, 8)` — small sphere with emissive glow, anchor point for bridges.
- **Material:** `MeshStandardMaterial`, color `#1A1A2E`, metalness 0.6, roughness 0.4. Violet emissive `#8B00FF` at intensity 0.25 on floating rings and hub nodes. Orange emissive `#FF6B00` at intensity 0.1 on antenna tips.

**Layout rule:** 2 signal towers with floating rings, 1–2 antenna clusters between them, 1 data bridge connecting towers if distance allows, 2–3 hub nodes. This city looks wired together.

---

## New Files to Create

### `src/modes/CityBiomeMode.js`

Pure JS, no React, no Three.js.

```js
// Face color to city mapping — permanent, driven by base Rubik's palette
export const FACE_CITIES = {
  1: 'frozenCitadel',   // White
  2: 'deepStation',     // Blue
  3: 'volcanicFoundry', // Red
  4: 'solarArcology',   // Yellow
  5: 'bioDome',         // Green
  6: 'neuralHub',       // Orange
};

export const CITY_CONFIG = {
  frozenCitadel:   { label: 'Frozen Citadel',   tileStyle: 'ice',    pulseColor: '#B8E4FF', pulseHex: 0xB8E4FF },
  deepStation:     { label: 'Deep Station',      tileStyle: 'water',  pulseColor: '#00CED1', pulseHex: 0x00CED1 },
  volcanicFoundry: { label: 'Volcanic Foundry',  tileStyle: 'lava',   pulseColor: '#FF4500', pulseHex: 0xFF4500 },
  solarArcology:   { label: 'Solar Arcology',    tileStyle: 'pulse',  pulseColor: '#FFD700', pulseHex: 0xFFD700 },
  bioDome:         { label: 'Bio-Dome',          tileStyle: 'grass',  pulseColor: '#39FF14', pulseHex: 0x39FF14 },
  neuralHub:       { label: 'Neural Hub',        tileStyle: 'neural', pulseColor: '#8B00FF', pulseHex: 0x8B00FF },
};

// Antipodal face pairs
export const ANTIPODAL_FACES = { 1: 4, 2: 5, 3: 6, 4: 1, 5: 2, 6: 3 };

// Seam interaction table — key is sorted pair "A-B" where A < B (face IDs)
export const SEAM_INTERACTIONS = {
  '1-4': { type: 'antipodal-thermal-max',    frequency: 2.4, shape: 'hard-alternate'   },
  '2-5': { type: 'antipodal-cool-harmony',   frequency: 0.8, shape: 'soft-breathe'     },
  '3-6': { type: 'antipodal-warm-ambiguous', frequency: 3.2, shape: 'chaotic-flicker'  },
  '1-2': { type: 'cross-cool',               frequency: 1.0, shape: 'gentle-overlap'   },
  '1-5': { type: 'luminance-bridge',         frequency: 1.2, shape: 'lead-follow'      },
  '1-6': { type: 'cold-compute',             frequency: 2.0, shape: 'hard-alternate'   },
  '3-4': { type: 'thermal-clash',            frequency: 2.8, shape: 'hot-overlap'      },
  '4-6': { type: 'luminance-compute',        frequency: 2.2, shape: 'gold-violet'      },
  '2-4': { type: 'cross-temperature',        frequency: 1.8, shape: 'warm-cool-inter'  },
  '4-5': { type: 'warm-organic',             frequency: 1.0, shape: 'soft-breathe'     },
  '2-6': { type: 'cool-compute',             frequency: 1.4, shape: 'deep-interference'},
  '2-3': { type: 'cross-temperature',        frequency: 3.0, shape: 'third-color'      },
  '3-5': { type: 'thermal-organic',          frequency: 2.0, shape: 'gentle-overlap'   },
  '5-6': { type: 'organic-compute',          frequency: 1.6, shape: 'slow-build'       },
  '1-3': { type: 'cross-temperature',        frequency: 2.5, shape: 'warm-cool-inter'  },
};

export function getSeamInteraction(faceA, faceB) {
  const key = [faceA, faceB].sort((a, b) => a - b).join('-');
  return SEAM_INTERACTIONS[key] ?? { type: 'neutral', frequency: 1.0, shape: 'gentle-overlap' };
}

export function isAntipodalPair(faceA, faceB) {
  return ANTIPODAL_FACES[faceA] === faceB;
}

// Deterministic seeded PRNG — mulberry32
export function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Building count per tile based on grid dimension
export function getBuildingCount(gridDim) {
  return { 2: 4, 3: 6, 4: 8, 5: 11 }[gridDim] ?? 6;
}

// Resolve manifoldStyles for biome mode — city tile style per face
// Uses userFaceAssignment if provided (from wizard), else FACE_CITIES default
export function resolveBiomeManifoldStyles(userFaceAssignment = null) {
  const assignment = userFaceAssignment ?? FACE_CITIES;
  const styles = {};
  for (const [faceId, cityKey] of Object.entries(assignment)) {
    styles[faceId] = CITY_CONFIG[cityKey]?.tileStyle ?? 'solid';
  }
  return styles;
}
```

---

### `src/3d/CityBuildings.jsx`

R3F component. Renders procedural 3D buildings for one tile of one city. Mounted as a sibling of `StickerPlane` inside the sticker group in `CubeAssembly`, positioned at local Z + 0.015 (just above sticker surface).

```jsx
/**
 * CityBuildings
 * Props:
 *   cityKey   {string}  — key from CITY_CONFIG (e.g. 'frozenCitadel')
 *   tileIndex {number}  — 0-based tile position on face (row * dim + col)
 *   faceId    {number}  — 1–6, used in combined seed
 *   gridDim   {number}  — 2|3|4|5
 *   scale     {number}  — tile size normalization factor (tileWidth / 0.9)
 */
export function CityBuildings({ cityKey, tileIndex, faceId, gridDim, scale = 1 }) {
  // Seed: faceId * 10000 + tileIndex ensures unique stable geometry per tile per face
  // Use mulberry32(seed) for ALL random values — never Math.random()
  // All geometry created inside useMemo — never in render body
  // Cleanup: return dispose functions from useMemo for all geometries and materials
  // No useFrame inside this component — buildings are static
  // castShadow={false} receiveShadow={false} on all meshes
  // Max building height: 0.6 * scale units
  // All positions in local tile space: X and Y within (-0.4*scale, 0.4*scale)
}
```

Implement one render function per city inside the file:

- `renderFrozenCitadel(rng, count, scale)` → JSX mesh array
- `renderDeepStation(rng, count, scale)` → JSX mesh array
- `renderVolcanicFoundry(rng, count, scale)` → JSX mesh array
- `renderSolarArcology(rng, count, scale)` → JSX mesh array
- `renderBioDome(rng, count, scale)` → JSX mesh array
- `renderNeuralHub(rng, count, scale)` → JSX mesh array

Each function receives the seeded RNG instance and building count derived from `getBuildingCount(gridDim)`, and returns an array of JSX elements. Use the geometry specs defined in the City Roster section above.

**Performance rules:**
- `useMemo` for all geometry and material creation, keyed on `[cityKey, tileIndex, faceId, gridDim, scale]`
- `InstancedMesh` for any building type appearing 3+ times per tile
- No per-frame work anywhere in this component
- Dispose all geometries and materials in `useMemo` cleanup

---

### `src/3d/SeamPulse.jsx`

R3F component. Renders the asymmetric seam pulse overlay on border tiles. One instance per face per active seam, managed by `CubeAssembly`.

```jsx
/**
 * SeamPulse
 * Props:
 *   faceId         {number}    — which face this pulse instance belongs to
 *   neighborFaceId {number}    — the adjacent face it is reacting to
 *   borderTiles    {number[]}  — tileIndex values on the shared edge
 *   tilePositions  {Object}    — map of tileIndex → local position {x, y, z}
 *   tileScale      {number}    — tile size for overlay plane sizing
 *   isAdjacent     {boolean}   — true when faces are physically sharing an edge
 *   enabled        {boolean}
 */
export function SeamPulse({ faceId, neighborFaceId, borderTiles, tilePositions, tileScale, isAdjacent, enabled }) {
  // Derive interaction: getSeamInteraction(faceId, neighborFaceId)
  // Derive pulse color: CITY_CONFIG[cityForFace(faceId)].pulseColor
  // maxOpacity: isAdjacent ? 0.85 : (isAntipodalPair(faceId, neighborFaceId) ? 0.20 : 0)
  // Render one PlaneGeometry overlay per borderTile at tilePosition.z + 0.012
  // Overlay plane size: tileScale * 0.88 (slight inset from tile edge)
  // Animate opacity in useFrame via sine wave at interaction.frequency Hz
}
```

**Pulse shape implementations in `useFrame`:**

```
hard-alternate    → opacity = t % (1/freq) < (0.5/freq) ? maxOpacity : 0
soft-breathe      → opacity = maxOpacity * (0.5 + 0.5 * sin(t * freq * 2π))
chaotic-flicker   → opacity = maxOpacity * abs(sin(t * freq * 2π + sin(t * 7.3)))
lead-follow       → faceA: sin(t * freq * 2π), faceB: sin(t * freq * 2π - π*0.6)
hot-overlap       → opacity = maxOpacity * (0.6 + 0.4 * sin(t * freq * 2π))  [always bright]
third-color       → at peak, lerp material color toward mix of both city colors
gold-violet       → alternating with bloom: opacity sharp square wave + color shift
slow-build        → opacity ramps 0→maxOpacity over 2s, resets, repeat
gentle-overlap    → soft-breathe at lower intensity (0.7 * maxOpacity)
deep-interference → beat: sin(t * f1 * 2π) * sin(t * f2 * 2π), f1=freq, f2=freq*1.07
warm-cool-inter   → fast sine + color oscillates between warm and cool hex each cycle
```

---

### `src/ui/BiomeModeSetup.jsx`

Setup wizard step for city-to-face assignment.

**UI layout:**
- Row of 6 face slots, each a colored square (white/blue/red/yellow/green/orange) labeled "Face 1"–"Face 6"
- Below each face slot: a dropdown with all 6 city options
- Validation: each city can only be assigned to one face — selecting a city for face N removes it from wherever it was previously assigned
- "Default" button: resets to `FACE_CITIES` mapping
- "Randomize" button: Fisher-Yates shuffle of city keys across the 6 faces
- Antipodal pair preview: below the face slots, show 3 rows for pairs (1↔4, 2↔5, 3↔6), each showing the two city names and their interaction type label (e.g. "Thermal Maximum ⚡", "Cool Harmony 🌊", "Warm Ambiguous 🔥")
- The interaction type label updates live as the player reassigns cities

Emits `onChange({ [faceId]: cityKey })` on every change.

---

## Files to Modify

### `src/utils/colorSchemes.js`

Add `solar` to `TILE_STYLES` as an alias for `pulse`:

```js
solar: { label: 'Solar', cost: 'med', type: 'animated' },
```

Add biome defaults to `DEFAULT_SETTINGS`:

```js
biomeMode: {
  enabled: false,
  faceAssignment: null, // null = use FACE_CITIES default from CityBiomeMode.js
},
```

---

### `src/3d/CubeAssembly.jsx`

**New props:**

```js
isBiomeMode:     PropTypes.bool,    // master switch
biomeFaceAssign: PropTypes.object,  // { [faceId]: cityKey }, null = use defaults
```

**Change 1 — Disable chaos mode:**

At the top of whatever handles chaos mode activation, add:

```js
if (isBiomeMode) return; // chaos disabled in biome mode
```

Also hide chaos UI toggle when `isBiomeMode` is true (or gray it out with a tooltip "Disabled in Biome Mode").

**Change 2 — Mount CityBuildings per sticker:**

Inside the sticker render loop, alongside `StickerPlane`, add:

```jsx
{isBiomeMode && (
  <CityBuildings
    cityKey={
      (biomeFaceAssign ?? FACE_CITIES)[meta.orig] ?? FACE_CITIES[meta.orig]
    }
    tileIndex={tileIndex}
    faceId={meta.orig}
    gridDim={dim}
    scale={tileScale}
  />
)}
```

**CRITICAL:** Use `meta.orig` NOT `meta.curr`. The city identity belongs to the sticker's original face. When the player rotates a slice, the buildings travel with the sticker — Neural Hub buildings on a sticker will still be Neural Hub buildings after moving to an Ice face. This is the correct topological behavior.

**Change 3 — Compute active seams:**

After every rotation animation completes, compute `activeSeams`. This is an array of objects:

```js
{
  faceA: number,        // face ID
  faceB: number,        // adjacent face ID
  edgeTilesA: number[], // tileIndex values on faceA's shared edge
  edgeTilesB: number[], // tileIndex values on faceB's shared edge
}
```

Store in a ref `activeSeamsRef`. Update it after every rotation completes (same location where you cleared `animStateRef` or fired `onSliceRotated`).

> **Claude Code: This is the most architecture-dependent part of the spec.** Read `CubeAssembly.jsx` carefully to understand how face adjacency is tracked or can be derived from the current cube state. On a standard cube, a face has 4 neighbors at any orientation. The edge tiles of a face are the tiles in the row/column closest to the shared edge. Do not hardcode adjacency — derive it from actual state.

**Change 4 — Mount SeamPulse instances:**

Render seam pulses outside the sticker loop, at the CubeAssembly level:

```jsx
{isBiomeMode && activeSeams.map(seam => (
  <React.Fragment key={`${seam.faceA}-${seam.faceB}`}>
    <SeamPulse
      faceId={seam.faceA}
      neighborFaceId={seam.faceB}
      borderTiles={seam.edgeTilesA}
      tilePositions={tileWorldPositions}
      tileScale={tileScale}
      isAdjacent={true}
      enabled={true}
    />
    <SeamPulse
      faceId={seam.faceB}
      neighborFaceId={seam.faceA}
      borderTiles={seam.edgeTilesB}
      tilePositions={tileWorldPositions}
      tileScale={tileScale}
      isAdjacent={true}
      enabled={true}
    />
  </React.Fragment>
))}
```

**Change 5 — Mount ambient antipodal pulses:**

Always render the 3 antipodal pair pulses at low ambient intensity, regardless of physical adjacency. `SeamPulse` handles the opacity difference internally via `isAdjacent={false}`:

```jsx
{isBiomeMode && [[1,4],[2,5],[3,6]].map(([a,b]) => (
  !activeSeams.some(s => (s.faceA===a&&s.faceB===b)||(s.faceA===b&&s.faceB===a)) && (
    <React.Fragment key={`ambient-${a}-${b}`}>
      <SeamPulse faceId={a} neighborFaceId={b}
        borderTiles={allBorderTilesForFace(a)}
        tilePositions={tileWorldPositions}
        tileScale={tileScale} isAdjacent={false} enabled={true} />
      <SeamPulse faceId={b} neighborFaceId={a}
        borderTiles={allBorderTilesForFace(b)}
        tilePositions={tileWorldPositions}
        tileScale={tileScale} isAdjacent={false} enabled={true} />
    </React.Fragment>
  )
))}
```

---

### `src/ui/FreeplaySetupWizard.jsx`

Add **"City Biome"** as a game mode option in the mode picker step. When selected:

1. Insert `BiomeModeSetup` as a new wizard step after the standard mode step
2. On wizard complete, pass `biomeMode: { enabled: true, faceAssignment: wizardResult }` into session settings
3. Call `resolveBiomeManifoldStyles(faceAssignment)` to generate the `manifoldStyles` object — pass this as the `manifoldStyles` setting so sticker tile styles are set correctly

Ensure non-biome modes are unaffected.

---

### `src/App.jsx`

Pass new props to `CubeAssembly`:

```jsx
<CubeAssembly
  {...existingProps}
  isBiomeMode={settings.biomeMode?.enabled ?? false}
  biomeFaceAssign={settings.biomeMode?.faceAssignment ?? null}
/>
```

---

## What NOT to Change

- **`StickerPlane.jsx`** — do not touch. The shader sync fixes from today's session must remain intact. `CityBuildings` is a sibling, not a child, of `StickerPlane`.
- **`TileStyleMaterials.jsx`** — no new shaders needed. City identity comes from 3D geometry. The tile style base (`ice`, `water`, `lava`, `pulse`, `grass`, `neural`) just provides the colored base plane under the buildings.
- **Flip mode** — must continue working exactly as before. Flipping a city tile carries its buildings with it to the antipodal position. No special handling needed — buildings follow `meta.orig`, which the existing flip system already updates correctly.
- **All existing game modes** — sudokube, classic, free play are completely unaffected.

---

## Coordinate System Notes

> **Claude Code: Verify these against actual CubeAssembly values before implementing.**

Assumed values based on prior session context:

- Tile width ≈ `0.9` units (sticker face, local space)
- Sticker plane at local `z = 0`, extruding outward in `+Z`
- `tileScale = tileWidth / 0.9` — use to normalize all building dimensions
- Max safe building extrusion: `0.6` units before scaling
- Building XY positions: random within `(-0.4 * scale, +0.4 * scale)` to stay inside tile bounds

If actual tile width differs, all building dimension constants in this spec should be multiplied by `actualTileWidth / 0.9`.

---

## Acceptance Criteria

1. **All 6 cities render** — each face shows correct 3D building geometry matching its city type. Buildings are stable across re-renders.
2. **Grid scaling works** — 2×2 shows large district-scale buildings; 5×5 shows fine micro-district density. Total visual mass per face stays roughly constant.
3. **Buildings travel with tiles** — rotating a slice moves buildings with their stickers. A Neural Hub tile that moves to an Ice face still shows Neural Hub buildings.
4. **`meta.orig` drives city identity** — verified by rotating a face fully (4 × 90°) and confirming buildings return to original city type correctly.
5. **Seam pulses fire after rotation** — newly adjacent face edges show asymmetric simultaneous pulsing in their respective city colors within one frame of rotation completion.
6. **Correct pulse character** — antipodal seams (1↔4, 2↔5, 3↔6) use their defined shape and frequency. All 14 non-neutral interaction types produce visually distinct behavior.
7. **Antipodal ambient hum** — faces 1 and 4 (when not adjacent) show low-intensity ambient pulse on their border tiles. Opacity ≤ 0.20.
8. **Flip mode works** — flipping a biome tile carries buildings and city identity correctly. No visual glitch during or after flip animation.
9. **Chaos mode disabled** — toggling chaos has no effect in biome mode. UI reflects this.
10. **Shader regressions absent** — rapid rotation on a 3×3 grid produces no corner cubie color bleed or stale material artifacts.
11. **Performance** — no geometry creation in render loop. No per-frame PRNG calls. `useFrame` used only in `SeamPulse`. Stable 60fps on 3×3.
12. **Wizard flow complete** — selecting City Biome mode, assigning cities in the wizard, and starting game produces a correctly configured cube with buildings and manifoldStyles set.
13. **Antipodal preview in wizard** — the wizard's interaction type labels update live as cities are reassigned to faces.
14. **Solar = pulse** — Solar Arcology tiles use the `pulse` tile style as base. Verify in devtools that `manifoldStyles[4]` (or whichever face has Solar assigned) resolves to `'pulse'`.

---

## Implementation Order

1. `src/modes/CityBiomeMode.js` — pure logic, no deps. Manually verify the seam interaction table covers all 15 unique pairs.
2. `src/utils/colorSchemes.js` — add `solar` tile style alias and `biomeMode` settings defaults.
3. `src/3d/CityBuildings.jsx` — implement all 6 city render functions. Test each city type in isolation on a single face before integrating.
4. Integrate `CityBuildings` into `CubeAssembly` — verify `meta.orig` is used, verify buildings travel with tiles through rotations.
5. `src/3d/SeamPulse.jsx` — implement all pulse shape variants. Test with hardcoded adjacent faces first.
6. Integrate `SeamPulse` into `CubeAssembly` — implement active seam computation, mount pulse instances, verify ambient antipodal hum.
7. `src/ui/BiomeModeSetup.jsx` — wizard step with face assignment, live antipodal preview.
8. Wire into `FreeplaySetupWizard.jsx` and `App.jsx`.
9. Full acceptance criteria pass in order.
