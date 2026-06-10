import * as THREE from 'three';

export const CAM_HEIGHT_BASE = 5.72; // base height above worm (×1.1 zoom-out)
export const CAM_BACK_BASE = 5.28; // base behind distance (×1.1 zoom-out)
export const LOOK_AHEAD = 1.8; // look-at ahead of worm
export const CAM_LERP = 6; // camera smoothing (× delta)
export const WORM_LIFT = 0.08; // worm sits right on tile surface
export const ZOOM_BURST = 0.8; // brief camera pull-back on pickup (decays fast)
export const MAX_EXTRA_ZOOM = 2.0; // hard cap so camera never flies away

export const GLASS_MIN_OPACITY = 0.12;
export const GLASS_MAX_OPACITY = 0.28;
export const GLASS_MIN_TRANSMISSION = 0.72;
export const GLASS_MAX_TRANSMISSION = 0.95;
export const TUNNEL_SURF_FOV = 78;
export const TUNNEL_SURF_BACK = 3.2; // camera behind worm during tunnel (was unused placeholder)
export const TUNNEL_SURF_UP = 1.3;   // camera above worm during tunnel (was unused placeholder)
export const TUNNEL_SURF_SWAY = 0.22;
export const TUNNEL_SPEED_SCALE = 0.310; // slightly slower than original 0.357 (~13% longer)

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
export const ORB_SEGMENT_GROWTH = 2; // every orb adds exactly 2 visual balls
export const STEPS_PER_TILE = 50; // sub-steps recorded per tile (0.02 resolution)
export const BODY_BALL_SPACING = 0.14; // matches WormBody clone spacing along the trail
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
export const HEAL_COST = 4; // worm segments required to fully heal one tunnel (= 2 orb pickups)

// Surface-worm jump physics (distinct from crawlerPhysics.js JUMP_HEIGHT which is 0.35).
export const SURFACE_JUMP_HEIGHT = 1.5;   // tall arc — astronaut bounding in low gravity
export const SURFACE_JUMP_TILE_SPAN = 1;  // jump distance is fixed to one traversed tile regardless of speed

// ─── Auto-rotation hazard ─────────────────────────────────────────────────────
export const AUTO_ROTATE_INTERVAL_MIN = 9;   // kept for non-scramble modes
export const AUTO_ROTATE_INTERVAL_MAX = 15;
export const AUTO_ROTATE_WARNING = 2.5;      // seconds of beam warning before rotation fires

// ─── Scramble-solve game mode ─────────────────────────────────────────────────
export const SCRAMBLE_STEPS = 15;            // moves in the opening scramble
export const SCRAMBLE_MOVE_INTERVAL = 0.55;  // seconds between each scramble move during opening
export const ACTIVE_ROTATE_INTERVAL = 10;    // fixed interval during gameplay (15 moves × 10s = 150s)
export const COUNTDOWN_STEP_DURATION = 0.85; // seconds per beat of the 3-2-1-WORM countdown
