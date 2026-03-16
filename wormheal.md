# Tunnel Healing Feature — Implementation Guide

> **Branch:** `claude/plan-tunnel-healing-eyyqW`
> **Goal:** Allow the worm to heal flipped tunnels by auto-depositing color orbs on entry.

---

## Feature Summary

When the worm enters a flipped-tile tunnel, it automatically deposits matching-color orbs from its
inventory toward healing that tunnel. Each tunnel costs **4 orbs** of the matching entry color to
heal. Partial deposits persist across cube rotations. When fully healed, the sticker is restored
and the portal ring disappears.

### Rules
- **Cost:** 4 orbs per tunnel (fixed, `HEAL_COST = 4`)
- **Trigger:** Auto-deposit inside `beginTunnelTransition`, after void checks pass
- **Color matching:** Orb faceId must match the flipped sticker's `curr` face ID
- **Worm shrinks:** Each deposited orb removes `ORB_SEGMENT_GROWTH` (= 2) visual balls from tail
- **Minimum worm length:** Never shrink below `BASE_TAIL_LENGTH` (= 4 balls)
- **Partial progress:** Persists across cube rotations (keyed by `origDir-origX-origY-origZ`)
- **Healing fires at tunnel exit** — only when `deposited >= HEAL_COST`
- **Actual sticker restoration:** `healSticker()` called for both entry AND exit stickers
- **Void tunnels:** Skip deposit entirely — player never loses orbs to a dead tunnel

---

## Architecture Map

```
HealerWormMode.jsx
  └── useWormCrawler(size, cubies)         ← all game logic
        ├── beginTunnelTransition(x,y,z,dirKey)
        │     ├── void checks (return early if void)       [lines 238-265]
        │     ├── [NEW] deposit logic                      [INSERT after line 265]
        │     ├── [NEW] currentTunnelStableKeyRef.current  [INSERT ref]
        │     └── tunnel phase setup                       [lines 266-275]
        │
        ├── useFrame → exiting phase exit block            [~line 596-620]
        │     ├── [MODIFIED] gate heal on deposited >= HEAL_COST
        │     ├── [NEW] healSticker(entry) + healSticker(exit) + setCubies
        │     └── [NEW] clean up wormHealingProgress entry
        │
        ├── worm reset block                               [lines 677-691]
        │     └── [ADD] wormHealingProgress: {}
        │
        └── applyOrbPickupGrowth(color, faceId)            [lines 276-285, done]

useGameStore (Zustand)
  ├── wormOrbInventory        { 1-6: count }    [DONE]
  ├── wormHealingProgress     { [stableKey]: { deposited, faceId } }  [TODO Step 2]
  ├── setWormHealingProgress  (v) => set(...)                         [TODO Step 2]
  ├── wormHealedCount         [DONE]
  └── wormBodyTiles           [DONE]

WormCrawlerHUD.jsx (DOM overlay)
  └── OrbInventoryHUD.jsx     receives faceColors from parent  [DONE, needs mobile reposition]

HealerWormMode.jsx (Canvas, R3F)
  ├── WormholeRings            [DONE — not modified by this feature]
  └── TunnelHealProgress       [TODO Step 5 — NEW component]
```

---

## Key Code Locations

| Location | File | Lines |
|---|---|---|
| `beginTunnelTransition` body | `HealerWormMode.jsx` | 228–271 |
| Deposit hook point (after void check, before phase setup) | `HealerWormMode.jsx` | after line 265 |
| Tunnel exit / heal increment | `HealerWormMode.jsx` | ~618 |
| Worm reset block | `HealerWormMode.jsx` | 677–691 |
| `applyOrbPickupGrowth` | `HealerWormMode.jsx` | 276–285 |
| `healSticker` | `src/game/cubeState.js` | 22–33 |
| Worm state in store | `src/hooks/useGameStore.js` | 266–295 |
| `clearDisparityGame` reset | `src/hooks/useGameStore.js` | ~310 |
| `initWormMode` reset | `src/hooks/useGameStore.js` | ~350 |
| Constants file | `src/worm/healerWorm/constants.js` | full file, ~63 lines |
| `WormholeRings` render in scene | `HealerWormMode.jsx` | ~1970 |

---

## Progress Tracker

