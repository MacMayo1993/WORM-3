import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import ParityWallet from '../overlays/ParityWallet.jsx';
import { makeCubies } from '../../game/cubeState.js';
import { rotateSliceCubies } from '../../game/cubeRotation.js';
import { updateSharedTime } from '../../3d/styles/TileStyleMaterials.jsx';

// ─── Per-face independent pulse timing ────────────────────────────────────────
// Each of the 6 faces gets its own phase offset so all 6 colors are always
// visible — staggered evenly across one full cycle (PULSE_CYCLE seconds).
const PULSE_CYCLE = 3.6;   // full repeat period per face (seconds)
const PULSE_DUR   = 0.90;  // active window within each cycle

// Phase offsets: antipodal pairs fire together (0° apart), pairs 60° apart each.
const FACE_PHASE = {
  PZ:  0.0,                   // Red
  NZ:  0.0,                   // Orange  (antipodal to Red, same phase)
  PX:  PULSE_CYCLE / 3,       // Blue
  NX:  PULSE_CYCLE / 3,       // Green   (antipodal to Blue, same phase)
  PY:  (PULSE_CYCLE / 3) * 2, // White
  NY:  (PULSE_CYCLE / 3) * 2, // Yellow  (antipodal to White, same phase)
};

const FACE_COLOR = {
  PX: '#3b82f6', NX: '#22c55e',
  PZ: '#ef4444', NZ: '#f97316',
  PY: '#eeeeee', NY: '#eab308',
};
// Face centers of a 3×3 cube (cubies at –1,0,+1 → surface at ±1.5)
// Ring plane faces outward, so we rotate to match the outward normal
const FACE_CFG = {
  PX: { pos: [1.52, 0, 0], rot: [0, Math.PI / 2, 0] },
  NX: { pos: [-1.52, 0, 0], rot: [0, -Math.PI / 2, 0] },
  PY: { pos: [0, 1.52, 0], rot: [-Math.PI / 2, 0, 0] },
  NY: { pos: [0, -1.52, 0], rot: [Math.PI / 2, 0, 0] },
  PZ: { pos: [0, 0, 1.52], rot: [0, 0, 0] },
  NZ: { pos: [0, 0, -1.52], rot: [0, Math.PI, 0] },
};
const FACE_KEYS = Object.keys(FACE_CFG);

// ─── Shared pulse state — written by FacePulses (WebGL), read by ScreenGlow (DOM) ──
// Per-face rawP values (0→1) so all 6 colors are always independently visible.
const _pulsePerFace = { PX: 0, NX: 0, PY: 0, NY: 0, PZ: 0, NZ: 0 };

// Screen-edge gradient per face: each face maps to the screen region it faces.
// PZ/NZ (front/back) use left/right edges since they have no top-bottom screen axis.
const FACE_SCREEN_GRADIENT = {
  PY: c => `radial-gradient(ellipse 120% 55% at 50% 0%,   ${c} 0%, transparent 68%)`,
  NY: c => `radial-gradient(ellipse 120% 55% at 50% 100%, ${c} 0%, transparent 68%)`,
  PX: c => `radial-gradient(ellipse 55% 120% at 100% 50%, ${c} 0%, transparent 68%)`,
  NX: c => `radial-gradient(ellipse 55% 120% at 0%   50%, ${c} 0%, transparent 68%)`,
  PZ: c => `radial-gradient(ellipse 55% 120% at 12%  50%, ${c} 0%, transparent 68%)`,
  NZ: c => `radial-gradient(ellipse 55% 120% at 88%  50%, ${c} 0%, transparent 68%)`,
};

