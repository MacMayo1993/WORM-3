// src/holonomy/holonomyMath.js
// Möbius Gauge Cube — ported from Python reference implementation.
//
// Key insight: non-trivial holonomy (det H = -1) requires O(2) seam matrices,
// not just SO(2). Reflections come from face CHARGE mismatch (alternating 0/1 pattern).
// Čech consistency at cube vertices is verified by the Python solver and holds for
// face_charge = [0, 1, 0, 1, 0, 1].

// ─── Face index ↔ key ─────────────────────────────────────────────────────────
// Face 0 = PZ (+Z, red),   Face 1 = NZ (-Z, orange)
// Face 2 = PX (+X, blue),  Face 3 = NX (-X, green)
// Face 4 = PY (+Y, white), Face 5 = NY (-Y, yellow)

export const FACE_KEYS = ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY'];
export const FACE_IDX = { PZ: 0, NZ: 1, PX: 2, NX: 3, PY: 4, NY: 5 };

// ─── Face geometry (matches Python CubeManifold, half=0.5) ───────────────────
// Each face: center c, local u-axis a1, local v-axis a2
export const FACE_GEOMETRY = {
    PZ: { c: [0, 0, 0.5], a1: [1, 0, 0], a2: [0, 1, 0] },
    NZ: { c: [0, 0, -0.5], a1: [1, 0, 0], a2: [0, -1, 0] },
    PX: { c: [0.5, 0, 0], a1: [0, 1, 0], a2: [0, 0, 1] },
    NX: { c: [-0.5, 0, 0], a1: [0, 1, 0], a2: [0, 0, -1] },
    PY: { c: [0, 0.5, 0], a1: [1, 0, 0], a2: [0, 0, 1] },
    NY: { c: [0, -0.5, 0], a1: [1, 0, 0], a2: [0, 0, -1] },
};

// ─── Adjacency topology (matches Python NEIGH exactly) ────────────────────────
// edge keys: 'u+', 'u-', 'v+', 'v-'
export const NEIGH = {
    PZ: { 'u+': 'PX', 'u-': 'NX', 'v+': 'PY', 'v-': 'NY' }, // face 0
    NZ: { 'u+': 'PX', 'u-': 'NX', 'v+': 'NY', 'v-': 'PY' }, // face 1
    PX: { 'u+': 'NZ', 'u-': 'PZ', 'v+': 'PY', 'v-': 'NY' }, // face 2
    NX: { 'u+': 'PZ', 'u-': 'NZ', 'v+': 'PY', 'v-': 'NY' }, // face 3
    PY: { 'u+': 'PX', 'u-': 'NX', 'v+': 'NZ', 'v-': 'PZ' }, // face 4
    NY: { 'u+': 'PX', 'u-': 'NX', 'v+': 'PZ', 'v-': 'NZ' }, // face 5
};

// ─── Gauge structure ─────────────────────────────────────────────────────────
// face_charge: alternating 0/1 — mismatch → reflection F in seam matrix
// Čech parity check at all 8 cube corners passes for this pattern (verified in Python).
export const FACE_CHARGE = [0, 1, 0, 1, 0, 1]; // indexed by FACE_IDX

// face_angle: Čech-consistent rotation potentials solved via Python LS solver
// (seam_target_mode="match_init", lambda=0.01, anchor_face=0)
// These are the pre-solved values — close to init [0, 0.6, 1.2, -0.4, 0.8, -1.1]
export const FACE_ANGLE = [0.0, 0.601, 1.198, -0.402, 0.799, -1.098]; // radians

// ─── 2×2 matrix operations ──────────────────────────────────────────────────
export const mat2Identity = () => [[1, 0], [0, 1]];

export const mat2Mul = (A, B) => [
    [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
    [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]],
];

export const mat2Det = (A) => A[0][0] * A[1][1] - A[0][1] * A[1][0];

export const applyMat2 = (A, v) => [
    A[0][0] * v[0] + A[0][1] * v[1],
    A[1][0] * v[0] + A[1][1] * v[1],
];

export const mat2Clone = (A) => [[A[0][0], A[0][1]], [A[1][0], A[1][1]]];

