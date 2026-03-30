# WORM³ Implementation Roadmap

Full vision for Disparity Mode (Parity Roulette), WORM Mode, and the Parity Store.

---

## Current State Snapshot

| System | Status |
|---|---|
| WORM surface crawl | ✅ Working |
| WORM platformer co-op | ✅ Working |
| Worm appearance (skins + hats) | ✅ Built |
| Disparity chaos simulation | ✅ Working (passive spectator) |
| Parity Points currency | ❌ Does not exist |
| Disparity betting/earning | ❌ Does not exist |
| Store UI | ❌ Placeholder only |
| Antipodal split-screen mode | ❌ Not started |
| CPU opponent | ❌ Not started |
| Worm progression/XP | ❌ Not started |

---

## Phase 1 — Economy Foundation
**Unblocks everything. Build this first.**

### 1.1 Parity Points Wallet

**New state in `useGameStore.js`:**
```js
parityPoints: number           // current balance (persisted)
lifetimeEarned: number         // all-time total (persisted)
ownedItems: string[]           // array of item IDs (persisted)
setParityPoints(n)
addParityPoints(amount, source) // source = 'orb' | 'disparity' | 'bonus' | 'daily'
spendParityPoints(amount)       // returns false if insufficient
ownItem(id)                     // add to ownedItems
hasItem(id)                     // check ownership
```

**Persistence:** Add a dedicated localStorage subscriber (like settings), keyed `worm3_wallet`.

**Security note:** All currency is local-only. No server validation. For a cosmetics-only store this is acceptable — there's no competitive advantage to cheating. Can add a simple checksum to the save later if needed.

### 1.2 Earning Events System

A single `earnCoins(amount, source, metadata)` action. Every earning event goes through this one path so balancing can be tuned from one place.

**WORM mode hooks (in `HealerWormMode.jsx`):**
- Orb collected → `+10 PP` base (multiply by orb face rarity: White/Yellow ×1, Red/Orange ×1.5, Green/Blue ×2)
- Run completed (all orbs collected) → `+50 PP` bonus
- Personal best tail length → `+25 PP`
- Wormhole traversal → `+5 PP`

**Disparity mode hooks (in `chaosWorker.js` / Disparity result handler):**
- Earnings are determined by the Betting System (Phase 2) — not flat rewards

**Daily login bonus:**
- `+20 PP` once per calendar day
- Tracked via `localStorage` timestamp
- Shown as a small toast notification on main menu load

### 1.3 Earning Rate Constants File

`src/utils/economyConstants.js` — all earn rates and costs in one place:
```js
export const EARN = {
  ORB_BASE: 10,
  ORB_RARITY: { 1: 1.5, 2: 2, 3: 1, 4: 1.5, 5: 2, 6: 1 }, // faceId → multiplier
  RUN_COMPLETE: 50,
  PERSONAL_BEST: 25,
  WORMHOLE: 5,
  DAILY_LOGIN: 20,
};
export const COSTS = {
  SKIN_COMMON: 100,
  SKIN_RARE: 300,
  HAT_COMMON: 75,
  HAT_RARE: 200,
  CUBE_THEME: 500,
  BACKGROUND: 400,
  TRAIL: 200,
  BUNDLE_DISCOUNT: 0.75, // 25% off bundles
};
```

### 1.4 Points Display

- Add a small `PP` counter to the main menu (top-left corner) showing current balance with a coin icon
- Animate when points are earned (number ticks up, brief glow)
- Show earning toast in WORM HUD when orbs are collected (`+10 ✦`)

---

## Phase 2 — Disparity Mode: Parity Roulette

**Concept:** The chaos simulation IS the roulette wheel. Players bet on outcomes before the wheel spins. The mathematical unpredictability of the manifold tile-elimination makes this fair and non-gameable.

### 2.1 Betting Interface

Replace the current "watch passively" start with a pre-game betting screen:

**Bet types (from simple to complex):**

| Bet | Description | Odds | Payout |
|---|---|---|---|
| **Survival color** | Which face color survives longest | 1 in 6 | 4× |
| **Antipodal pair winner** | Which antipodal pair is last standing | 1 in 13 | 10× |
| **First elimination** | Which face is eliminated first | 1 in 6 | 4× |
| **Survivor count** | How many tiles survive (1 or 2) | ~50/50 | 1.8× |
| **Integrity finish** | Does integrity finish above K\* (≈0.72)? | varies | 2× |
| **Chaos over/under** | Will game last more or fewer than N flips? | ~50/50 | 1.8× |

