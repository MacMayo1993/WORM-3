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
- **Trigger:** Auto-deposit at `beginTunnelTransition` (moment of tunnel entry commitment)
- **Color matching:** Orb faceId must match the flipped sticker's current face color
- **Worm shrinks:** Each deposited orb removes `ORB_SEGMENT_GROWTH` (= 2) visual balls from tail
- **Minimum worm length:** Never shrink below `BASE_TAIL_LENGTH` (= 4 balls); deposit only what worm can spare
- **Partial progress:** Persists across cube rotations (keyed by sticker origPos+origDir, not tile position)
- **Healing happens at tunnel exit** — only if deposit requirements have been fully met
- **UI — Mobile first:** Orb inventory in top bar area (not bottom — d-pad and jump button live there)
- **UI — Tunnel indicator:** Floating "orbs remaining" number above each portal ring on the cube surface

---

## Actual Architecture (HealerWormMode)

> **Critical:** The live worm mode is `HealerWormMode.jsx`, NOT `WormMode.jsx` / `TunnelWormGameLoop`.
> Earlier steps 1.1–1.9 in WormMode.jsx are complete but are for a separate, unused worm variant.
> All remaining steps target HealerWormMode's actual data flow.

### Data Flow Diagram
```
HealerWormMode.jsx (Canvas, inside R3F)
  └── useWormCrawler()          ← all game logic: movement, orbs, tunnels, healing
        ├── tailLength (ref)    ← visual ball count (BASE_TAIL_LENGTH=4, +ORB_SEGMENT_GROWTH=2 per orb)
        ├── orbPickupColorsRef  ← hex colors in pickup order, drives WormBody coloring
        ├── beginTunnelTransition()  ← called when worm commits to entering a flipped tile
        └── useFrame() loop     ← movement, orb pickup, tunnel phase progression

useGameStore (Zustand)          ← all state that needs to reach the HUD
  ├── wormOrbInventory          ← { 1:N, 2:N, 3:N, 4:N, 5:N, 6:N } [DONE in Step 1]
  ├── wormHealingProgress       ← { [stableKey]: { deposited, faceId } }  [TODO Step 2]
  ├── wormBodyTiles             ← total orb count on worm (already exists)
  └── wormHealedCount           ← healed tunnel count (already exists)

WormCrawlerHUD.jsx (DOM overlay)
  └── OrbInventoryHUD.jsx       ← reads wormOrbInventory [DONE in Step 1, needs repositioning]

WormholeRings component (Canvas, 3D)
  └── TunnelHealProgress        ← NEW: floating orbs-remaining numbers above portal rings [TODO Step 4]
```

### Key Functions in useWormCrawler
| Function / Ref | What it does |
|---|---|
| `beginTunnelTransition(x, y, z, dirKey)` | Commits worm to entering a tunnel — **deposit hook goes here** |
| `resolveTunnelAtTile(x, y, z, dirKey)` | Returns `{ tunnel, tunnelKey }` for a flipped tile |
| `applyOrbPickupGrowth(color, faceId)` | Grows worm on orb pickup — **inverse of this is needed for shrink** |
| `tailLength` (ref) | Visual ball count — shrink by `n * ORB_SEGMENT_GROWTH` when depositing |
| `orbPickupColorsRef` (ref) | Trim last `n` entries when depositing (removes tail color segments) |
| `useFrame` → exit block (~line 616) | Where `wormHealedCount` increments — **gate healing on deposit completion** |
| `tunnelUseCountsRef` | Tracks how many times each tunnel has been used |
| `voidTunnelKeysRef` | Void (dead) tunnels — do not deposit into void tunnels |

### Stable Key Formula
```js
// A sticker's origPos + origDir never change regardless of cube rotation.
// Use this as the key for healingProgress so partial progress survives rotations.
function getStableKey(x, y, z, dirKey, cubies) {
  const sticker = cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
  if (!sticker) return null;
  const { origPos, origDir } = sticker;
  return `${origDir}-${origPos.x}-${origPos.y}-${origPos.z}`;
}
```

### Worm Shrink Formula
```js
// Depositing n orbs from the tail:
const shrinkBalls = n * ORB_SEGMENT_GROWTH;
tailLength.current = Math.max(BASE_TAIL_LENGTH, tailLength.current - shrinkBalls);
orbPickupColorsRef.current = orbPickupColorsRef.current.slice(0, -n);
const orbsOnWorm = Math.max(0, Math.floor((tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH));
useGameStore.getState().setWormBodyTiles(orbsOnWorm);
```