### Step 1 — Orb Inventory State & HUD ✅ COMPLETE
- [x] `wormOrbInventory` in Zustand store with reset in `clearDisparityGame` + `initWormMode`
- [x] `setWormOrbInventory` setter in store
- [x] `applyOrbPickupGrowth` increments `wormOrbInventory[faceId]`
- [x] `wormOrbInventory` reset in worm reset block (line 681)
- [x] `OrbInventoryHUD.jsx` — color dots with count, uses `faceColors` prop
- [x] `WormCrawlerHUD` computes `resolvedFaceColors` (biome-aware) and passes to `OrbInventoryHUD`

**⚠️ Step 1 remaining polish (Step 6 below):**
- [ ] 1.15 Mobile: reposition HUD from bottom-center (conflicts with d-pad/jump) to top-right
- [ ] 1.16 White orb contrast: verify `isLight` border is visible on the actual panel background

---

### Step 2 — Store: `wormHealingProgress` + Constants

**2.1** Add to `useGameStore.js` inside the store initializer (same block as `wormOrbInventory`):
```js
wormHealingProgress: {},
setWormHealingProgress: (v) => set({ wormHealingProgress: v }),
```

**2.2** Add to `clearDisparityGame` spread (same pattern as `wormHealedCount: 0`):
```js
wormHealingProgress: {},
```

**2.3** Add to `initWormMode` spread:
```js
wormHealingProgress: {},
```

**2.4** Add to `HEAL_COST` in `src/worm/healerWorm/constants.js` (at the bottom):
```js
export const HEAL_COST = 4; // orbs required to fully heal one tunnel
```

**Test:** `useGameStore.getState().wormHealingProgress` returns `{}` after game init.

---

### Step 3 — `getStableKey` helper in `wormLogic.js`

Add near the top of `src/worm/wormLogic.js` (after existing helpers, before `getActiveTunnels`):

```js
/**
 * Returns a rotation-stable key for a surface sticker.
 * Uses origPos + origDir so the key survives cube rotations.
 * Returns null if the sticker cannot be found.
 */
export function getStableKey(x, y, z, dirKey, cubies) {
  const sticker = cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
  if (!sticker) return null;
  const { origPos, origDir } = sticker;
  return `${origDir}-${origPos.x}-${origPos.y}-${origPos.z}`;
}
```

**Also add** a reverse-lookup helper (needed by `TunnelHealProgress` in Step 5):

```js
/**
 * Scans cubies to find the current grid position of a sticker by its stable key.
 * Returns { x, y, z, dirKey } or null.
 */
export function findStickerByStableKey(cubies, size, stableKey) {
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const cubie = cubies?.[x]?.[y]?.[z];
        if (!cubie) continue;
        for (const dirKey of Object.keys(cubie.stickers)) {
          const st = cubie.stickers[dirKey];
          if (!st?.origPos) continue;
          const k = `${st.origDir}-${st.origPos.x}-${st.origPos.y}-${st.origPos.z}`;
          if (k === stableKey) return { x, y, z, dirKey };
        }
      }
    }
  }
  return null;
}
```

**Test:** After a cube rotation, `getStableKey` on the same sticker (now at different x,y,z) returns the same string.

---

### Step 4 — Auto-Deposit on Tunnel Entry (`beginTunnelTransition`)

**4.1** Add to imports in `HealerWormMode.jsx`:
```js
import { getActiveTunnels, getTunnelWorldPos, getStableKey } from './wormLogic.js';
import { HEAL_COST, BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH, MAX_TAIL } from './healerWorm/constants.js';
```
(Check which of these are already imported — only add the missing ones.)

**4.2** Add a ref inside `useWormCrawler` (alongside existing refs like `tunnelProgress`):
```js
const currentTunnelStableKeyRef = useRef(null); // stable key of the tunnel being traversed
```

**4.3** Insert deposit block in `beginTunnelTransition` **after the traversal count / void check block ends** (after the `if (nextTraversals > WORMHOLE_MAX_TRAVERSALS)` return, before `activeTunnel.current = tunnel`):