**Stake tiers:**
- Low: 10–50 PP
- Medium: 50–250 PP
- High: 250–1000 PP
- Max: 1000 PP (unlocks after 10 games played)

**Streak multiplier:** Win 3+ bets in a row → `×1.25` multiplier on next payout. Win 5+ → `×1.5`. Resets on loss.

**File:** New `src/components/screens/DisparityBettingScreen.jsx`

### 2.2 Bet Resolution

After the chaos simulation finishes (winner announced), the existing `DisparityWinnerScreen` is extended to show:
- The result vs. the player's bet
- Coins won/lost with animation
- Running total update
- "Play Again" → returns to betting screen with current balance shown

**Hook point:** In `App.jsx` `handleDisparitySetupComplete` → after wizard, show betting screen before starting the chaos simulation.

### 2.3 Chaos Simulation as Theater

The current simulation runs invisibly in a worker and results arrive instantly. For the roulette experience, it should feel like a wheel spinning:

- **Slow-start option:** Add a `simulationSpeed` param to the chaos worker — start at 0.3× speed, ramp to 1× as tiles die. Creates tension.
- **Face highlights:** As each face is eliminated, the cube flashes that face color
- **Countdown to result:** When ≤3 tiles remain, show a dramatic countdown overlay

### 2.4 Daily Disparity Challenge

One free daily game with a fixed-seed simulation:
- Same starting conditions for all players on a given day
- Fixed seed → deterministic outcome
- Bonus PP for playing the daily (`+50 PP` regardless of bet outcome)
- "Hot streak" badge if player wins the daily 3 days in a row

**Implementation:** Hash today's date to a worker seed. Check `localStorage` for today's daily completion.

---

## Phase 3 — Store UI & Catalog

### 3.1 Store Screen

New `src/components/screens/StoreScreen.jsx` — full-page modal accessible from the nav pill.

**Layout:**
```
┌─────────────────────────────────┐
│  PARITY STORE       ✦ 420 PP   │
├─────────────────────────────────┤
│  [Featured] [Skins] [Hats]      │
│  [Themes]   [Trails] [Bundles]  │
├─────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│  │item│ │item│ │item│ │item│  │
│  └────┘ └────┘ └────┘ └────┘  │
└─────────────────────────────────┘
```

**Item card states:** Owned (checkmark) / Affordable (bright) / Too expensive (dimmed) / Featured (rainbow border)

### 3.2 Item Catalog

`src/utils/storeCatalog.js` — single source of truth for all purchasable items:

```js
{
  id: 'skin_royal',
  type: 'skin',          // skin | hat | theme | background | trail | bundle
  label: 'Royal',
  cost: 300,
  rarity: 'rare',        // common | rare | legendary
  preview: { skinId: 'royal' },  // or { themeId }, { backgroundId }, etc.
  unlockCondition: null, // null = always available; or e.g. { streak: 5 }
}
```

**Catalog at launch (store opens):**

*Skins (8 already built, adding 4 more):*
- Slime (free/default), Royal (200 PP), Lava (200 PP), Ocean (200 PP)
- Gold (300 PP), Cherry (300 PP), Ice (300 PP), Void (300 PP)
- Plasma (500 PP — legendary, color-shifting), Midnight (500 PP), Toxic (500 PP), Prism (800 PP — rainbow animated)

*Hats (5 already built, adding 3 more):*
- None (free), Top Hat (150 PP), Party (100 PP), Crown (300 PP), Halo (250 PP)
- Wizard Hat (400 PP), Bucket Hat (150 PP), Propeller (200 PP)

*Cube Themes (new — overrides the color scheme):*
- Neon (500 PP), Pastel (400 PP), Monochrome (400 PP), Fire & Ice (600 PP)

*Trails (new worm trail effects):*
- Sparkle (200 PP), Slime puddles (150 PP — the current default, free)
- Stars (250 PP), Rainbow (400 PP)

*Bundles:*
- Starter Pack: 3 skins + 2 hats (25% off)
- Deluxe: All hats + 2 themes (25% off)

### 3.3 Purchase Flow

1. Tap item → item detail modal slides up (preview + description + cost)
2. Preview button → apply the item temporarily in a small worm preview (reuse `CharacterSelector` CSS worm)
3. "Buy" button → confirmation dialog showing PP balance change
4. On confirm → `spendParityPoints()` + `ownItem(id)` + success animation
5. Item immediately usable — no restart required