// DOM overlay — reads _pulsePerFace via rAF and updates div opacity directly (no React state)
const ScreenGlow = () => {
  const divRefs = useRef({});
  useEffect(() => {
    let raf;
    // Track previous per-face values to skip no-op DOM writes
    const prev = { PX: -1, NX: -1, PY: -1, NY: -1, PZ: -1, NZ: -1 };
    const tick = () => {
      FACE_KEYS.forEach(face => {
        const rawP = _pulsePerFace[face];
        if (rawP === prev[face]) return;
        prev[face] = rawP;
        const el = divRefs.current[face];
        if (!el) return;
        const bell = rawP < 0.30 ? rawP / 0.30 : (1 - rawP) / 0.70;
        el.style.opacity = String(Math.max(0, bell) * 0.22);
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <>
      {FACE_KEYS.map(face => (
        <div
          key={face}
          ref={el => { divRefs.current[face] = el; }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
            opacity: 0,
            background: FACE_SCREEN_GRADIENT[face](FACE_COLOR[face]),
          }}
        />
      ))}
    </>
  );
};

// ─── Ray strand system — shoots outward from tile gaps like antipodal tunnel effects ──
// In face-group local space: +Z is outward (face normal), XY is the face plane.
// Strands originate from the 4 tile gap lines (# positions at ±0.5) and curve outward.
const RAY_STRANDS = 14;   // per face — distributed across the 4 tile gap lines
const RAY_PTS = 24;   // curve sample points per strand (more segments = worm-like motion)
const WORM_BALLS = 7; // bead count per strand body

// Pre-computed per-face strand paths — originate from the # grid lines at ±0.5 and
// curve outward along the face normal (+Z), like light leaking through the tile seams.
const _faceRayConfigs = (() => {
  const rng = (() => { let s = 42; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }; })();
  const result = {};
  FACE_KEYS.forEach(face => {
    result[face] = Array.from({ length: RAY_STRANDS }, (_, i) => {
      // Distribute evenly across the 4 # lines (tile gaps at sx=±0.5 and sy=±0.5)
      const line = i % 4;
      const slot = Math.floor(i / 4);
      const slotsPerLine = Math.ceil(RAY_STRANDS / 4);  // 3 for 10 strands
      const along = slotsPerLine > 1
        ? (slot / (slotsPerLine - 1) - 0.5) * 2.6       // –1.3 … +1.3 along the gap line
        : 0;

      let sx, sy;
      if (line === 0) { sx = along; sy = 0.5; }
      else if (line === 1) { sx = along; sy = -0.5; }
      else if (line === 2) { sx = 0.5; sy = along; }
      else { sx = -0.5; sy = along; }

      const len = 1.4 + rng() * 1.8;
      const cpXOff = (rng() - 0.5) * 0.7;
      const cpYOff = (rng() - 0.5) * 0.7;
      const tipXOff = (rng() - 0.5) * 0.5;
      const tipYOff = (rng() - 0.5) * 0.5;

      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(sx, sy, 0.06),
        new THREE.Vector3(sx + cpXOff, sy + cpYOff, len * 0.45),
        new THREE.Vector3(sx + tipXOff, sy + tipYOff, len)
      );

      const pts = curve.getPoints(RAY_PTS - 1);
      const basePts = new Float32Array(RAY_PTS * 3);
      pts.forEach((p, j) => { basePts[j * 3] = p.x; basePts[j * 3 + 1] = p.y; basePts[j * 3 + 2] = p.z; });

      // Per-strand wobble profile used to sculpt a moving worm body along the sine rays.
      const wiggleDirAngle = rng() * Math.PI * 2;
      const wiggleDirX = Math.cos(wiggleDirAngle);
      const wiggleDirY = Math.sin(wiggleDirAngle);

      return {
        id: i,
        basePts,
        sparkOffset: rng() * Math.PI * 2,
        wiggleAmp: 0.035 + rng() * 0.045,
        wiggleFreq: 1.7 + rng() * 1.9,
        wiggleSpeed: 3.4 + rng() * 2.8,
        wiggleDirX,
        wiggleDirY,
      };
    });
  });
  return result;
})();

// Pre-computed Three.js color objects — no allocations in useFrame
const _faceColorObj = {};
FACE_KEYS.forEach(face => { _faceColorObj[face] = new THREE.Color(FACE_COLOR[face]); });

const FacePulses = () => {
  const lineRefs = useRef({});   // face → [line, ...]  (arrays)
  const ballRefs = useRef({});   // face → [instancedMesh, ...]
  const lightRefs = useRef({});
  const tempObj = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    FACE_KEYS.forEach(face => {
      // Each face runs on its own clock offset by FACE_PHASE[face]
      const tFace = (t + FACE_PHASE[face]) % PULSE_CYCLE;
      const rawP = tFace < PULSE_DUR ? tFace / PULSE_DUR : 1.0;

      // Write per-face rawP for ScreenGlow to read
      _pulsePerFace[face] = rawP;

      const lines = lineRefs.current[face];
      const light = lightRefs.current[face];

      if (!lines?.length) return;

      if (rawP >= 1.0) {
        lines.forEach(l => { if (l) l.visible = false; });
        ballRefs.current[face]?.forEach(b => { if (b) b.visible = false; });
        if (light) light.intensity = 0;
        return;
      }

      const col = _faceColorObj[face];
      const configs = _faceRayConfigs[face];

      // Strands shoot outward in first half of pulse, then fade out in second half
      const growth = Math.min(rawP * 2.2, 1.0);   // 0→1 over ~45% of pulse
      const fade = rawP > 0.5 ? 1 - (rawP - 0.5) * 2 : 1.0;
      const overall = Math.max(0, fade) * 0.85;

      lines.forEach((line, i) => {
        if (!line) return;
        const cfg = configs[i];

        // Sparkle shimmer
        const spark = 0.8 + Math.sin(t * 5.5 + cfg.sparkOffset) * 0.2;
        line.material.opacity = overall * spark;
        line.visible = overall > 0.01;
        const balls = ballRefs.current[face]?.[i];
        if (balls) balls.visible = overall > 0.01;

        // Growth: clip strand at current growth progress; collapsed points → tip of visible segment.
        // Add a moving sinusoidal offset + segmented luminance for a worm-body look.
        const pos = line.geometry.attributes.position.array;
        const base = cfg.basePts;
        const visibleEnd = growth * (RAY_PTS - 1);  // last visible point index (float)

        for (let j = 0; j < RAY_PTS; j++) {
          const clampedJ = Math.min(j, visibleEnd);
          const lo = Math.floor(clampedJ);
          const hi = Math.min(lo + 1, RAY_PTS - 1);
          const f = clampedJ - lo;
          const baseX = base[lo * 3] + (base[hi * 3] - base[lo * 3]) * f;
          const baseY = base[lo * 3 + 1] + (base[hi * 3 + 1] - base[lo * 3 + 1]) * f;
          const baseZ = base[lo * 3 + 2] + (base[hi * 3 + 2] - base[lo * 3 + 2]) * f;

          const u = clampedJ / (RAY_PTS - 1);
          const bodyEnvelope = Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * 0.95;
          const crawlWave = Math.sin(u * cfg.wiggleFreq * Math.PI * 2 - t * cfg.wiggleSpeed + cfg.sparkOffset);
          const wormOffset = bodyEnvelope * crawlWave * cfg.wiggleAmp;

          pos[j * 3] = baseX + cfg.wiggleDirX * wormOffset;
          pos[j * 3 + 1] = baseY + cfg.wiggleDirY * wormOffset;
          pos[j * 3 + 2] = baseZ;
        }
        line.geometry.attributes.position.needsUpdate = true;

        const colors = line.geometry.attributes.color.array;
        const headU = growth;
        for (let j = 0; j < RAY_PTS; j++) {
          const u = j / (RAY_PTS - 1);
          const tail = Math.pow(Math.max(0, 1 - u), 0.4);
          const segmentBand = 0.72 + 0.28 * Math.sin(u * 26 - t * 12 + cfg.sparkOffset);
          const headGlow = Math.exp(-Math.pow((u - headU) / 0.12, 2)) * 0.65;
          const glow = tail * segmentBand + headGlow;
          colors[j * 3] = col.r * glow;
          colors[j * 3 + 1] = col.g * glow;
          colors[j * 3 + 2] = col.b * glow;
        }
        line.geometry.attributes.color.needsUpdate = true;

        // Worm body beads: instanced spheres distributed from head backward.
        if (balls) {
          for (let b = 0; b < WORM_BALLS; b++) {
            const behind = b / Math.max(1, WORM_BALLS - 1);
            const u = Math.max(0, growth - behind * 0.22);
            const pt = u * (RAY_PTS - 1);
            const lo = Math.floor(pt);
            const hi = Math.min(lo + 1, RAY_PTS - 1);
            const f = pt - lo;
            const x = pos[lo * 3] + (pos[hi * 3] - pos[lo * 3]) * f;
            const y = pos[lo * 3 + 1] + (pos[hi * 3 + 1] - pos[lo * 3 + 1]) * f;
            const z = pos[lo * 3 + 2] + (pos[hi * 3 + 2] - pos[lo * 3 + 2]) * f;

            const headT = 1 - behind;
            const scale = (0.018 + headT * 0.03) * (0.65 + overall * 0.7);
            tempObj.position.set(x, y, z);
            tempObj.scale.setScalar(scale);
            tempObj.updateMatrix();
            balls.setMatrixAt(b, tempObj.matrix);
          }
          balls.instanceMatrix.needsUpdate = true;
        }
      });

      if (light) {
        const lc = rawP < 0.25 ? rawP / 0.25 : Math.pow(1 - rawP, 0.6);
        light.intensity = Math.max(0, lc) * 2.0;
      }
    });
  });

  return (
    <>
      {FACE_KEYS.map(face => {
        const { pos, rot } = FACE_CFG[face];
        const col = FACE_COLOR[face];
        const lightPos = pos.map(v => v * 2.6);
        const configs = _faceRayConfigs[face];
        return (
          <group key={face}>
            <pointLight
              ref={el => { lightRefs.current[face] = el; }}
              position={lightPos} color={col} intensity={0} distance={10} decay={2}
            />
            <group position={pos} rotation={rot}>
              {configs.map((cfg, i) => (
                <line
                  key={cfg.id}
                  ref={el => {
                    if (!lineRefs.current[face]) lineRefs.current[face] = [];
                    lineRefs.current[face][i] = el;
                  }}
                  visible={false}
                >
                  <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={RAY_PTS}
                      array={new Float32Array(RAY_PTS * 3)} itemSize={3} usage={THREE.DynamicDrawUsage} />
                    <bufferAttribute attach="attributes-color" count={RAY_PTS}
                      array={new Float32Array(RAY_PTS * 3)} itemSize={3} usage={THREE.DynamicDrawUsage} />
                  </bufferGeometry>
                  <lineBasicMaterial vertexColors transparent opacity={0} depthWrite={false} />
                </line>
              ))}
              {configs.map((cfg, i) => (
                <instancedMesh
                  key={`balls-${cfg.id}`}
                  ref={el => {
                    if (!ballRefs.current[face]) ballRefs.current[face] = [];
                    ballRefs.current[face][i] = el;
                  }}
                  args={[null, null, WORM_BALLS]}
                  visible={false}
                >
                  <sphereGeometry args={[1, 9, 9]} />
                  <meshStandardMaterial
                    color={col}
                    emissive={col}
                    emissiveIntensity={1.0}
                    transparent
                    opacity={0.88}
                    roughness={0.2}
                    metalness={0.0}
                    depthWrite={false}
                  />
                </instancedMesh>
              ))}
            </group>
          </group>
        );
      })}
    </>
  );
};