// ─── Seam matrix: F @ R(theta_j - theta_i) ────────────────────────────────
// Exactly matches Python MobiusGauge.seam_matrix()
export const getSeamMatrix = (fromFaceKey, toFaceKey) => {
    const i = FACE_IDX[fromFaceKey];
    const j = FACE_IDX[toFaceKey];

    // Rotation: R(alpha_j - alpha_i)
    const th = FACE_ANGLE[j] - FACE_ANGLE[i];
    const c = Math.cos(th), s = Math.sin(th);
    const R = [[c, -s], [s, c]];

    // Reflection: applied if charge differs
    if (FACE_CHARGE[i] !== FACE_CHARGE[j]) {
        // F = diag(1, -1);  return F @ R
        return [
            [R[0][0], R[0][1]],
            [-R[1][0], -R[1][1]],
        ];
    }
    return R;
};

// ─── Holonomy readouts ────────────────────────────────────────────────────────
export const getHolonomyAngle = (H) => Math.atan2(H[1][0], H[0][0]);
export const getOrientationParity = (H) => Math.round(mat2Det(H));

// ─── Gauge field: swirl_uv ────────────────────────────────────────────────────
// Matches Python MobiusGauge.swirl_uv()
// Returns rotated (u, v) under the local gauge field.
// twist ∈ [0,1] animated parameter.
export const swirlUV = (u, v, twist, faceKey) => {
    const half = 0.5;
    const d = Math.min(half + u, half - u, half + v, half - v);
    let ang = Math.PI * Math.pow(2.0 * d, 2) * twist;
    const charge = FACE_CHARGE[FACE_IDX[faceKey]];
    if (charge === 1) ang = -ang;
    const c = Math.cos(ang), s = Math.sin(ang);
    return [u * c - v * s, u * s + v * c];
};

// ─── World-space helpers ──────────────────────────────────────────────────────

/**
 * Convert (faceKey, u, v) + optional twist → Three.js world [x,y,z].
 * Mirrors Python: p = f.c + x*f.a1 + y*f.a2 (with swirl applied).
 */
export const chartToWorld = (faceKey, u, v, twist = 0, lift = 0.52) => {
    const [su, sv] = twist !== 0 ? swirlUV(u, v, twist, faceKey) : [u, v];
    const f = FACE_GEOMETRY[faceKey];
    if (!f) return [0, 0, 0];
    // Scale to match the actual 3x3 cube size (cubie spacing ~1.0, half=0.5 → need ×(size-1))
    const S = 2.0; // (size=3 → half=1.5 game units)
    const cx = f.c[0] * S * lift / 0.5;
    const cy = f.c[1] * S * lift / 0.5;
    const cz = f.c[2] * S * lift / 0.5;
    return [
        cx + su * S * f.a1[0] + sv * S * f.a2[0],
        cy + su * S * f.a1[1] + sv * S * f.a2[1],
        cz + su * S * f.a1[2] + sv * S * f.a2[2],
    ];
};

/**
 * Convert local 2D transport vector [vx, vy] to world-space direction [wx, wy, wz].
 */
export const localVecToWorld = (faceKey, v2d) => {
    const f = FACE_GEOMETRY[faceKey];
    if (!f) return [1, 0, 0];
    const wx = v2d[0] * f.a1[0] + v2d[1] * f.a2[0];
    const wy = v2d[0] * f.a1[1] + v2d[1] * f.a2[1];
    const wz = v2d[0] * f.a1[2] + v2d[1] * f.a2[2];
    const len = Math.sqrt(wx * wx + wy * wy + wz * wz) || 1;
    return [wx / len, wy / len, wz / len];
};

/**
 * Given (faceKey, u, v) and a step direction, returns the crossed edge key
 * ('u+' | 'u-' | 'v+' | 'v-') or null if still inside.
 */
export const getEdgeCrossed = (u, v, half = 0.5) => {
    if (u > half) return 'u+';
    if (u < -half) return 'u-';
    if (v > half) return 'v+';
    if (v < -half) return 'v-';
    return null;
};

/**
 * After crossing an edge, clamp (u,v) back inside the new face with a small epsilon.
 */
export const clampAfterCross = (u, v, edge, eps = 0.015) => {
    const h = 0.5 - eps;
    switch (edge) {
        case 'u+': return [-h, Math.max(-h, Math.min(h, v))];
        case 'u-': return [h, Math.max(-h, Math.min(h, v))];
        case 'v+': return [Math.max(-h, Math.min(h, u)), -h];
        case 'v-': return [Math.max(-h, Math.min(h, u)), h];
        default: return [u, v];
    }
};

// ─── Twist schedule (animation) ───────────────────────────────────────────────
// Matches Python: 0.5 - 0.5*cos(2π·k/twist_period)
export const twistSchedule = (time, period = 14.0) => {
    return 0.5 - 0.5 * Math.cos(2 * Math.PI * (time / period));
};