### 3.4 Unlocking the Store Button

Remove the lock when `parityPoints >= 1` (player has earned at least one point). Show a "New!" badge on the store nav button for first visit.

---

## Phase 4 — Worm Antipodal Mode (Split-Screen PvP / Co-op)

**Concept:** Two players on the same RP² cube from antipodal perspectives. Flip tiles are literal portals between their spaces. Geometrically correct, not arbitrary.

### 4.1 Architecture

**Single shared cube state** — one `cubies` array, two worm positions. Both players interact with the same manifold.

**New state in store:**
```js
antipodalMode: bool
player1: { x, y, z, dirKey, tailLength, score, alive }
player2: { x, y, z, dirKey, tailLength, score, alive, isAI }
```

**Layout:** Reuse `PlatformerWormMode`'s dual-Canvas split-screen pattern.
- Player 1 (left/top): standard camera
- Player 2 (right/bottom): antipodal camera — `position = -1 × P1.position`, `lookAt(0,0,0)`

### 4.2 Cross-Viewport Worm Rendering

Each Canvas renders **both** worms. On Player 1's screen, Player 2 appears as a ghost (slightly transparent, different outline color). This is critical — when P1 flips through a tile and appears in P2's space, P1's character needs to be visible to P2 instantly.

**Ghost worm:** Same `WormBody` component, `opacity: 0.5`, different outline.

### 4.3 Wormhole Cross-Player Transition

When Player 1 steps on a flip tile:
1. Animate P1 through the tunnel (existing `getTunnelWorldPos` traversal)
2. P1 emerges at the antipodal exit — now in P2's half of the cube
3. P1's viewport camera transitions (smooth rotate) to the antipodal perspective
4. P2 can now see P1 as a ghost on their screen
5. Both players can now flip the same tile back — sending P1 home or trapping them

**Camera transition:** `gsap.to(camera.position, { x, y, z, duration: 0.8, ease: 'power2.inOut' })`

### 4.4 Game Modes

**Co-op:** Both players collect orbs together. Combined score. Win together.
- Orbs can only be collected by the player on that side of the cube
- Portal traversal required to reach orbs on the other side
- Win condition: all orbs collected

**1v1 Competitive:** Race to highest score.
- Collect orbs on your side (+10 PP each)
- Steal orbs from opponent's side by crossing through a portal
- "Bump" mechanic: if players collide, shorter tail loses 3 orbs
- Win condition: first to target score, or highest score when time expires

**Vs. CPU:** 1v1 against an AI opponent (Phase 5).

### 4.5 Input Routing

- Player 1: WASD or Arrow keys
- Player 2: second keyboard map (IJKL) or gamepad
- Mobile: Player 1 left half touch controls, Player 2 right half

### 4.6 Mode Selection Lobby

New `src/components/screens/AntipodalModeSelect.jsx`:
- Co-op vs 1v1 toggle
- P2: Human / CPU
- Cube size selector
- Start button

Accessible from WORM wizard as a new mode option alongside existing "Surface" and "Platformer".

---

## Phase 5 — Worm Progression & CPU AI

### 5.1 CPU Opponent AI

**Graph:** `getManifoldNeighbors(x, y, z, dirKey, size)` already returns all adjacent surface tiles — this is the graph the AI navigates.

**Difficulty tiers:**

*Easy:* Random walk. Occasionally moves toward nearest orb. Never uses portals intentionally.

*Medium:* BFS to nearest orb. Avoids dead tiles (flip tiles). Uses portals if they lead closer to target orb.

*Hard:* Full BFS with orb value weighting. Plans multi-step routes. Actively uses portals to intercept opponent's orbs in competitive mode.

**Implementation:** `src/worm/wormAI.js`
```js
export function getAIMove(pos, orbs, cubies, size, difficulty) {
  // Returns: 'L' | 'R' | 'F' | 'B'
}
```
Runs on the main thread (graph is small — max 6×N² nodes for a 5×5 cube). Called each step tick in the game loop.

### 5.2 Worm Progression

**XP System:**
- Earn XP each WORM run: `base_xp = tailLength × 10 + timeBonus + difficultyBonus`
- XP levels (1–30) with displayed level badge on worm
- Level milestones unlock cosmetic slots: Level 5 → trails, Level 10 → additional hat slot, Level 20 → animated skins available

**Score Multipliers:**
- Orb combo: collect 3+ orbs without dying → 1.2× multiplier (stacks)
- Speed bonus: collect orb within 5 seconds of spawning → ×1.5 on that orb
- Flawless run: complete without dying → 2× multiplier on all coins