// ─── Shuffling cube — live Rubik's slice animation ────────────────────────────
const FACE_ID_COLOR = {
  1: '#ef4444', 2: '#22c55e', 3: '#f0f0f0', 4: '#f97316', 5: '#3b82f6', 6: '#eab308',
};
const STICKER_CFG = [
  { dir: 'PX', pos: [0.501, 0, 0],   rot: [0,  Math.PI / 2, 0] },
  { dir: 'NX', pos: [-0.501, 0, 0],  rot: [0, -Math.PI / 2, 0] },
  { dir: 'PY', pos: [0,  0.501, 0],  rot: [-Math.PI / 2, 0, 0] },
  { dir: 'NY', pos: [0, -0.501, 0],  rot: [ Math.PI / 2, 0, 0] },
  { dir: 'PZ', pos: [0, 0,  0.501],  rot: [0, 0, 0] },
  { dir: 'NZ', pos: [0, 0, -0.501],  rot: [0, Math.PI, 0] },
];
const ALL_MOVES = ['col', 'row', 'depth'].flatMap(ax => [0, 1, 2].flatMap(sl => [1, -1].map(d => ({ ax, sl, d }))));
// Maps axis name → cubie coordinate property (for flat-array slice filtering)
const AX_PROP = { col: 'x', row: 'y', depth: 'z' };
const ANIM_DUR = 0.50;
const PAUSE_DUR = 0.80;
const easeIO = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