```js
// ── DEPOSIT ORBS ──────────────────────────────────────────────────────────
const liveCubies = useGameStore.getState().cubies;
const entrySticker = liveCubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
const entryFaceId = entrySticker?.curr ?? 0;
const stableKey = getStableKey(x, y, z, dirKey, liveCubies);

currentTunnelStableKeyRef.current = stableKey;

if (stableKey && entryFaceId) {
  const state = useGameStore.getState();
  const healingProgress = state.wormHealingProgress ?? {};
  const progress = healingProgress[stableKey] ?? { deposited: 0, faceId: entryFaceId };
  const orbsOnWorm = Math.floor((tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH);
  const available = (state.wormOrbInventory?.[entryFaceId] ?? 0);
  const n = Math.min(available, HEAL_COST - progress.deposited, orbsOnWorm);

  if (n > 0) {
    tailLength.current = Math.max(BASE_TAIL_LENGTH, tailLength.current - n * ORB_SEGMENT_GROWTH);
    orbPickupColorsRef.current = orbPickupColorsRef.current.slice(0, -n);
    const orbsLeft = Math.max(0, Math.floor((tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH));
    useGameStore.getState().setWormBodyTiles(orbsLeft);
    useGameStore.getState().setWormOrbInventory({
      ...(state.wormOrbInventory ?? {}),
      [entryFaceId]: (state.wormOrbInventory?.[entryFaceId] ?? 0) - n,
    });
    useGameStore.getState().setWormHealingProgress({
      ...healingProgress,
      [stableKey]: { deposited: progress.deposited + n, faceId: entryFaceId },
    });
  }
}
// ── END DEPOSIT ───────────────────────────────────────────────────────────
```

**4.4** Add to worm reset block (lines 677-691), inside the `useGameStore.setState({...})` call:
```js
wormHealingProgress: {},
```

**Test:** Pick up 2 green orbs. Enter a green-entry tunnel. Worm shrinks by 4 balls.
`wormOrbInventory[2]` drops to 0. `wormHealingProgress[key].deposited === 2`.

---

### Step 5 — Healing Gate at Tunnel Exit

The existing exit block (~line 618) fires `healedRef.current += 1` unconditionally.
Replace it with a conditional that only heals when deposits are complete.

**5.1** Import `healSticker` from cubeState at top of `HealerWormMode.jsx`:
```js
import { healSticker } from '../game/cubeState.js';
```

**5.2** Replace the existing heal increment block. Find the section that reads:
```js
healedRef.current += 1;
useGameStore.getState().setWormHealedCount(healedRef.current);
```

Replace with:
```js
const exitedTunnel = activeTunnel.current; // capture BEFORE null below
const exitStableKey = currentTunnelStableKeyRef.current;
const exitState = useGameStore.getState();
const exitProgress = exitState.wormHealingProgress?.[exitStableKey];

if (exitProgress?.deposited >= HEAL_COST && exitedTunnel) {
  // Fully healed — restore both stickers in the antipodal pair
  const liveCubies = exitState.cubies;
  const { entry, exit: exitTile } = exitedTunnel;
  let healed = healSticker(liveCubies, size, entry.x, entry.y, entry.z, entry.dirKey);
  healed = healSticker(healed, size, exitTile.x, exitTile.y, exitTile.z, exitTile.dirKey);
  exitState.setCubies(healed);

  // Remove progress entry
  const newProgress = { ...(exitState.wormHealingProgress ?? {}) };
  delete newProgress[exitStableKey];
  exitState.setWormHealingProgress(newProgress);

  // Increment healed counter
  healedRef.current += 1;
  exitState.setWormHealedCount(healedRef.current);
}
// else: partial deposit or none — tunnel stays flipped, progress persists
```

> **Note on `setCubies`:** Verify the exact name: `useGameStore.getState().setCubies` or
> `useGameStore.getState().set({ cubies: ... })`. Check the store definition.

**Test sequence:**
1. Enter tunnel with 0 matching orbs → tile stays flipped after exit, `wormHealedCount` unchanged.
2. Enter same tunnel with 2 matching orbs → `wormHealingProgress[key].deposited === 2`, tile stays.
3. Pick up 2 more matching orbs, re-enter → deposited hits 4, tile heals, portal ring disappears,
   `wormHealedCount` increments.

---

### Step 6 — TunnelHealProgress (3D floating indicator)

A 3D component that shows how many more orbs each partially-healed tunnel needs.

**6.1** Add `findStickerByStableKey` import to `HealerWormMode.jsx`:
```js
import { getActiveTunnels, getTunnelWorldPos, getStableKey, findStickerByStableKey } from './wormLogic.js';
```

**6.2** Create `TunnelHealProgress` component (inside `HealerWormMode.jsx` or its own file):