### Max Depositable Orbs
```js
// Never let worm go below BASE_TAIL_LENGTH
const orbsOnWorm = Math.floor((tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH);
const available   = wormOrbInventory[entryFaceId] ?? 0;
const deposited   = wormHealingProgress[stableKey]?.deposited ?? 0;
const remaining   = HEAL_COST - deposited;
const canDeposit  = Math.min(available, remaining, orbsOnWorm);
```

---

## Progress Tracker

### Step 1 — Orb Inventory State & HUD ✅ COMPLETE
- [x] 1.1 Add `faceId` to surface orb objects in `spawnOrbs()` (`wormLogic.js`)
- [x] 1.2 Add `faceId` to tunnel orb objects in `spawnTunnelOrbs()` (`wormLogic.js`)
- [x] 1.3–1.9 Wire `orbInventory` through `WormMode.jsx` hooks and `WormModeGame.jsx` context
  _(These are for the unused WormMode.jsx variant — correct but not the live game path)_
- [x] 1.10 Create `src/worm/OrbInventoryHUD.jsx`
- [x] 1.11 Add `wormOrbInventory` to Zustand store with resets in `clearDisparityGame` / `initWormMode`
- [x] 1.12 Increment `wormOrbInventory[faceId]` in `applyOrbPickupGrowth` in `HealerWormMode.jsx`
- [x] 1.13 Reset `wormOrbInventory` on worm reset in `HealerWormMode.jsx`
- [x] 1.14 Subscribe to `wormOrbInventory` in `WormCrawlerHUD`, render `OrbInventoryHUD`

**⚠️ Remaining Step 1 polish:**
- [ ] 1.15 **Mobile:** Reposition `OrbInventoryHUD` — move from `bottom-center` to `top-center` just below
  the top info bar, since bottom is occupied by d-pad (right) and jump button (left) on mobile
- [ ] 1.16 **Mobile:** On very small screens (width < 380px), reduce orb dot to 8px and font to 12px
- [ ] 1.17 **Desktop:** On wider screens, the HUD can be slightly larger with abbreviated color names
  shown below each dot (RED, GRN, etc.)
- [ ] 1.18 Only show the HUD when `wormAlive` is true AND at least 1 orb is in inventory (already handled
  by `activeEntries.length === 0` check, but verify it hides on death/respawn)

---

### Step 2 — Healing Progress State (Zustand)
> All HealerWormMode state lives in the Zustand store, NOT in local React state.

- [ ] 2.1 Add `wormHealingProgress` to `useGameStore.js`:
  ```js
  wormHealingProgress: {},  // { [stableKey]: { deposited: number, faceId: number } }
  setWormHealingProgress: (v) => set({ wormHealingProgress: v }),
  ```
- [ ] 2.2 Add `HEAL_COST = 4` constant to `src/worm/healerWorm/constants.js`
- [ ] 2.3 Reset `wormHealingProgress: {}` in `clearDisparityGame` (one-liner, same pattern as others)
- [ ] 2.4 Reset `wormHealingProgress: {}` in `initWormMode` (same one-liner)
- [ ] 2.5 Reset `wormHealingProgress` in the worm reset block inside `useWormCrawler`
  (around line 675 where `wormBodyTiles: 0` is set via `useGameStore.setState`)
- [ ] 2.6 Add `getStableKey(x, y, z, dirKey, cubies)` helper to `src/worm/wormLogic.js`
  (formula above — pure function, easily testable)

**Test:** Log `wormHealingProgress` from store; confirm it starts empty and persists across cube
rotations (stable key should be identical before and after rotating the cube).

---

### Step 3 — Auto-Deposit on Tunnel Entry
> Hook into `beginTunnelTransition` in `useWormCrawler`. This is the single point where
> the worm commits to entering a flipped tile tunnel. Void tunnels (`voidTunnelKeysRef`) are skipped.

