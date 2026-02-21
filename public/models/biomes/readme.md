# Biome GLB Models

Drop one `.glb` file per biome into this directory, then set its path
in `src/3d/BiomeGLBCluster.jsx` → `BIOME_GLB_PATHS`.

## File naming

| cityKey          | File name                 | Status    |
|------------------|---------------------------|-----------|
| `bioDome`        | `bio-dome.glb`            | ⬜ pending |
| `frozenCitadel`  | `frozen-citadel.glb`      | ⬜ pending |
| `deepStation`    | `deep-station.glb`        | ⬜ pending |
| `volcanicFoundry`| `volcanic-foundry.glb`    | ⬜ pending |
| `neuralHub`      | `neural-hub.glb`          | ⬜ pending |
| `solarArcology`  | `solar-arcology.glb`      | ⬜ pending |

Once a file is in place, uncomment its path in `BIOME_GLB_PATHS` and
the GLB renderer activates automatically for that biome. The procedural
CityBuildings fallback runs for any biome with a null path.

---

## Model requirements (all biomes)

### Geometry
- **Footprint:** XY ≤ ±0.42 units from origin. The sticker face is
  0.85 × 0.85 units; geometry outside that range clips against adjacent tiles.
- **Height:** Z in [0, 0.65] units. Nothing below z = 0 — geometry that
  dips below the ground plane pokes through the cube face during rotation.
- **Origin:** Place at the ground-center of the composition (x=0, y=0, z=0).
- **Triangles:** Target < 3 000 triangles total. This renders at ~60px on
  screen; dense geometry is invisible and wastes draw calls.
- **Shadows:** Disabled in-engine — no need to bake shadow maps.

### Materials
- **PBR (Principled BSDF → glTF BSDF in Blender)** — metallic/roughness
  workflow. Emissive maps work and are encouraged for glowing elements.
- **Vertex colors** are supported if you want per-part color variation
  without additional texture maps.
- **Textures:** Keep ≤ 512 × 512. Atlas multiple parts onto one texture to
  minimise draw calls. Each unique (geometry, material) pair = 1 draw call
  per tile; a model with 8 material slots = 8 × 9 = 72 draw calls on a 3×3
  face — try to merge to 3–4 materials maximum.
- **No transparency** in the GLB materials if you can avoid it. Transparent
  GLB meshes enter the transparent render queue and can cause the same
  depth-sort artifacts we fixed in the procedural buildings.

### Export from Blender
```
File → Export → glTF 2.0 (.glb)
  Format:    GLB (binary)
  Include:   Selected objects (or Scene)
  Transform: +Y Up ✓ | Apply All Transforms ✓
  Geometry:  Triangulate Faces ✓ | Apply Modifiers ✓
  Compress:  Draco (optional — cuts file ~60%, needs draco decoder at runtime)
```

### Per-biome design notes

**bio-dome** (`bio-dome.glb`)
Lush jungle canopy city. Multiple tree heights (trunk + 3-tier canopy cones),
ground mushrooms, a central raised platform, bioluminescent orbs.
Palette: dark bark (#3D2010), mid-canopy (#3A7D44), bright tips (#8BC34A),
neon accent (#39FF14 emissive), warm flower spots (#FF9F40).

**frozen-citadel** (`frozen-citadel.glb`)
Already well-served by procedural — low priority for GLB.

**deep-station** (`deep-station.glb`)
Pressure dome, pipe cluster, vertical orbital rings. Procedural version is good.

**volcanic-foundry** (`volcanic-foundry.glb`)
Brutalist block, lava pool disc, smokestack bank. Procedural version is good.

**neural-hub** (`neural-hub.glb`)
Two towers + bridge. Procedural version is good.

**solar-arcology** (`solar-arcology.glb`)
Lattice tower + parabolic dish + solar panel array. Procedural version is good.