```jsx
function TunnelHealProgress({ size }) {
  const healingProgress = useGameStore((s) => s.wormHealingProgress ?? {});
  const cubies = useGameStore((s) => s.debouncedCubies ?? s.cubies);
  const faceColors = useGameStore((s) => {
    const settings = s.settings ?? { colorScheme: 'standard' };
    return resolveColors(settings, settings?.biomeMode?.faceAssignment) || {};
  });

  const entries = useMemo(() => {
    return Object.entries(healingProgress)
      .filter(([, p]) => p.deposited > 0 && p.deposited < HEAL_COST)
      .map(([key, p]) => {
        const pos = findStickerByStableKey(cubies, size, key);
        if (!pos) return null;
        return { key, pos, deposited: p.deposited, faceId: p.faceId, remaining: HEAL_COST - p.deposited };
      })
      .filter(Boolean);
  }, [healingProgress, cubies, size]);

  return (
    <>
      {entries.map(({ key, pos, remaining, faceId }) => {
        const worldPos = getStickerWorldPos(pos.x, pos.y, pos.z, pos.dirKey, size, 0.55);
        const color = faceColors[faceId] ?? '#ffffff';
        return (
          <Html key={key} position={[worldPos.x, worldPos.y, worldPos.z]} center>
            <div style={{
              color,
              fontSize: isMobile ? '18px' : '14px',
              fontWeight: 'bold',
              fontFamily: "'Courier New', monospace",
              textShadow: `0 0 6px ${color}`,
              pointerEvents: 'none',
              userSelect: 'none',
            }}>
              {remaining}
            </div>
          </Html>
        );
      })}
    </>
  );
}
```

**6.3** Add `Html` to imports from `@react-three/drei`.

**6.4** Verify `getStickerWorldPos` exists in `wormLogic.js` or `healerWorm/surfaceTiles.js`; if not,
use `getTunnelWorldPos(tunnel, 0, size, 1)` at t=0 (entry surface) as an approximation.

**6.5** Add to `HealerWormMode` render tree alongside `<WormholeRings .../>`:
```jsx
<TunnelHealProgress size={size} />
```

**Test:** Enter a green tunnel with 2 orbs. A "2" in green should float above the portal ring.

---

### Step 7 — OrbInventoryHUD Mobile/Desktop Layout Polish

**Actual rendered positions (390×844 viewport):**
- D-pad: bottom-right, ~`right:4 bottom:4` to `right:220 bottom:220`
- Jump button: bottom-left `left:4 bottom:4`, min-width 198px, height ~72px
- Top bar: `top:12 left:12 right:12`, height ~56px (ends at ~top:68)
- Progress panel: `top:76 left:12`, width 210px

**Current OrbInventoryHUD:** `bottom: 70px, left: 50%` on mobile — this is right at jump button level.

**7.1** Move OrbInventoryHUD position on mobile: `top: 76px, right: 12px` (right side below top bar,
opposite the progress panel on the left). Change in `OrbInventoryHUD.jsx` styles:
```js
container: {
  position: 'absolute',
  ...(isMobile
    ? { top: '76px', right: '12px' }
    : { bottom: '20px', left: '50%', transform: 'translateX(-50%)' }
  ),
  // ...rest unchanged
}
```

**7.2** On very small screens (width < 380px): reduce orb dot to 8px and count font to 12px.
Add a second `isSmall` breakpoint constant:
```js
const isSmall = typeof window !== 'undefined' && window.innerWidth < 380;
```

**7.3** White orb (faceId 3): The `isLight` luminance check (threshold 0.85) already adds a border.
Verify the border color `#888` is visible against the HUD panel background `rgba(0,0,0,0.6)`.
The dark panel means white orbs ARE visible, but the border at `#888` on black background may be subtle.
Change border to `1px solid rgba(255,255,255,0.4)` for white orbs on the dark panel.

---

### Step 8 — Tutorial & UX Text

**8.1** In `WormCrawlerHUD.jsx`, add a one-time hint when player enters a flipped tile with 0 matching orbs.
Use `wormFirstTunnelNoOrbHint` boolean in store (add similarly to other bool flags).

**8.2** In the death-menu stats section of `WormCrawlerHUD.jsx`, add a "Tunnels Healed" stat line
alongside the existing healed count display if `wormHealedCount > 0`.

---

### Step 9 — Edge Cases & Regression

- [ ] **Void tunnels:** Deposit block runs AFTER the void checks that `return` early — worm never loses
  orbs to a void tunnel since those code paths return before the deposit block.
- [ ] **At minimum length (`orbsOnWorm === 0`):** `n = min(..., 0) = 0` — no shrink, no deposit.
  `wormHealingProgress` is not updated. Portal ring shows no number (nothing deposited yet).
- [ ] **Multiple traversals to heal:** Enter 2× with 2 orbs each → heals on 2nd exit.
  `progress.deposited` accumulates across entries.
