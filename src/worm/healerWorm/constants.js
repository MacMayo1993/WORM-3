import * as THREE from 'three';

export const CAM_HEIGHT_BASE = 1.08;  // base height above worm
export const CAM_BACK_BASE = 2.4;    // base behind distance
export const LOOK_AHEAD = 4.0;      // look-at ahead of worm
// How far to pull the crawl camera's look target back toward the cube centre so the
// whole cube stays framed instead of the camera staring off the worm's nose.
// 0 = pure chase (worm centred, cube drifts off-screen), 1 = always look at cube centre.
export const CAM_CENTER_BIAS = 0.35;
export const CAM_LERP = 8;          // camera smoothing (× delta)
export const WORM_LIFT = 0.08; // worm sits right on tile surface
export const ZOOM_BURST = 0.8; // brief camera pull-back on pickup (decays fast)
export const MAX_EXTRA_ZOOM = 2.0; // hard cap so camera never flies away

export const GLASS_MIN_OPACITY = 0.12;
export const GLASS_MAX_OPACITY = 0.28;
export const GLASS_MIN_TRANSMISSION = 0.72;
export const GLASS_MAX_TRANSMISSION = 0.95;
export const TUNNEL_SURF_FOV = 95;
export const TUNNEL_SURF_BACK = 0.264;     // camera behind worm along tunnel axis — 10% further back than crawl
export const TUNNEL_SURF_UP = 0.132;       // raise camera above ribbon surface; nonzero value causes Möbius orbit (camera rolls 180° over tunnel) — intentional RP² effect
export const TUNNEL_LOOK_AHEAD = 1.8;      // 1 arm-length ahead; keeps exit in view without shooting past the cube
export const TUNNEL_SURF_SWAY = 0.22;
export const TUNNEL_SPEED_SCALE = 0.60; // 0.264 was 35% slower than original; 0.50 was snappy, 0.60 is 20% faster still

// Face outward normals.
export const FACE_NORMALS = {
    PX: new THREE.Vector3(1, 0, 0),
    NX: new THREE.Vector3(-1, 0, 0),
    PY: new THREE.Vector3(0, 1, 0),
    NY: new THREE.Vector3(0, -1, 0),
    PZ: new THREE.Vector3(0, 0, 1),
    NZ: new THREE.Vector3(0, 0, -1),
};

// Move direction -> world forward vector (on each face).
export const DIR_FORWARD = {
    PZ: { up: [0, 1, 0], down: [0, -1, 0], left: [-1, 0, 0], right: [1, 0, 0] },
    NZ: { up: [0, 1, 0], down: [0, -1, 0], left: [1, 0, 0], right: [-1, 0, 0] },
    PX: { up: [0, 1, 0], down: [0, -1, 0], left: [0, 0, 1], right: [0, 0, -1] },
    NX: { up: [0, 1, 0], down: [0, -1, 0], left: [0, 0, -1], right: [0, 0, 1] },
    PY: { up: [0, 0, -1], down: [0, 0, 1], left: [-1, 0, 0], right: [1, 0, 0] },
    NY: { up: [0, 0, 1], down: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0] },
};

export const INITIAL_DIR = 'up';

export const INITIAL_POS = (size) => {
    const c = Math.floor(size / 2);
    return { x: c, y: c, z: size - 1, dirKey: 'PZ' };
};

export const DEFAULT_POWERUP_COUNT = 5;
export const ORB_SEGMENT_GROWTH = 3; // every orb adds exactly 3 visual balls
export const STEPS_PER_TILE = 50; // sub-steps recorded per tile (0.02 resolution)
// World-space distance between visible body balls — MUST match WormBody's placement
// (segment i sits at i * 0.09 world units, see HealerWormMode targetDist). It
// drives how many tiles the body is assumed to occupy for self-collision, tail-cut
// length, and the trail start. It had drifted to 0.14 (~1.56x too long), which made
// the collision/trail "tail" extend well past the body you actually see — causing
// false-positive tail-bite deaths and a trail that started too far behind the tail.
export const BODY_BALL_SPACING = 0.09;
export const BASE_TAIL_LENGTH = 4;
export const DEFAULT_WORMHOLE_FLIP_INTERVAL = 10; // seconds between guaranteed antipodal wormhole spawns
export const MAX_JUMPS = 2;
export const MAX_POWERUP_RENDER = 24;
export const TUNNEL_TRIGGER_PROGRESS = 1 / 3;
export const SELF_COLLISION_TRIGGER_PROGRESS = 0.4;
export const SELF_COLLISION_GRACE_STEPS_AFTER_TUNNEL = 4;
export const WORMHOLE_MAX_TRAVERSALS = 3;

// Tail segments needed to visually cover all tiles: totalTiles / (0.14 unit spacing / ~1 unit per tile)
// For 5×5 (150 tiles): ~1100 segments. Round up generously.
export const MAX_TAIL = 1200;

// Exit-spiral spacing in normalized wind-path units. The head travels far
// enough past the surface position for the final body segment to clear the
// portal before a tunnel is allowed to heal closed.
export const WINDOUT_SEGMENT_DT = 0.07;
export const windoutHeadS = (progress, tailLength) => {
    const visibleSegments = Math.min(MAX_TAIL, Math.max(1, tailLength));
    const tailSpan = (visibleSegments - 1) * WINDOUT_SEGMENT_DT;
    return 1 - Math.min(1, Math.max(0, progress)) * (1 + tailSpan);
};
export const HEAL_COST = 4; // worm segments (balls) required to fully heal one tunnel

// Render-only full-route trail history: how many tiles of the worm's path are retained for
// painting the persistent "where I've been" trail (see useWormCrawler's pathHistory ring).
// Decoupled from the gameplay body trail (tileTrail), which is bounded by MAX_TAIL.
export const TRAIL_HISTORY_CAP = 8000;

