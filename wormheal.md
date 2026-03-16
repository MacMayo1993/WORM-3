# Tunnel Healing Feature — Implementation Guide

> **Branch:** `claude/plan-tunnel-healing-eyyqW`
> **Goal:** Allow the worm to heal flipped tunnels by auto-depositing color orbs on entry.

---

## Feature Summary

When the worm enters a tunnel, it automatically deposits matching-color orbs from its inventory toward healing that tunnel. Each tunnel costs **4 orbs** of the matching entry color to heal. Partial deposits persist across cube rotations. When healed, the sticker is restored to its original color and the tunnel collapses.

### Rules
- **Cost:** 4 orbs per tunnel (fixed)
- **Trigger:** Auto-deposit on tunnel entry
- **Color matching:** Orb color must match the tunnel's entry-side face color
- **Worm shrinks:** Depositing N orbs removes N segments from the tail
- **Partial progress:** Persists across cube rotations (keyed by sticker identity, not tunnel ID)
- **Minimum worm length:** Always keep at least 1 segment (the head)
- **UI:** Floating number above tunnel entry portal + Orb inventory HUD

---

## Progress Tracker

### Step 1 — Orb Inventory State & HUD
- [ ] 1.1 Add `faceId` field to surface-mode orb objects in `spawnOrbs()` (`wormLogic.js`)
- [ ] 1.2 Add `faceId` field to tunnel-mode orb objects in `spawnTunnelOrbs()` (`wormLogic.js`)
- [ ] 1.3 Add `orbInventory` state (`{ 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 }`) to `useWormGame` (`WormMode.jsx`)
- [ ] 1.4 Add `orbInventory` state to `useTunnelWormGame` (`WormMode.jsx`)
- [ ] 1.5 Reset `orbInventory` in both `restart` handlers
- [ ] 1.6 Wire `setOrbInventory` into `WormGameLoop`: increment `orbInventory[faceId]` when orb is eaten
- [ ] 1.7 Wire `setOrbInventory` into `TunnelWormGameLoop`: increment `orbInventory[faceId]` when orb is eaten
- [ ] 1.8 Expose `orbInventory` and `setOrbInventory` from both hooks' return objects
- [ ] 1.9 Pass `orbInventory` through context in `WormModeGame.jsx` (add to `onGameStateChange` payload)
- [ ] 1.10 Create `src/worm/OrbInventoryHUD.jsx` — color-coded orb count display
- [ ] 1.11 Render `OrbInventoryHUD` inside `WormModeHUD` in `WormModeGame.jsx`

**Test:** Eat orbs in both surface and tunnel mode, confirm counts appear and increment correctly.

---

### Step 2 — Stable Key System
- [ ] 2.1 Add `getStableKey(x, y, z, dirKey, cubies)` helper to `wormLogic.js`
  - Looks up `sticker.origPos` and `sticker.origDir` for the sticker at `(x, y, z, dirKey)`
  - Returns `"${origDir}-${origPos.x}-${origPos.y}-${origPos.z}"` (never changes across rotations)
- [ ] 2.2 Add `getTunnelEntryStableKey(tunnel, enteringFromEntry, cubies)` to `wormLogic.js`
  - Selects entry or exit position based on travel direction
  - Calls `getStableKey` to return the stable key for the side being entered

**Test:** Log stable keys on tunnel entry; confirm same key appears after rotating the cube and re-entering the same tunnel.

---

### Step 3 — Healing Progress State
- [ ] 3.1 Add `healingProgress` state to `useTunnelWormGame`:
  ```js
  // Map<stableKey, { deposited: number, color: faceId }>
  const [healingProgress, setHealingProgress] = useState({});
  ```
- [ ] 3.2 Add `HEAL_COST = 4` constant near `TUNNEL_CONFIG` in `WormMode.jsx`
- [ ] 3.3 Reset `healingProgress` to `{}` in `restart` handler
- [ ] 3.4 Expose `healingProgress` and `setHealingProgress` from `useTunnelWormGame` return object
- [ ] 3.5 Pass `healingProgress` through context in `WormModeGame.jsx`

---

### Step 4 — Auto-Deposit Logic (Tunnel Entry)
> Hooks into the existing "exited tunnel → find next tunnel → enter new tunnel" block in `TunnelWormGameLoop`.

- [ ] 4.1 Import `getStableKey`, `getTunnelEntryStableKey` into `WormMode.jsx`
- [ ] 4.2 Pull `orbInventory`, `setOrbInventory`, `healingProgress`, `setHealingProgress` from `game` in `TunnelWormGameLoop`
- [ ] 4.3 After `setTunnelsTraversed` (new tunnel entered), run deposit logic:
  ```
  entryFaceId  = enteringFromEntry ? newTunnel.entryColor : newTunnel.exitColor
  stableKey    = getTunnelEntryStableKey(newTunnel, enteringFromEntry, cubies)
  deposited    = healingProgress[stableKey]?.deposited ?? 0
  remaining    = HEAL_COST - deposited
  available    = orbInventory[entryFaceId] ?? 0
  canDeposit   = Math.min(available, remaining, worm.length - 1)  // keep head
  ```
- [ ] 4.4 If `canDeposit > 0`:
  - Decrement `orbInventory[entryFaceId]` by `canDeposit`
  - Increment `healingProgress[stableKey].deposited` by `canDeposit`
  - Remove `canDeposit` segments from worm tail (splice last N)
