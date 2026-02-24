# Flip Animation Upgrade — WORM³

## Core Thesis

The rotation was never wrong in terms of performance — it was wrong in terms of meaning.

The squish is not a trick. It's an ontological correction.

- **Rotation** implies the tile has a physical back face (like a playing card). That's a lie.
- **Squish** means the tile's identity collapses to zero and re-instantiates as something else. That's what actually happens.

The tile doesn't flip. It disappears as itself — and reappears as something else.

---

## What We're Replacing

**Current implementation** (`StickerPlane.jsx`):
```js
groupRef.current.rotation.y = rot[1] + angle;
```

The sticker group physically rotates on the Y axis. At the midpoint (90°), the tile faces away from camera. A color/texture swap fires there, then the tile rotates back into view showing the new city.

### Problems

- **Wrong mental model.** Rotation implies a back face. `DoubleSide` exists to cover this lie.
- **`DoubleSide` overhead.** Doubles fragment shader work for every flipping tile.
- **`needsUpdate = true` every frame.** Material re-upload to GPU each RAF tick during flip — not just once.
- **State toggle cost.** `setFlipActive(true/false)` causes React re-renders at start and end of every flip.

---

## What We're Building

**Replace Y-axis rotation with an X-axis scale squish (compress-and-expand).**

### Step 1: Ease `rawP` itself, not scale

Don't ease the scale directly — ease the time variable. This makes the curve reusable everywhere:

```js
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const p = easeInOutCubic(rawP); // use p everywhere below
```

Why this matters: biography-driven flips, Chaos mode time warps, and per-tile resistance all
live here later — not in geometry math. Centralizing expressive control here prevents animation
math from fossilizing design assumptions.

### Step 2: Nonlinear squish with power curve

```js
const t = p < 0.5 ? p * 2 : (1 - p) * 2;  // 0→1→0 over the flip
const xScale = Math.pow(t, 0.85);           // slows approach to zero, prevents guillotine feel
const yPunch = 1 + Math.sin(p * Math.PI) * 0.12; // slight Y bulge at midpoint

groupRef.current.scale.set(xScale, yPunch, 1);
groupRef.current.rotation.y = rot[1]; // fixed — never animates
```

The power curve (0.85) slows the approach to zero so the collapse feels intentional rather than
like a mesh disappearing or a UI artifact.

### Step 3: One-shot color swap at the sacred frame

```js
// Fire once, exactly when xScale === 0 (tile invisible)
if (prevRawP < 0.5 && p >= 0.5) {
  const mat = meshRef.current?.material;
  if (mat?.color) {
    const tex = flipToTexture.current;
    mat.map = tex || null;
    mat.color.set(tex ? '#ffffff' : flipToColor.current);
    mat.needsUpdate = true; // single GPU upload, not per-frame
  }
}
```

### Step 4: Milk the midpoint

The crossing is an event, not a transition. Reinforce it:

```js
if (prevRawP < 0.5 && p >= 0.5) {
  if (ringRef.current) {
    ringRef.current.material.opacity = 0.9; // pulse — useFrame handles decay
  }

  // Holding for one frame creates a perceptual "event horizon"
  // without affecting simulation time or logic.
  // Remove only if playtesting finds it breaks rhythm in Chaos mode.
  // flipT.current -= deltaTime;
}
```

Even a single held frame tells the player: *this moment mattered*.

---

## Performance Comparison

| | Rotation (current) | Scale squish (new) |
|---|---|---|
| DoubleSide needed | ✅ yes | ❌ no |
| `needsUpdate` per frame | ✅ every frame | ❌ once at midpoint |
| React re-render per flip | ✅ 2× (on/off) | ❌ zero |
| Backface exposure risk | ✅ yes | ❌ no |
| Conveys correct topology | ❌ "card flip" | ✅ "identity collapse" |

This is the rare case where better semantics = better performance. That doesn't happen by accident.

---

## Two Risks to Watch

### ⚠️ Risk 1: "Paper Cut" Perception at xScale → 0

A pure linear squash to zero can briefly read as a UI element collapsing or a numerical artifact,
especially on a static close camera. The `Math.pow(t, 0.85)` curve above mitigates this — it
slows the approach to zero so the collapse feels organic. If it still reads wrong, try `smoothstep`
or push the exponent toward 0.7.

### ⚠️ Risk 2: Orientation Cue Is Fully Removed

Freezing `rotation.y` removes all directional motion. That's philosophically correct (the tile
doesn't rotate through space) but perceptually, players use motion to anchor events in space.

The flip currently reads: *"something happened to the tile."*
It should read: *"the tile crossed through something."*

Mitigation — add one non-rotational directional cue:
```js
// Micro shear: ±2–3° skew for 1–2 frames around midpoint
// TODO: consider making this camera-relative (perpendicular to camera normal)
// when Chaos mode introduces non-standard view angles — z-axis shear can
// read ambiguously from oblique cameras.
const shear = Math.sin(p * Math.PI) * 0.04;
groupRef.current.rotation.z = rot[2] + shear;
```

This preserves the no-rotation principle while adding a crossing direction signal.

---

## Files to Change

### `src/3d/StickerPlane.jsx`

**Remove:**
- `flipActive` state (`useState(false)`)
- `setFlipActive(true/false)` calls in trigger `useEffect` and completion block
- `side={flipActive ? THREE.DoubleSide : THREE.FrontSide}` prop on material
- `mat.needsUpdate = true` inside the per-frame loop

**Add:**
- `easeInOutCubic` helper (can live in `src/utils/easing.js` for reuse)
- Power-curved `xScale` and `yPunch` replacing the rotation+scale logic
- `prevRawP` ref to detect midpoint crossing edge
- Direct `ringRef.current.material.opacity` spike at midpoint

---

## Future: Biography-Weighted Squish

Not now — but this is where it lives:

```js
const resistance = 1 - Math.min(tile.totalFlips / 8, 0.6);
const xScale = Math.pow(t, 0.85) * resistance; // high-biography tiles collapse more reluctantly
```

High-biography tiles feel stiffer. The player can *see* that this tile has been somewhere.
That's system coherence without a single word of UI text.

---

## Scar Flash Notes

Replacing the React-mounted `AntipodalGlowFill` pulse with a direct `opacity` spike on `ringRef`
is correct. Avoids mount/unmount churn, keeps the event in the render domain, ties scars to the
crossing rather than UI logic.

Two things to ensure:
- Opacity decay is **frame-rate independent**: `opacity -= delta * decayRate`, not a fixed step
- Pulse doesn't **stack in Chaos mode**: clamp at 0.9 on write, don't add to existing opacity

---

## Summary

The squish maps correctly to the underlying topology:

- `xScale → 0` marks the fixed point of the Z₂ involution, where the observable eigenstate is suppressed
- `xScale → 1` (new color) = re-instantiation under the antipodal map

It teaches the player the right idea without words. Most importantly: it's true.