- [ ] 3.1 Import `getStableKey` from `wormLogic.js` into `HealerWormMode.jsx`
- [ ] 3.2 Import `HEAL_COST` from `healerWorm/constants.js`
- [ ] 3.3 At the TOP of `beginTunnelTransition`, after `resolved` is confirmed and before void check,
  run deposit logic:
  ```
  sticker  = cubies[x][y][z].stickers[dirKey]
  faceId   = sticker.curr                         ← face color to match
  key      = getStableKey(x, y, z, dirKey, cubies)
  progress = wormHealingProgress[key] ?? { deposited: 0, faceId }
  deposited = progress.deposited
  remaining = HEAL_COST - deposited
  orbsOnWorm = floor((tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH)
  available  = wormOrbInventory[faceId] ?? 0
  n          = min(available, remaining, orbsOnWorm)
  ```
- [ ] 3.4 If `n > 0`, apply deposit:
  - Shrink worm: `tailLength.current -= n * ORB_SEGMENT_GROWTH` (clamp to BASE_TAIL_LENGTH)
  - Trim colors: `orbPickupColorsRef.current = orbPickupColorsRef.current.slice(0, -n)`
  - Sync store: `setWormBodyTiles(floor((tailLength - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH))`
  - Decrement inventory: `setWormOrbInventory({ ...prev, [faceId]: prev[faceId] - n })`
  - Update progress: `setWormHealingProgress({ ...prev, [key]: { deposited: deposited + n, faceId } })`
- [ ] 3.5 Skip deposit for void tunnels (`voidTunnelKeysRef.current.has(tunnelKey)`) — check this
  BEFORE running deposit so player doesn't lose orbs to a dead tunnel
- [ ] 3.6 Skip deposit if worm is already at minimum length (`orbsOnWorm === 0`)

**Test:** Enter a tunnel with 2 matching orbs (not enough to heal), confirm worm shrinks by
2 × ORB_SEGMENT_GROWTH = 4 balls, inventory decrements, progress shows `{ deposited: 2 }`.

---

### Step 4 — Healing Completion at Tunnel Exit
> The tunnel exit is in the `useFrame` block where `phase.current` transitions from `'tunnel'` to
> `'crawling'` — around line 613–618 in `HealerWormMode.jsx` where `healedRef.current` is incremented.

- [ ] 4.1 At the tunnel-exit point, read `wormHealingProgress[key]` for the tunnel just traversed
  - Use the entry sticker of `activeTunnel.current.entry` to get `key`
- [ ] 4.2 If `progress.deposited >= HEAL_COST`:
  - The existing heal (`wormHealedCount++`) already fires — keep it
  - The `healSticker` function from `cubeState.js` is already called or equivalent — verify and ensure
    the sticker is actually restored (check if HealerWormMode calls `healSticker` or relies on
    flipStickerPair; trace the actual heal path)
  - Remove entry from `wormHealingProgress` (clean up)
  - Play success sound (or use existing heal sound)
- [ ] 4.3 If `progress.deposited < HEAL_COST` (partial only):
  - Do NOT heal the tunnel — worm passes through but tile stays flipped
  - Do NOT increment `wormHealedCount` for this traversal
  - The portal ring stays visible; progress is saved for next entry
- [ ] 4.4 If `progress` is null (0 deposited):
  - Same as 4.3 — pass-through with no effect (worm can traverse without healing)

> **Note:** This changes the existing "auto-heal on traversal" behavior. Currently every tunnel
> traversal heals. After this step, healing requires 4 orbs total across ≥1 traversal.

**Test:** Enter a tunnel 0 orbs → tile stays. Enter with 2 → progress saves, tile stays.
Enter again with 2 more → tile heals, ring disappears, `wormHealedCount` increments.

---

### Step 5 — Tunnel Progress Indicator (3D floating numbers)
> A floating "orbs remaining" number above each portal ring on the cube surface.
> `WormholeRings` in `HealerWormMode.jsx` already renders spinning rings at every flipped tile.
> Add a sibling component `TunnelHealProgress` that renders numbers at the same positions.

- [ ] 5.1 Create `TunnelHealProgress` component inside `HealerWormMode.jsx` (or in its own file if large):
  ```jsx
  function TunnelHealProgress({ size }) {
    // Reads wormHealingProgress and debouncedCubies from store
    // For each entry in progress, finds the tile world position
    // Renders a floating <Html> or <Text> above the portal ring
  }
  ```
- [ ] 5.2 Position: use `getStickerWorldPos(x, y, z, dirKey, size, 0)` + face normal lift (~0.4 units)
  to place the number just above the tile surface where the ring spins