const ShuffleCubie = React.memo(({ cubie }) => {
  const cx = cubie.x - 1, cy = cubie.y - 1, cz = cubie.z - 1;
  return (
    <group position={[cx, cy, cz]}>
      <mesh>
        <boxGeometry args={[0.93, 0.93, 0.93]} />
        <meshStandardMaterial color="#1c1c30" roughness={0.55} metalness={0.4} emissive="#0d0d1e" emissiveIntensity={0.6} />
      </mesh>
      {STICKER_CFG.map(({ dir, pos, rot }) => {
        const sticker = cubie.stickers?.[dir];
        if (!sticker) return null;
        return (
          <group key={dir} position={pos} rotation={rot}>
            <mesh>
              <planeGeometry args={[0.80, 0.80]} />
              <meshStandardMaterial color={FACE_ID_COLOR[sticker.curr] ?? '#888'} roughness={0.20} metalness={0.08} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});
ShuffleCubie.displayName = 'ShuffleCubie';

const ShufflingCube = () => {
  const [cubeState, setCubeState] = useState(() => {
    let cubies = makeCubies(3);
    for (let i = 0; i < 18; i++) {
      const m = ALL_MOVES[Math.floor(Math.random() * ALL_MOVES.length)];
      cubies = rotateSliceCubies(cubies, 3, m.ax, m.sl, m.d);
    }
    return { cubies, rotating: null };
  });

  const cubeStateRef = useRef(cubeState);
  cubeStateRef.current = cubeState;
  const sliceGroupRef = useRef();
  const nextMoveAt = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const { rotating, cubies } = cubeStateRef.current;

    if (rotating) {
      const progress = Math.min((t - rotating.startT) / ANIM_DUR, 1);
      const angle = easeIO(progress) * (Math.PI / 2) * rotating.d;
      if (sliceGroupRef.current) {
        sliceGroupRef.current.rotation.set(
          rotating.ax === 'col'   ? angle : 0,
          rotating.ax === 'row'   ? angle : 0,
          rotating.ax === 'depth' ? angle : 0,
        );
      }
      if (progress >= 1) {
        const newCubies = rotateSliceCubies(cubies, 3, rotating.ax, rotating.sl, rotating.d);
        nextMoveAt.current = t + PAUSE_DUR;
        setCubeState({ cubies: newCubies, rotating: null });
      }
    } else if (t >= nextMoveAt.current) {
      const m = ALL_MOVES[Math.floor(Math.random() * ALL_MOVES.length)];
      setCubeState(prev => ({ ...prev, rotating: { ...m, startT: t } }));
    }
  });

  const { cubies, rotating } = cubeState;
  // makeCubies returns a 3D array [x][y][z]; flatten to a list of 27 cubie objects.
  const flatCubies = cubies.flat(2);
  const axProp = rotating ? AX_PROP[rotating.ax] : null;
  const staticCubies = rotating ? flatCubies.filter(c => c[axProp] !== rotating.sl) : flatCubies;
  const sliceCubies = rotating ? flatCubies.filter(c => c[axProp] === rotating.sl) : [];

  return (
    <>
      {staticCubies.map(c => <ShuffleCubie key={`${c.x}-${c.y}-${c.z}`} cubie={c} />)}
      <group ref={sliceGroupRef}>
        {sliceCubies.map(c => <ShuffleCubie key={`${c.x}-${c.y}-${c.z}`} cubie={c} />)}
      </group>
    </>
  );
};

// ─── MenuWorm — worm mascot that sits on top of the cube ─────────────────────
const _SEG_Y   = [1.12, 0.84, 0.56, 0.28, 0.0];
const _SEG_R   = [0.22, 0.185, 0.158, 0.132, 0.105];
const _SEG_COL = ['#3be08a', '#2bcc78', '#22b866', '#1aa255', '#148842'];

// Distance-based path constants (world units)
const _PATH_MIN_DIST = 0.004;           // only record a point when head moves this far
const _SEG_SPACING   = 0.145;           // arc-length between adjacent segment centers
const _MAX_PATH_LEN  = 4 * 0.145 + 0.15; // keep only enough history for all 4 body segments

// Interpolate the head's recorded XZ path at `behindDist` world-units behind the current tip.
// path: [{x, z, arc}] — arc grows monotonically from oldest→newest entry.
function _samplePath(path, behindDist) {
  if (path.length === 0) return { x: 0, z: 0 };
  const headArc   = path[path.length - 1].arc;
  const targetArc = headArc - behindDist;
  if (targetArc <= path[0].arc) return { x: path[0].x, z: path[0].z };
  let lo = 0, hi = path.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid].arc <= targetArc) lo = mid; else hi = mid;
  }
  const p0 = path[lo], p1 = path[hi];
  const frac = p1.arc === p0.arc ? 0 : (targetArc - p0.arc) / (p1.arc - p0.arc);
  return { x: p0.x + (p1.x - p0.x) * frac, z: p0.z + (p1.z - p0.z) * frac };
}