// Surface-worm jump physics (distinct from crawlerPhysics.js JUMP_HEIGHT which is 0.35).
export const SURFACE_JUMP_HEIGHT = 1.5;   // tall arc — astronaut bounding in low gravity
export const SURFACE_JUMP_TILE_SPAN = 1;  // jump distance is fixed to one traversed tile regardless of speed

// ─── Speed boost (HUD button beside JUMP) ─────────────────────────────────────
export const WORM_SPEED_OPTIONS = [
  { value: 2.0, label: 'Slow' },
  { value: 2.75, label: 'Medium' },
  { value: 3.5, label: 'Fast' },
];
export const BOOST_MULTIPLIER = 2.4;  // crawl-speed multiplier while boosting
export const BOOST_DURATION = 1.5;    // seconds the boost lasts
export const BOOST_COOLDOWN = 4.0;    // seconds before boost can be used again

// ─── Special power-ups (rocket / magnet) ──────────────────────────────────────
// Special orbs are a separate spawn track from the colored parity orbs: they never
// grow the body or enter the color inventory, and only one is on the board at a time.
//
// They are claimed on CONTACT. An earlier version required the worm to be airborne
// over the orb's exact tile, which stacked three separate difficulties — steer onto
// one precise tile, inside the lifetime, while jumping — and made specials
// effectively unclaimable in real play. Jumping now only widens the claim radius.
// The canonical type list and all presentation metadata live in specialDefs.js,
// which stays free of THREE/React so simulation tests can import it directly.
export const SPECIAL_MAX_ON_BOARD = 1;
export const SPECIAL_SPAWN_INTERVAL = 22;  // seconds between ambient special spawns
export const SPECIAL_LIFETIME = 30;        // seconds a special stays on the board
export const SPECIAL_FADE_TIME = 4;        // trailing seconds of the lifetime spent fading out
export const SPECIAL_HOVER_HEIGHT = 0.45;  // world units above the tile surface
// Ambient specials spawn within this many manifold steps of the worm's head, so one
// always appears somewhere the player can see and reach rather than on the far side
// of the cube where it just times out unseen.
export const SPECIAL_SPAWN_RADIUS = 4;
// Claim radius while airborne — a jump toward a special that is a tile off still
// lands it, instead of punishing a near-miss.
export const SPECIAL_JUMP_REACH = 1;
// Radius used for the reward a healed tunnel drops beside its exit.
export const SPECIAL_TUNNEL_RADIUS = 2;
// When the neighbourhood has no acceptable tile, the spawn is retried after this
// long instead of falling back to an arbitrary tile somewhere on the cube.
export const SPECIAL_SPAWN_RETRY = 2;

// Rocket — a short, grounded overdrive. It quadruples the player's configured speed
// (rather than replacing it with a jump), ignores collisions and wormhole mouths,
// and advertises the protected window with a flame at the tail.
export const ROCKET_DURATION = 3;
export const ROCKET_SPEED_MULT = 4;
// Seconds of protection after a rocket touches down, ≈ one tile at base speed. A
// flight that ends on top of your own tail, a wormhole mouth or a turning slice
// would otherwise punish the player for a landing they had no way to steer out of.
// Deliberately short: the worm is vulnerable again almost immediately.
export const ROCKET_LANDING_GRACE = 1.0;

// Magnet — widens the pickup reach to MAGNET_RADIUS manifold rings for
// MAGNET_DURATION seconds. Measured in manifold neighbors, not grid distance, so the
// pull reaches around face edges and corners.
export const MAGNET_DURATION = 8;
export const MAGNET_RADIUS = 2;
// Ceiling on queued attraction streaks. A sweep can only reach a dozen or so orbs,
// but the cap keeps a pathological case from spawning unbounded geometry and React
// state in a single frame.
export const MAX_ORB_ATTRACTION_FX = 12;
// Seconds an attraction streak takes to travel from the orb to the worm. Purely
// visual — the orb is already banked when the streak starts.
export const ORB_ATTRACTION_FX_DURATION = 0.32;

// ─── Frame delta clamp ────────────────────────────────────────────────────────
// Upper bound on the per-tick delta. A hitch (tab refocus, GC pause, alt-tab) can
// hand useFrame a delta of several hundred ms; feeding that straight into the
// simulation inflates interpT and the step accumulator at once, teleporting the
// worm forward multiple tiles — which scatters the body trail and can slam it into
// its own tail unfairly. 0.1s (≈ 6 frames @60Hz) never bites in normal play.
export const MAX_TICK_DELTA = 0.1;

// ─── Auto-rotation hazard ─────────────────────────────────────────────────────
export const AUTO_ROTATE_INTERVAL_MIN = 9;   // kept for non-scramble modes
export const AUTO_ROTATE_INTERVAL_MAX = 15;
export const AUTO_ROTATE_WARNING = 3.75;     // seconds of beam warning before rotation fires (longer telegraph so the turn looms)

// ─── Scramble-solve game mode ─────────────────────────────────────────────────
// Mega turns two non-adjacent planes per step; regular 2x2-7x7 boards turn one.
// The hazard phase plays the inverse of these moves to return the cube to solved.
export const SCRAMBLE_STEPS = 20;            // moves in the opening scramble
export const SCRAMBLE_MOVE_INTERVAL = 0.55;  // seconds between each scramble move during opening
export const ACTIVE_ROTATE_INTERVAL = 10;    // fixed interval during gameplay (20 moves × 10s = 200s)
export const COUNTDOWN_STEP_DURATION = 0.85; // seconds per beat of the 3-2-1-WORM countdown
