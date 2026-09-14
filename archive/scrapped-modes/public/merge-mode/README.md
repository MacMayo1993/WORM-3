# Merge Mode Assets

Drop PNG files into the folders below. Each theme has 6 color slots (matching the 6 face colors of the Rubik's cube) and 3 evolution tiers.

## Face Color Mapping

| Folder | Face Color | Default |
|--------|-----------|---------|
| color1 | Red (PZ front face) | |
| color2 | Green (NX left face) | |
| color3 | White (PY top face) | |
| color4 | Orange (NZ back face) | |
| color5 | Blue (PX right face) | |
| color6 | Yellow (NY bottom face) | |

## Tier Rules

| Tier | File | When it shows |
|------|------|--------------|
| 1 | `tier1.png` | 1–2 same-color tiles touching |
| 2 | `tier2.png` | 3+ same-color tiles touching (pulses) |
| 3 | `tier3.png` | Full face covered — all size×size tiles (pops out) |

## Example: Pokemon / color1 (Red face)

```
merge-mode/
└── pokemon/
    └── color1/
        ├── tier1.png   ← e.g. Squirtle (base form)
        ├── tier2.png   ← e.g. Wartortle (mid form)
        └── tier3.png   ← e.g. Blastoise (final form)
```

## Themes

- `pokemon/`
- `dnd/`
- `digimon/`
- `marvel/`
- `harry-potter/`
- `disney/`

All images should be **PNG with transparent backgrounds** for best results.
Images are square — recommended size: **256×256px** or **512×512px**.