- [ ] 5.3 Content: show `HEAL_COST - deposited` (e.g. "2" means 2 more orbs needed)
- [ ] 5.4 Color: match the face color of the sticker (`FACE_COLORS[faceId]`)
- [ ] 5.5 Use `<Html>` from `@react-three/drei` for crisp text — easier to style than `<Text>`
- [ ] 5.6 Only render when `deposited > 0 && deposited < HEAL_COST` (no number if untouched or done)
- [ ] 5.7 Add `TunnelHealProgress` to the render tree in `HealerWormMode` alongside `WormholeRings`
- [ ] 5.8 **Mobile sizing:** `<Html>` content should use `font-size: 18px` minimum on mobile,
  `font-size: 14px` on desktop — numbers must be legible on a 375px wide screen with the cube
  taking up most of the viewport

**Test:** Deposit 1 orb into a green tunnel; confirm "3" appears above that portal ring in green.
Deposit 2 more; confirm "1" shows. Deposit final; number disappears along with the ring.

---

### Step 6 — OrbInventoryHUD Mobile/Desktop Polish
> The HUD is rendered inside `WormCrawlerHUD`. The current bottom-center position conflicts with
> mobile touch controls. This step finalizes layout for both platforms.

**Layout targets:**
- **Mobile (width ≤ 768px):** Place HUD in a horizontal strip just below the top bar panel
  (currently `top: 76px` to `top: 134px` is the progress panel zone). The orb row can sit at
  `top: 76px, left: 12px` in a compact pill, OR be inlined into the top bar's right section
  alongside the existing ORBS / HEALED / NEXT WORMHOLE stats.
- **Desktop (width > 768px):** Can stay bottom-center or move to bottom-left above the jump area.

- [ ] 6.1 Audit actual rendered positions with devtools on a 390×844 viewport (iPhone 14 size):
  - D-pad: bottom-right grid occupies ~`right:4, bottom:4` to ~`right:220, bottom:220`
  - Jump button: bottom-left `left:4, bottom:4`, min-width 198px, height ~72px
  - Top bar: `top:12, left:12, right:12`, height ~56px
  - Progress panel: `top:76, left:12`, width 210px
- [ ] 6.2 Move `OrbInventoryHUD` to `position: absolute, top: 76px, right: 12px` on mobile
  (right side below top bar, opposite the progress panel) — or inline into top bar
- [ ] 6.3 Inline option (simpler): Add orb dots directly into the top bar's right `<div>`,
  between the ORBS count and the SPEED slider — minimal footprint, no new position to manage
- [ ] 6.4 On desktop: keep bottom-center but raise it: `bottom: 100px` to clear the jump button
- [ ] 6.5 When worm has 0 orbs in inventory (all used or not collected yet): HUD is hidden — verify
  this graceful empty state looks fine (no layout jumps)
- [ ] 6.6 Add a subtle entrance animation (CSS transition on opacity 0→1) when an orb color
  first appears in inventory — gives the player feedback without them having to look at the HUD
- [ ] 6.7 **White orb (faceId: 3):** The white dot (`#ffffff`) is invisible on the white/glass
  background of the top bar panel. Add a thin colored ring/border around it: `border: 2px solid #ccc`
  already exists in `OrbInventoryHUD.jsx` for `isWhite` — verify this is visible on the actual background

---

### Step 7 — WormModeStartScreen & Tutorial Text
- [ ] 7.1 Update the tunnel-mode instructions in `WormModeStartScreen` (in `WormModeGame.jsx`) to
  mention the healing mechanic:
  _"Collect color orbs to heal flipped tunnels — 4 matching orbs closes a portal"_
- [ ] 7.2 Add a short in-game hint in `WormCrawlerHUD` that appears the FIRST TIME the player enters
  a tunnel with 0 matching orbs: `"Need [color] orbs to heal this tunnel"` — show for 2s then fade
  _(Store a `wormFirstTunnelHint` boolean in Zustand to prevent repeat)_
- [ ] 7.3 In the death menu stats, add `"Tunnels Healed: N"` if `wormHealedCount > 0`

---

### Step 8 — Edge Cases & Regression
- [ ] 8.1 **Void tunnels:** Deposit is skipped before void check (Step 3.5). Verify worm doesn't
  lose orbs entering a void tunnel, then gets killed by it
- [ ] 8.2 **Worm at minimum length:** `orbsOnWorm = 0` → `canDeposit = 0` → no shrink, no deposit.
  Progress is not updated. Portal ring stays as-is.