const MenuWorm = ({ onWormClick }) => {
  const groupRef    = useRef();
  const headRef     = useRef();      // position + rotation of the whole head
  const headBodyRef = useRef();      // scale-only inner group — sphere only, eyes/antennae excluded
  const seg1Ref     = useRef();
  const seg2Ref     = useRef();
  const seg3Ref     = useRef();
  const tailRef     = useRef();

  const wiggling    = useRef(false);
  const wiggleStart = useRef(0);
  const targetScale  = useRef(0.70);
  const currentScale = useRef(0.70);
  const callbackRef  = useRef(onWormClick);
  callbackRef.current = onWormClick;

  // Path-based trailing: each entry { x, z, arc } — frame-rate independent
  const pathBuf  = useRef([{ x: 0, z: 0, arc: 0 }]);
  const prevHead = useRef({ x: 0, z: 0 });
  // Low-pass smoothed pointer for jitter-free cursor look-at blend
  const smoothPtr = useRef({ x: 0, y: 0 });

  useFrame(({ clock, pointer }, delta) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;

    if (wiggling.current && Date.now() - wiggleStart.current > 720) {
      wiggling.current = false;
      targetScale.current = 0.70;
      callbackRef.current?.();
    }

    // Smooth the raw pointer so small hand tremors don't jitter the head
    smoothPtr.current.x += (pointer.x - smoothPtr.current.x) * Math.min(1, delta * 5);
    smoothPtr.current.y += (pointer.y - smoothPtr.current.y) * Math.min(1, delta * 5);

    const isWiggle = wiggling.current;
    const freq = isWiggle ? 8.5 : 1.6;
    const ampX = isWiggle ? 0.27 : 0.16;
    const ampZ = isWiggle ? 0.13 : 0.07;

    // Head traces a Lissajous figure-8 in XZ
    const hx = Math.sin(t * freq) * ampX;
    const hz = Math.sin(t * freq * 0.55 + 1.0) * ampZ;

    // ── Distance-based path recording (frame-rate independent) ───────────────
    const prev = prevHead.current;
    const dx = hx - prev.x, dz = hz - prev.z;
    const stepDist = Math.sqrt(dx * dx + dz * dz);
    const path = pathBuf.current;

    if (stepDist >= _PATH_MIN_DIST) {
      path.push({ x: hx, z: hz, arc: path[path.length - 1].arc + stepDist });
      prevHead.current = { x: hx, z: hz };
      // Trim entries older than the max needed arc length
      const headArc = path[path.length - 1].arc;
      const minKeep = headArc - _MAX_PATH_LEN;
      let trim = 0;
      while (trim < path.length - 1 && path[trim + 1].arc < minKeep) trim++;
      if (trim > 0) path.splice(0, trim);
    }

    // ── Head: position + tilt + cursor blend + squash/stretch ────────────────
    // Analytic derivatives for smooth, jitter-free velocity
    const vx    = Math.cos(t * freq) * freq * ampX;
    const vz    = Math.cos(t * freq * 0.55 + 1.0) * freq * 0.55 * ampZ;
    const speed = Math.sqrt(vx * vx + vz * vz);

    if (headRef.current) {
      headRef.current.position.set(hx, _SEG_Y[0], hz);
      // 80 % path-tilt, 20 % cursor look-at so the worm glances at the pointer
      headRef.current.rotation.z = -Math.atan2(vx, 2.0) * 0.55 - smoothPtr.current.x * 0.20;
      headRef.current.rotation.x =  Math.atan2(vz, 2.0) * 0.40 + smoothPtr.current.y * 0.14;
    }
    // Squash/stretch the head body sphere without affecting eyes or antennae
    if (headBodyRef.current) {
      const stretch = 1 + Math.min(speed * 0.45, 0.35);
      const squash  = 1 / Math.sqrt(stretch);
      headBodyRef.current.scale.set(squash, stretch, squash);
    }

    // ── Body segments: arc-length interpolation + squash/stretch ─────────────
    const bodyRefs = [seg1Ref, seg2Ref, seg3Ref, tailRef];
    bodyRefs.forEach((ref, i) => {
      if (!ref.current) return;
      const pos = _samplePath(path, (i + 1) * _SEG_SPACING);
      ref.current.position.set(pos.x, _SEG_Y[i + 1], pos.z);
      // Speed decays slightly down the body (tail lags in energy)
      const segSpeed  = speed * Math.max(0.35, 1 - i * 0.18);
      const stretch   = 1 + Math.min(segSpeed * 0.28, 0.28);
      const squash    = 1 / Math.sqrt(stretch);
      ref.current.scale.set(squash, stretch, squash);
    });

    // Vertical bob of the whole group
    groupRef.current.position.y = 1.35 + (isWiggle
      ? Math.abs(Math.sin(t * 14)) * 0.22
      : Math.sin(t * 1.5) * 0.045);

    currentScale.current += (targetScale.current - currentScale.current) * Math.min(1, delta * 16);
    groupRef.current.scale.setScalar(currentScale.current);
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (wiggling.current) return;
    wiggling.current = true;
    wiggleStart.current = Date.now();
    targetScale.current = 0.826;
  };
  const handlePointerDown = (e) => { e.stopPropagation(); targetScale.current = 0.581; };
  const handlePointerUp   = (e) => { e.stopPropagation(); if (!wiggling.current) targetScale.current = 0.70; };

  return (
    <group
      ref={groupRef}
      position={[0, 1.72, 0]}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Head — outer group: position + rotation; inner group: squash/stretch sphere only */}
      <group ref={headRef}>
        <group ref={headBodyRef}>
          <mesh>
            <sphereGeometry args={[_SEG_R[0], 16, 16]} />
            <meshPhysicalMaterial
              color={_SEG_COL[0]} roughness={0.22} metalness={0.0}
              emissive={_SEG_COL[0]} emissiveIntensity={0.14}
              transmission={0.10} thickness={0.45} ior={1.42}
              clearcoat={0.35} clearcoatRoughness={0.18}
            />
          </mesh>
        </group>
        {/* Eyes */}
        <mesh position={[-0.085, 0.13, 0.19]}>
          <sphereGeometry args={[0.058, 8, 8]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>
        <mesh position={[0.085, 0.13, 0.19]}>
          <sphereGeometry args={[0.058, 8, 8]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>
        <mesh position={[-0.085, 0.135, 0.235]}>
          <sphereGeometry args={[0.03, 6, 6]} />
          <meshStandardMaterial color="#0a0a14" roughness={0.5} />
        </mesh>
        <mesh position={[0.085, 0.135, 0.235]}>
          <sphereGeometry args={[0.03, 6, 6]} />
          <meshStandardMaterial color="#0a0a14" roughness={0.5} />
        </mesh>
        {/* Antennae */}
        <mesh position={[-0.11, 0.28, 0.1]} rotation={[0, 0, 0.3]}>
          <cylinderGeometry args={[0.012, 0.008, 0.25, 6]} />
          <meshStandardMaterial color={_SEG_COL[0]} roughness={0.5} />
        </mesh>
        <mesh position={[0.11, 0.28, 0.1]} rotation={[0, 0, -0.3]}>
          <cylinderGeometry args={[0.012, 0.008, 0.25, 6]} />
          <meshStandardMaterial color={_SEG_COL[0]} roughness={0.5} />
        </mesh>
        <mesh position={[-0.145, 0.38, 0.1]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial color="#b0ffda" emissive="#40ff99" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0.145, 0.38, 0.1]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial color="#b0ffda" emissive="#40ff99" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* Body segments — group scale drives squash/stretch each frame */}
      <group ref={seg1Ref}>
        <mesh>
          <sphereGeometry args={[_SEG_R[1], 12, 12]} />
          <meshPhysicalMaterial
            color={_SEG_COL[1]} roughness={0.26} metalness={0.0}
            emissive={_SEG_COL[1]} emissiveIntensity={0.10}
            transmission={0.09} thickness={0.40} ior={1.40}
            clearcoat={0.25} clearcoatRoughness={0.22}
          />
        </mesh>
      </group>
      <group ref={seg2Ref}>
        <mesh>
          <sphereGeometry args={[_SEG_R[2], 12, 12]} />
          <meshPhysicalMaterial
            color={_SEG_COL[2]} roughness={0.28} metalness={0.0}
            emissive={_SEG_COL[2]} emissiveIntensity={0.09}
            transmission={0.08} thickness={0.36} ior={1.38}
            clearcoat={0.20} clearcoatRoughness={0.24}
          />
        </mesh>
      </group>
      <group ref={seg3Ref}>
        <mesh>
          <sphereGeometry args={[_SEG_R[3], 10, 10]} />
          <meshPhysicalMaterial
            color={_SEG_COL[3]} roughness={0.30} metalness={0.0}
            emissive={_SEG_COL[3]} emissiveIntensity={0.08}
            transmission={0.07} thickness={0.32} ior={1.36}
            clearcoat={0.15} clearcoatRoughness={0.26}
          />
        </mesh>
      </group>
      <group ref={tailRef}>
        <mesh>
          <sphereGeometry args={[_SEG_R[4], 10, 10]} />
          <meshPhysicalMaterial
            color={_SEG_COL[4]} roughness={0.33} metalness={0.0}
            emissive={_SEG_COL[4]} emissiveIntensity={0.07}
            transmission={0.06} thickness={0.28} ior={1.35}
            clearcoat={0.10} clearcoatRoughness={0.28}
          />
        </mesh>
      </group>

      {/* Soft glow halo */}
      <mesh position={[0, 0.56, 0]}>
        <sphereGeometry args={[0.55, 10, 10]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.055} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
};

// ─── Rotating cube + worm mascot — exported for App.jsx's shared Canvas ───────
export const RotatingBlackCube = ({ onCubeClick, onWormClick }) => {
  const cubeRef = useRef();
  const shaking = useRef(false);
  const shakeStart = useRef(0);
  const cubeTargetScale = useRef(0.76);
  const cubeCurrentScale = useRef(0.76);
  const onCubeClickRef = useRef(onCubeClick);
  onCubeClickRef.current = onCubeClick;

  useFrame((state, delta) => {
    if (!cubeRef.current) return;
    const t = state.clock.elapsedTime;
    updateSharedTime(t);

    cubeCurrentScale.current += (cubeTargetScale.current - cubeCurrentScale.current) * Math.min(1, delta * 18);
    cubeRef.current.scale.setScalar(cubeCurrentScale.current);

    if (shaking.current) {
      const elapsed = Date.now() - shakeStart.current;
      if (elapsed > 540) {
        shaking.current = false;
        cubeTargetScale.current = 1.0;
        cubeRef.current.position.set(0, -0.2, 0);
        onCubeClickRef.current?.();
      } else {
        const intensity = 0.10 * (1 - elapsed / 540);
        cubeRef.current.position.x = Math.sin(t * 42) * intensity;
        cubeRef.current.position.y = -0.2 + Math.sin(t * 37 + 1) * intensity * 0.5;
        cubeRef.current.position.z = Math.sin(t * 31 + 2) * intensity * 0.3;
      }
    } else {
      // Compound rotation shows all 6 faces over time
      cubeRef.current.rotation.y = t * 0.20 + Math.sin(t * 0.09) * 0.55;
      cubeRef.current.rotation.x = Math.sin(t * 0.13) * 0.48;
      cubeRef.current.rotation.z = Math.sin(t * 0.07) * 0.18;
      cubeRef.current.position.set(0, -0.2, 0);
    }
  });

  const handleCubeClick = (e) => {
    e.stopPropagation();
    if (shaking.current) return;
    shaking.current = true;
    shakeStart.current = Date.now();
  };
  const handleCubeDown = () => { cubeTargetScale.current = 0.7; };
  const handleCubeUp = () => { if (!shaking.current) cubeTargetScale.current = 0.76; };

  return (
    <>
      <group
        ref={cubeRef}
        position={[0, -0.2, 0]}
        onClick={handleCubeClick}
        onPointerDown={handleCubeDown}
        onPointerUp={handleCubeUp}
        onPointerLeave={handleCubeUp}
      >
        <ShufflingCube />
        <FacePulses />
      </group>
      <MenuWorm onWormClick={onWormClick} />
    </>
  );
};

// ─── Nav items ────────────────────────────────────────────────────────────────
const NavItem = ({ icon, label, color, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '8px', padding: '14px 12px 12px',
        background: hovered ? `${color}20` : 'transparent',
        border: 'none', cursor: 'pointer',
        transition: 'background 0.2s ease',
        position: 'relative',
      }}
    >
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit',
          background: `radial-gradient(ellipse 80% 120% at 50% 0%, ${color}25 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
      )}
      <span style={{
        lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        filter: hovered ? `drop-shadow(0 0 8px ${color}cc)` : `drop-shadow(0 0 4px ${color}55)`,
        transition: 'filter 0.2s ease',
      }}>{icon}</span>
      <span style={{
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: hovered ? color : 'rgba(200,220,255,0.75)',
        transition: 'color 0.2s ease',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
      }}>{label}</span>
    </button>
  );
};

// ─── Store nav item ───────────────────────────────────────────────────────────
const StoreNavItem = ({ onStore }) => {
  const color = '#6366f1';
  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        onClick={onStore}
        style={{
          width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '8px', padding: '14px 12px 12px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          position: 'relative', opacity: 0.85,
          transition: 'opacity 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.85'; }}
      >
        <span style={{
          lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: `drop-shadow(0 0 6px ${color}66)`,
        }}>
          <StoreIcon />
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: '#818cf8',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
        }}>Store</span>
        <ParityWallet dark={true} />
      </button>
    </div>
  );
};

const MENU_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif";
const menuStyles = {
  titleWrap: {
    position: 'absolute', top: 0, left: 0, right: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    paddingTop: 'max(44px, env(safe-area-inset-top,44px))',
    paddingLeft: '16px', paddingRight: '16px',
    transition: 'all 0.75s cubic-bezier(0.22,1,0.36,1)',
  },
  titleCard: {
    display: 'inline-block',
    background: 'rgba(6,10,24,0.72)',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    borderRadius: '24px',
    padding: '18px 28px 16px',
    border: '1px solid rgba(120,160,255,0.14)',
    boxShadow: '0 4px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(120,160,255,0.10)',
  },
  bottomStack: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
    padding: '0 16px max(16px, env(safe-area-inset-bottom, 16px))',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
    transition: 'opacity 0.55s ease 0.1s, transform 0.55s cubic-bezier(0.22,1,0.36,1) 0.1s',
    pointerEvents: 'all',
  },
};

const MenuTitleCard = ({ visible }) => (
  <div style={{
    ...menuStyles.titleWrap,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(-18px)',
  }}>
    <div style={menuStyles.titleCard}>
      <h1 style={{
        margin: 0, fontSize: 'clamp(54px,13vw,96px)', fontWeight: 900,
        letterSpacing: '0.1em', lineHeight: 1, fontFamily: "'Courier New', monospace",
        background: 'linear-gradient(100deg,#ef4444 0%,#f97316 18%,#eab308 36%,#22c55e 54%,#3b82f6 72%,#a855f7 90%,#ef4444 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        textAlign: 'center',
      }}>
        WORM<sup style={{ fontSize: '0.42em', verticalAlign: 'super', WebkitTextFillColor: 'transparent' }}>3</sup>
      </h1>
    </div>
  </div>
);

const COMING_MODES = [
  { icon: '📖', label: 'Story',    color: '#ef4444' },
  { icon: '∮',  label: 'Holonomy', color: '#00f5ff' },
  { icon: '⬡',  label: 'Biome',   color: '#60a5fa' },
  { icon: '✦',  label: 'Merge',   color: '#a78bfa' },
];

const MenuBottomSection = ({ visible, onWormSelect, onCubeSelect, onFreeplay, onStore, onComingSoon }) => (
  <div style={{
    ...menuStyles.bottomStack,
    opacity: visible ? 1 : 0,
    transform: visible ? 'none' : 'translateY(16px)',
  }}>

    {/* Primary mode buttons */}
    <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'center' }}>
      <button
        onClick={onWormSelect}
        style={{
          minWidth: '132px', borderRadius: '14px', border: '1px solid rgba(34,197,94,0.55)',
          background: 'linear-gradient(180deg, rgba(34,197,94,0.26), rgba(6,10,24,0.82))',
          color: '#dcffe9', padding: '12px 14px', fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase', fontSize: '13px', fontFamily: MENU_FONT,
          boxShadow: '0 0 18px rgba(34,197,94,0.24)', cursor: 'pointer',
          transition: 'transform 220ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease, border-color 200ms ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.07)';
          e.currentTarget.style.boxShadow = '0 0 36px rgba(34,197,94,0.55), 0 0 72px rgba(34,197,94,0.18)';
          e.currentTarget.style.borderColor = 'rgba(34,197,94,0.90)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 0 18px rgba(34,197,94,0.24)';
          e.currentTarget.style.borderColor = 'rgba(34,197,94,0.55)';
        }}
      >WORM</button>

      <button
        onClick={onCubeSelect}
        style={{
          minWidth: '132px', borderRadius: '14px', border: '1px solid rgba(59,130,246,0.55)',
          background: 'linear-gradient(180deg, rgba(59,130,246,0.26), rgba(6,10,24,0.82))',
          color: '#dff0ff', padding: '10px 14px 8px', fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase', fontSize: '13px', fontFamily: MENU_FONT,
          boxShadow: '0 0 18px rgba(59,130,246,0.24)', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          transition: 'transform 220ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease, border-color 200ms ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.07)';
          e.currentTarget.style.boxShadow = '0 0 36px rgba(59,130,246,0.55), 0 0 72px rgba(59,130,246,0.18)';
          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.90)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 0 18px rgba(59,130,246,0.24)';
          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.55)';
        }}
      >
        <span>CUBE</span>
        <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(180,220,255,0.9)' }}>START HERE</span>
      </button>
    </div>

    {/* Coming Soon mode teasers */}
    <div style={{ width: '100%', maxWidth: '296px' }}>
      <p style={{
        margin: '0 0 6px', textAlign: 'center',
        fontSize: '9px', fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase',
        color: 'rgba(160,185,255,0.35)', fontFamily: MENU_FONT,
      }}>Coming Soon</p>
      <div style={{ display: 'flex', gap: '6px' }}>
        {COMING_MODES.map(mode => (
          <button
            key={mode.label}
            onClick={onComingSoon}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              padding: '8px 4px 7px',
              borderRadius: '12px',
              border: `1px solid ${mode.color}28`,
              background: `${mode.color}10`,
              cursor: 'pointer',
              transition: 'background 180ms ease, border-color 180ms ease, transform 180ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${mode.color}22`;
              e.currentTarget.style.borderColor = `${mode.color}55`;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = `${mode.color}10`;
              e.currentTarget.style.borderColor = `${mode.color}28`;
              e.currentTarget.style.transform = 'none';
            }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>{mode.icon}</span>
            <span style={{
              fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: `${mode.color}aa`, fontFamily: MENU_FONT,
            }}>{mode.label}</span>
          </button>
        ))}
      </div>
    </div>

    {/* Utility nav pill */}
    <div style={{
      borderRadius: '100px', padding: '1.5px',
      background: 'linear-gradient(90deg,#22c55e60,#3b82f660,#6366f160)',
      boxShadow: '0 0 20px rgba(60,80,200,0.25), 0 8px 32px rgba(0,0,0,0.5)',
      width: 'min(260px, 100%)',
    }}>
      <div style={{
        display: 'flex', background: 'rgba(6,10,24,0.80)',
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        borderRadius: '100px', boxShadow: 'inset 0 1px 0 rgba(120,160,255,0.14)', overflow: 'visible',
      }}>
        <NavItem icon={<ExploreIcon />} label="Explore" color="#22c55e" onClick={onFreeplay} />
        <div style={{ width: '1px', alignSelf: 'stretch', margin: '10px 0', background: 'rgba(120,160,255,0.15)' }} />
        <StoreNavItem onStore={onStore} />
      </div>
    </div>

  </div>
);