- [ ] 4.5 If `deposited + canDeposit >= HEAL_COST`:
  - Call `healSticker(cubies, size, x, y, z, dirKey)` for the entry sticker
  - Call `setCubies(updatedCubies)` to commit
  - Remove `stableKey` from `healingProgress`
  - Award `TUNNEL_HEAL_BONUS` points (suggest 150)
  - Play heal sound
  - Eject worm from tunnel (tunnel will collapse on next `getActiveTunnels()` call)

**Test:** Enter a tunnel with matching color orbs; confirm orbs deposit, worm shrinks, tunnel heals when count reaches 4.

---

### Step 5 — Tunnel Progress Indicator (3D Floating Number)
- [ ] 5.1 Pass `healingProgress` as prop to `WormTunnelNetwork` via `WormMode3D`
- [ ] 5.2 In `WormTunnelNetwork.jsx`, import `Html` from `@react-three/drei`
- [ ] 5.3 For each tunnel in `healingProgress` with `deposited > 0 && deposited < HEAL_COST`:
  - Find matching tunnel object by stable key (may need to store stable key on tunnel objects, or look up by entry coords)
  - Render `<Html>` positioned at tunnel entry portal world position
  - Display `HEAL_COST - deposited` remaining orbs
  - Color the text to match `tunnel.entryColor`
- [ ] 5.4 Tunnels with no progress (or fully healed) show no indicator
- [ ] 5.5 Style: monospace font, semi-transparent background, glow effect matching face color

**Test:** Deposit partial orbs, see number floating above tunnel; deposit more, see number decrement; fully heal, number disappears with tunnel.

---

### Step 6 — Polish & Edge Cases
- [ ] 6.1 Worm entering from exit side uses `tunnel.exitColor` for matching (not always `entryColor`)
- [ ] 6.2 Partial deposit when worm is too short (e.g. only 2 segments, needs 3): deposit max possible, progress saved
- [ ] 6.3 Worm ejects gracefully when tunnel heals mid-traversal (already handled by tunnel collapse → `findNextTunnel`)
- [ ] 6.4 `healingProgress` stable keys survive cube rotations — verify by rotating and re-entering
- [ ] 6.5 Add tunnel heal instruction to `WormModeStartScreen` instructions for tunnel mode
- [ ] 6.6 Mobile: `OrbInventoryHUD` fits well on small screens (compact layout)
- [ ] 6.7 Reset `healingProgress` on `restart`

---

## Architecture Reference

### Key Files
| File | Role |
|---|---|
| `src/worm/WormMode.jsx` | Game hooks (`useWormGame`, `useTunnelWormGame`) + game loops |
| `src/worm/WormModeGame.jsx` | Context provider + HUD wiring |
| `src/worm/WormHUD.jsx` | Existing score/stats HUD |
| `src/worm/WormTunnelNetwork.jsx` | 3D tunnel tube/portal rendering |
| `src/worm/wormLogic.js` | Pure game logic helpers |
| `src/worm/OrbInventoryHUD.jsx` | **NEW** — color orb count display |
| `src/utils/constants.js` | `FACE_COLORS`, `ANTIPODAL_COLOR` |
| `src/game/cubeState.js` | `healSticker()` — restores a flipped sticker |

### Stable Key Formula
```js
// In wormLogic.js
export function getStableKey(x, y, z, dirKey, cubies) {
  const sticker = cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
  if (!sticker) return null;
  const { origPos, origDir } = sticker;
  return `${origDir}-${origPos.x}-${origPos.y}-${origPos.z}`;
}
```

### Orb Inventory Shape
```js
// Face IDs 1-6 map to: Red, Green, White, Orange, Blue, Yellow
orbInventory: { 1: 0, 2: 3, 3: 0, 4: 0, 5: 2, 6: 0 }
```

### Healing Progress Shape
```js
// stableKey → deposit record
healingProgress: {
  'PZ-1-2-2': { deposited: 2, color: 2 },  // 2 green in, 2 remaining
}
```

### Deposit Logic (Pseudocode)
```
On entering a new tunnel:
  faceId    = enteringFromEntry ? tunnel.entryColor : tunnel.exitColor
  key       = getStableKey(entry.x, entry.y, entry.z, entry.dirKey, cubies)
  deposited = healingProgress[key]?.deposited ?? 0
  remaining = HEAL_COST - deposited
  available = orbInventory[faceId] ?? 0
  n         = Math.min(available, remaining, worm.length - 1)

  if n > 0:
    orbInventory[faceId] -= n
    healingProgress[key].deposited += n
    worm.splice(worm.length - n, n)   // shrink tail

  if (deposited + n) >= HEAL_COST:
    healSticker(...)
    setCubies(...)
    delete healingProgress[key]
    score += TUNNEL_HEAL_BONUS
```

---

## Constants to Add
```js
// In WormMode.jsx near TUNNEL_CONFIG
const HEAL_COST = 4;
const TUNNEL_HEAL_BONUS = 150;
```

---

## Notes
- Tunnel IDs are **dynamic** (rebuilt on every rotation). Always use stable keys for `healingProgress`.
- Orbs must carry `faceId` (integer 1-6) in addition to `color` (hex string) from Step 1 onward.
- Surface mode does not use tunnel healing — only `useTunnelWormGame` / `TunnelWormGameLoop` need the new state.
- `spawnTunnelOrbs` already uses `tunnel.entryColor` for orb color — just add `faceId: tunnel.entryColor` to the orb object.
