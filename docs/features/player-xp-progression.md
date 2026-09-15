# Player progression

Permanent, device-local XP across the release modes. XP is separate from the
spendable Parity Points wallet. Dying, retrying, switching modes and spending points
do not remove earned XP. Existing players keep purchases, points and mission
progress; XP begins at level 1 when this feature is installed. There is no
retroactive estimate of play history, account system or cloud sync.

## Levels and rewards

Level L → L+1 costs `100 + 25 × (L − 1)` XP. The track has 50 levels; reaching
level 50 takes 34,300 XP. Total XP keeps counting at the cap. Each new level
awards 25 Parity Points immediately, including every level in a multi-level gain.

Every fifth level offers a choice. Preferred choices are below; an owned cosmetic
is replaced by an unowned item of the same kind. A points alternative is always
available. The reward is claimed once, persists immediately, and can be equipped
from its reveal. Items are existing catalogue cosmetics, with the same appearance
and behavior as their Store counterparts; ranks are display titles.

| Level | Rank / reward | Preferred cosmetic choices (pick one) | Points alternative |
| --- | --- | --- | ---: |
| 5 | Choose your next look | Party hat, Cherry skin, Necker Flip, Reef palette | 150 |
| 10 | Inside Out | Infinity Tunnel, Droste Spiral, Void skin, Cosmic palette | 150 |
| 15 | Choose your next look | Flower hat, Emerald skin, Crystal Growth, Tropical palette | 150 |
| 20 | Living Geometry | Cymatics, Compass, Toxic skin, Bioluminescence palette | 150 |
| 25 | Choose your next look | Wizard hat, Bubble skin, Paradox Weave, Aurora palette | 150 |
| 30 | Front & Back | Möbius Band, RP² Geodesics, Sunset skin, Eclipse palette | 150 |
| 35 | Choose your next look | Halo, Ice skin, Hyperbolic Weave, Arctic palette | 150 |
| 40 | Beyond the Surface | Orb Chamber, Painted Window, Galaxy skin, Deep Sea palette | 150 |
| 45 | Choose your next look | Crown, Gold skin, Stellar Lensing, Gemstone palette | 150 |
| 50 | Singularity | Cube collection: Hopf Fibers + RP² Geodesics + Cosmic; or Worm collection: Galaxy + Halo + Cosmic | 450 |

A partially owned level-50 collection adds only missing items. Fully owned
collections are omitted. Equipping the Cube collection applies Hopf Fibers and
Cosmic; RP² Geodesics remains available in the style selector.

## XP events

| Mode / action | XP | Rules |
| --- | ---: | --- |
| Worm: first 20 pickups | 2 each | Earned immediately, kept on death |
| Worm: pickups 21–80 | 1 per pair | No further pickup XP above 80 in a run |
| Worm: heal a tunnel pair | 15 | First 6 heals per run |
| Worm: complete a new tunnel route | 8 | Unique entrance/exit color pair; at most 6 per run; pays on crawl resume, not entry |
| Worm: finish the run mission | 50 | One mission per run, in addition to its existing PP reward |
| Worm: heal the whole cube | 100 | Once per completed run |
| Story, Cube, Algorithm Codex: solve | `20 + 5 × min(par, 20)` | Par uses the authored moves and flips; fallback 15 if unavailable |
| Freeplay, Random, Biome: solve | `20 + 5 × min(scramble moves, 20)` | Fresh non-solved scramble of at least 8 turns/changes |
| First independent puzzle clear | 40 | Once per chapter; in free modes once per mode and cube size |
| New chapter stars | 20 each | Only the increase over the player's previous XP star record |
| Chapter personal best | 30 | Fewer moves than the previous independently solved best |
| Daily Descent | 120 | Once per puzzle date; independent of streak and PP payout |
| Daily at par or better | 30 | Once per puzzle date, including a later improvement |
| Guided solve | 25 | Once per recent challenge; no independent clear, star or best bonuses |
| Chaos / Disparity | 50 | Completed standalone round, regardless of forecast, wager or winner |
| Teach: finish an algorithm | 25 | Once per algorithm, after its final turn commits |
| Teach: correct quiz answer | 35 | Once per lesson stage |
| Möbius Cubelet | 30 | Once after selecting all three antipodal pairs |
| Demo introduction | 50 | Once when reaching the end; demo gameplay never earns normal Worm/puzzle XP |

Worm difficulty is captured at run start from the same speed/interval presets as
the wizard: Easy ×1, Medium ×1.2, Hard ×1.4. The same multipliers apply to the base
puzzle solve reward by authored difficulty; Expert and Master use ×1.4. First-clear,
star, best and daily rewards are fixed. Mega uses the same Worm caps as other sizes.
Rounding is cumulative within an action category, so a magnet sweep and individual
pickups pay the same total.

Repeated identical puzzle arrangements pay 100%, 35%, 15%, then zero base solve
XP. History retains the 64 most recent challenges. New stars and personal bests
still count. An independent solve after a guided one retains its full first-clear
and star eligibility. A guided daily pays 25 initially; a later independent solve
pays the remaining 95 plus its at-par bonus if earned. Autoplay, solver playback,
loading a saved board and developer presets mark the pending solve as assisted.

Biome starts as an exploration sandbox: use Shuffle to start an XP-eligible solve.
Simply opening menus, letting clocks run or selecting skins never grants XP.
Hands, Holonomy, Merge and Co-op remain archived and do not enter this release track.

## UI and performance

The main-menu badge opens a mobile, scrollable 50-level track with pending rewards,
upcoming choices and a per-mode XP breakdown. The screen traps focus, blocks input
to the cube and restores focus on close. Controls are at least 44px, respect safe
areas and retain scrolling on short screens. Palettes use actual color swatches
without numbers. A single selected cosmetic is previewed using existing renderers.

Run results and the Worm pause screen show XP, a level meter and an optional
breakdown. Teach, Cubelet and intro completion use small receipts. A level-up cue
is brief and nonblocking during gameplay; the full reveal belongs in the reward
screen. Motion effects respect reduced-motion preferences. The reward screen and
its CSS load on demand; XP has no per-frame timer or cube scan in the render loop.

## Save and event contract

`worm3_player_progress_v1` is an authoritative snapshot of progression, wallet and
ownership. A single localStorage write records these together. Legacy wallet and
ownership keys remain mirrors for migration. Existing settings, mission and
campaign saves retain their original keys. Malformed/unavailable storage is caught
without crashing gameplay. Clearing browser storage resets this device's progress.

Worm awards validate the run ID, mode, alive state, active phase and pause state;
absolute counters prevent duplicates or regressions. Ended runs are immutable.
Puzzle awards validate the original level/size and an actually solved cube with no
pending animation. Rewards commit from gameplay events, never from mounting a
result screen. Repeat claims are rejected at the store action, not only disabled
in the UI. Reward previews do not grant ownership.