// ─── Ambient background orbs ─────────────────────────────────────────────────
const ORB_DEFS = [
  { color: '#3b82f6', top: '-18%',  left: '-12%',  size: '58vmax', anim: 'orbDrift1 30s ease-in-out infinite alternate',          opacity: 0.30 },
  { color: '#a855f7', bottom: '-22%',right: '-16%', size: '62vmax', anim: 'orbDrift2 36s ease-in-out infinite alternate',          opacity: 0.24 },
  { color: '#f97316', top: '15%',   right: '-18%',  size: '46vmax', anim: 'orbDrift3 24s ease-in-out infinite alternate',          opacity: 0.18 },
  { color: '#22c55e', bottom: '8%', left: '-14%',   size: '42vmax', anim: 'orbDrift1 28s ease-in-out infinite alternate-reverse',  opacity: 0.15 },
  { color: '#eab308', top: '44%',   left: '28%',    size: '36vmax', anim: 'orbDrift2 40s ease-in-out infinite alternate',          opacity: 0.11 },
];

const MenuBackgroundOrbs = () => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
    {ORB_DEFS.map((orb, i) => (
      <div key={i} style={{
        position: 'absolute',
        width: orb.size, height: orb.size,
        top: orb.top, left: orb.left, bottom: orb.bottom, right: orb.right,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
        filter: 'blur(72px)',
        opacity: orb.opacity,
        animation: orb.anim,
      }} />
    ))}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const MainMenu = ({
  onPlay: _onPlay, onLevels: _onLevels, onFreeplay, onCoop: _onCoop, onTeach: _onTeach,
  onSettings: _onSettings, onBiome: _onBiome, onDisparity: _onDisparity,
  onWormHealer: _onWormHealer, onHolonomy: _onHolonomy, onMerge: _onMerge,
  onStore, onComingSoon, onMobiusCubelet: _onMobiusCubelet,
}) => {
  const [titleVisible, setTitleVisible] = useState(false);
  const [bottomVisible, setBottomVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setTitleVisible(true), 200);
    const t3 = setTimeout(() => setBottomVisible(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t3); };
  }, []);

  const handleWormSelect = () => {
    _onWormHealer?.();
  };
  const handleCubeSelect = () => {
    _onLevels?.();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 9999, overflow: 'hidden', pointerEvents: 'none' }}>
      <MenuBackgroundOrbs />
      <ScreenGlow />
      <MenuTitleCard visible={titleVisible} />
      <MenuBottomSection
        visible={bottomVisible}
        onWormSelect={handleWormSelect}
        onCubeSelect={handleCubeSelect}
        onFreeplay={onFreeplay}
        onStore={onStore}
        onComingSoon={onComingSoon}
      />
    </div>
  );
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const StoreIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="10" width="18" height="11" rx="2" stroke="#6366f1" strokeWidth="1.5" fill="none" />
    <path d="M3 10 L5 4 H19 L21 10" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    <line x1="12" y1="10" x2="12" y2="21" stroke="#6366f1" strokeWidth="1.2" opacity="0.5" />
    <circle cx="9" cy="15" r="1.2" fill="#6366f1" opacity="0.7" />
    <circle cx="15" cy="15" r="1.2" fill="#6366f1" opacity="0.7" />
  </svg>
);
const ExploreIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <polygon points="12,2 20,10 12,22 4,10" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="12,2 20,10 12,14 4,10" fill="#22c55e" opacity="0.25" />
    <line x1="4" y1="10" x2="20" y2="10" stroke="#22c55e" strokeWidth="1.2" opacity="0.65" />
  </svg>
);

export default MainMenu;