- [ ] **Cube rotation mid-game:** Stable key uses `origPos/origDir` — correct sticker targeted post-rotation.
  `findStickerByStableKey` scans current cubies to get current world position for indicator.
- [ ] **Worm restart:** `wormHealingProgress: {}` reset in Step 4.4. Portal rings revert to untouched state.
- [ ] **Performance:** `getStableKey` called once per tunnel entry in `beginTunnelTransition`, not in
  `useFrame`. `findStickerByStableKey` scans 54 surface stickers (3×3 cube) — negligible.
- [ ] **Jump over flipped tile:** `pendingTunnelTrigger` is cleared on jump → `beginTunnelTransition`
  never fires → no deposit. Confirm this by checking `startJump` sets `pendingTunnelTrigger = null`.
- [ ] **`setCubies` name check:** Verify the exact setter name before Step 5 (`setCubies` vs direct
  `useGameStore.setState({ cubies: ... })`).

---

## Files to Change

| File | Status | Change |
|---|---|---|
| `src/worm/healerWorm/constants.js` | **TODO 2.4** | Add `HEAL_COST = 4` |
| `src/hooks/useGameStore.js` | **TODO 2.1–2.3** | Add `wormHealingProgress` + setter + resets |
| `src/worm/wormLogic.js` | **TODO 3** | Add `getStableKey` + `findStickerByStableKey` |
| `src/worm/HealerWormMode.jsx` | **TODO 4,5,6** | Deposit in entry, gate at exit, TunnelHealProgress |
| `src/worm/OrbInventoryHUD.jsx` | **TODO 7.1–7.3** | Mobile reposition + small-screen breakpoint |
| `src/worm/WormCrawlerHUD.jsx` | **TODO 8** | Tutorial hint, death-menu stat |
| `src/game/cubeState.js` | Read-only | `healSticker()` — exists, no changes needed |

---

## Complete Deposit Pseudocode

```
In beginTunnelTransition(x, y, z, dirKey):

  [existing] if !resolved: return
  [existing] if void: killWorm(); return
  [existing] traversal count check / void on 4th: killWorm(); return

  [NEW] liveCubies = useGameStore.getState().cubies
  [NEW] entryFaceId = liveCubies[x][y][z].stickers[dirKey].curr
  [NEW] stableKey = getStableKey(x, y, z, dirKey, liveCubies)
  [NEW] currentTunnelStableKeyRef.current = stableKey
  [NEW] if stableKey && entryFaceId:
          progress   = wormHealingProgress[stableKey] ?? { deposited: 0 }
          orbsOnWorm = floor((tailLength - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH)
          available  = wormOrbInventory[entryFaceId] ?? 0
          n          = min(available, HEAL_COST - progress.deposited, orbsOnWorm)
          if n > 0:
            tailLength -= n * ORB_SEGMENT_GROWTH  (clamp to BASE_TAIL_LENGTH)
            orbPickupColorsRef = orbPickupColorsRef.slice(0, -n)
            setWormBodyTiles(floor((tailLength - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH))
            setWormOrbInventory({ ...inv, [faceId]: inv[faceId] - n })
            setWormHealingProgress({ ...progress, [stableKey]: { deposited: prev+n, faceId } })

  [existing] activeTunnel.current = tunnel
  [existing] phase = 'entering', store update, etc.

At tunnel EXIT (currently ~line 618):

  [NEW] exitedTunnel = activeTunnel.current  ← capture BEFORE it gets null-ed
  [NEW] key      = currentTunnelStableKeyRef.current
  [NEW] progress = wormHealingProgress[key]
  [NEW] if progress?.deposited >= HEAL_COST && exitedTunnel:
          healed = healSticker(cubies, size, entry.x, entry.y, entry.z, entry.dirKey)
          healed = healSticker(healed, size, exit.x, exit.y, exit.z, exit.dirKey)
          setCubies(healed)
          delete wormHealingProgress[key]
          setWormHealingProgress(newProgress)
          healedRef++
          setWormHealedCount(healedRef)
       else:
          // no heal — progress saved, tile stays flipped
```

---

## Constants Reference

```js
// healerWorm/constants.js (existing)
BASE_TAIL_LENGTH   = 4    // visual balls in default worm
ORB_SEGMENT_GROWTH = 2    // balls added per orb pickup
MAX_TAIL           = 1200

// TO ADD:
HEAL_COST = 4             // orbs required to heal one tunnel

// useGameStore (existing)
wormOrbInventory:    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
// TO ADD:
wormHealingProgress: {}   // { 'PZ-1-2-2': { deposited: 2, faceId: 2 } }
```