**Leaderboard (local):** Top 10 runs per cube size stored in `localStorage`. Shown on the post-run screen.

### 5.3 Power-ups (Beyond Orbs)

New orb types that appear rarely alongside regular orbs:

| Power-up | Effect | Duration |
|---|---|---|
| Speed Boost | 2× movement speed | 10 seconds |
| Shield | One death prevention | Until used |
| Magnet | Auto-collect nearby orbs | 8 seconds |
| Freeze | Stops opponent (competitive) | 5 seconds |
| Double Points | 2× coin earn | 15 seconds |

**Implementation:** Extend `wormPowerups` store state with a `type` field. `HealerWormMode` checks power-up type on collection.

---

## Phase 6 — Polish, Audio & Juice

### 6.1 Sound System

`src/utils/audio.js` (extend existing) — new sound events:
- Orb collect: sparkle tone (pitch varies by orb color/rarity)
- Coin earned: satisfying "ding" with PP counter tick
- Disparity bet win: casino-style payout sound
- Disparity bet loss: deflate sound
- Portal entry/exit: whoosh + pop
- Level up: fanfare
- Store purchase: confirmation chime

**Sound packs:** Store-purchasable alternative sound sets. Each pack replaces all game sounds with a theme (e.g. retro 8-bit, futuristic, nature).

### 6.2 Particle Effects

- PP coin collect: gold coin particles burst from orb
- Store purchase: confetti shower
- Level up: ring of particles expanding from worm
- Streak bonus: streak counter with fire effect

### 6.3 Haptics (Mobile)

- Short vibration on orb collect
- Long vibration on death
- Pattern vibration on level up

---

## Implementation Order

```
Phase 1 (Economy)       ←── Start here. All other phases depend on it.
    ↓
Phase 2 (Disparity)     ←── Gives players a reason to earn coins immediately.
    ↓
Phase 3 (Store)         ←── Now there's something to spend them on.
    ↓
Phase 4 (Antipodal)     ←── Major feature. Requires Phase 1 for scoring.
    ↓
Phase 5 (Progression)   ←── Enriches both WORM and Antipodal modes.
    ↓
Phase 6 (Polish)        ←── Final layer once gameplay is solid.
```

---

## File Index (New Files to Create)

```
src/
├── utils/
│   ├── economyConstants.js          Phase 1 — earn/cost tuning
│   └── storeCatalog.js              Phase 3 — all purchasable items
├── components/screens/
│   ├── StoreScreen.jsx              Phase 3 — full store UI
│   ├── DisparityBettingScreen.jsx   Phase 2 — pre-game betting
│   └── AntipodalModeSelect.jsx      Phase 4 — mode lobby
├── worm/
│   └── wormAI.js                    Phase 5 — CPU pathfinding
└── docs/
    └── ROADMAP.md                   This file
```

## Files Modified in Each Phase

**Phase 1:**
- `src/hooks/useGameStore.js` — wallet state, earn/spend actions
- `src/worm/HealerWormMode.jsx` — orb collection earn hooks
- `src/components/menus/MainMenu.jsx` — PP balance display

**Phase 2:**
- `src/App.jsx` — wire DisparityBettingScreen into disparity flow
- `src/worm/chaosWorker.js` — expose simulation speed param
- `src/components/screens/DisparityWinnerScreen.jsx` — bet resolution UI

**Phase 3:**
- `src/components/menus/MainMenu.jsx` — unlock store button
- `src/worm/wormCosmeticsData.js` — add new skins/hats
- `src/hooks/useGameStore.js` — ownedItems, equippedItems

**Phase 4:**
- `src/App.jsx` — wire AntipodalModeSelect, new canvas layout
- `src/hooks/useGameStore.js` — two-player position state
- `src/worm/HealerWormMode.jsx` — ghost worm rendering, P2 camera
- `src/worm/wormLogic.js` — two-player collision/interaction
- `src/components/screens/WormModeSetupWizard.jsx` — add mode option

**Phase 5:**
- `src/worm/HealerWormMode.jsx` — power-up types, XP emit
- `src/hooks/useGameStore.js` — XP, level, leaderboard state
- `src/components/screens/WormModeSetupWizard.jsx` — difficulty setting

**Phase 6:**
- `src/utils/audio.js` — new sound events
- `src/worm/HealerWormMode.jsx` — haptics, new particles