- [ ] 8.3 **Multiple tunnel traversals to fully heal:** Enter 3 times with 1-2 orbs each time.
  Stable key persists; progress accumulates; heals on the traversal that pushes to ≥ 4.
- [ ] 8.4 **Cube rotation mid-game:** Stable key uses `origPos`/`origDir` — confirm correct sticker
  is still targeted after rotation using `getStableKey`.
- [ ] 8.5 **Sticker color change after rotation:** `faceId` in progress is locked at first-deposit
  time. If the sticker's `curr` changes (it shouldn't for a flipped sticker), handle gracefully.
- [ ] 8.6 **Jump + tunnel:** Player jumps OVER a flipped tile — `pendingTunnelTrigger` is cleared on
  jump (`startJump` sets it to null). Confirm no deposit occurs when jumping.
- [ ] 8.7 **Worm restart:** `wormHealingProgress: {}` reset in Step 2.5. Verify portal rings revert
  to "no progress" state (they read from `wormHealingProgress`).
- [ ] 8.8 **Performance:** `getStableKey` is called in `beginTunnelTransition`, not in `useFrame` —
  no per-frame cost. `wormHealingProgress` store reads in `TunnelHealProgress` use debounced cubies.

---

## Files Changed / To Change

| File | Status | Change |
|---|---|---|
| `src/worm/wormLogic.js` | ✅ Done | `faceId` on orbs; `getStableKey()` to add |
| `src/worm/WormMode.jsx` | ✅ Done | `orbInventory` state (unused variant) |
| `src/worm/WormModeGame.jsx` | ✅ Done | Context wiring (unused variant) |
| `src/worm/OrbInventoryHUD.jsx` | ✅ Done, needs reposition | Color orb count display |
| `src/worm/HealerWormMode.jsx` | ✅ Partial / TODO 3,4,5 | Main game logic |
| `src/worm/WormCrawlerHUD.jsx` | ✅ Done, needs layout fix | Reads store, renders HUD |
| `src/worm/healerWorm/constants.js` | TODO 2.2 | Add `HEAL_COST = 4` |
| `src/hooks/useGameStore.js` | ✅ Partial / TODO 2.1-2.4 | `wormOrbInventory` done; `wormHealingProgress` to add |
| `src/game/cubeState.js` | Read-only | `healSticker()` — already exists, verify usage |

---

## Constants Reference
```js
// healerWorm/constants.js
BASE_TAIL_LENGTH  = 4    // visual balls in the default worm (no orbs)
ORB_SEGMENT_GROWTH = 2   // visual balls added per orb pickup
MAX_TAIL           = 1200

// To add:
HEAL_COST = 4            // orbs required to heal one tunnel
```

## Store Shape Reference
```js
// useGameStore
wormOrbInventory:    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }  // ✅ exists
wormHealingProgress: { 'PZ-1-2-2': { deposited: 2, faceId: 2 } } // TODO
```

## Deposit Pseudocode (complete)
```
In beginTunnelTransition(x, y, z, dirKey):

  if voidTunnelKeysRef.current.has(tunnelKey): return early (no deposit)

  sticker    = cubies[x][y][z].stickers[dirKey]
  faceId     = sticker.curr
  key        = getStableKey(x, y, z, dirKey, cubies)
  progress   = wormHealingProgress[key] ?? { deposited: 0, faceId }
  orbsOnWorm = floor((tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH)
  available  = wormOrbInventory[faceId] ?? 0
  n          = min(available, HEAL_COST - progress.deposited, orbsOnWorm)

  if n > 0:
    tailLength.current = max(BASE_TAIL_LENGTH, tailLength.current - n * ORB_SEGMENT_GROWTH)
    orbPickupColorsRef.current = orbPickupColorsRef.current.slice(0, -n)
    setWormBodyTiles(floor((tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH))
    setWormOrbInventory({ ...wormOrbInventory, [faceId]: wormOrbInventory[faceId] - n })
    setWormHealingProgress({ ...wormHealingProgress, [key]: { deposited: progress.deposited + n, faceId } })

At tunnel EXIT:
  key      = getStableKey(entry.x, entry.y, entry.z, entry.dirKey, cubies)
  progress = wormHealingProgress[key]
  if progress?.deposited >= HEAL_COST:
    // existing heal fires — keep it
    // clean up progress entry
    setWormHealingProgress(omit(wormHealingProgress, key))
  else:
    // suppress default heal — tile stays flipped, progress saved
    skip the wormHealedCount increment this traversal
```
