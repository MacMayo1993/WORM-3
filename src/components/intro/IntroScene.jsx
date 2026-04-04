import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import IntroCubie from './IntroCubie.jsx';
import IntroTunnel from '../../manifold/IntroTunnel.jsx';
import WormParticle from '../../manifold/WormParticle.jsx';
import ArrivalBurst from '../../manifold/ArrivalBurst.jsx';
import { FACE_COLORS } from '../../utils/constants.js';
import { play, vibrate } from '../../utils/audio.js';
import { updateSharedTime } from '../../3d/styles/TileStyleMaterials.jsx';
import {
  FULL_FLIP_START, FULL_FLIP_END,
  GREEN_SHOW_START,
  TUNNEL_FORM_START,
  EXPLOSION_START, EXPLOSION_END,
  WORM_START,
  IMPLODE_START, IMPLODE_END,
} from './introTiming.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ease = t => t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = t => Math.max(0, Math.min(1, t));
const progress = (t, start, end) => clamp01((t - start) / (end - start));
const smoothstep = t => t * t * (3 - 2 * t);
const AWAKEN_END = 1.2;

const getStickerWorldPos = (x, y, z, dirKey, size, ef = 0) => {
  const k = (size - 1) / 2;
  const ex = (x - k) * (1 + ef * 1.8);
  const ey = (y - k) * (1 + ef * 1.8);
  const ez = (z - k) * (1 + ef * 1.8);
  const o = 0.51;
  if (dirKey === 'PZ') return [ex,      ey,      ez + o];
  if (dirKey === 'NZ') return [ex,      ey,      ez - o];
  if (dirKey === 'PX') return [ex + o,  ey,      ez    ];
  if (dirKey === 'NX') return [ex - o,  ey,      ez    ];
  if (dirKey === 'PY') return [ex,      ey + o,  ez    ];
  if (dirKey === 'NY') return [ex,      ey - o,  ez    ];
  return [ex, ey, ez];
};

// ─── Grid lines on assembled cube faces ──────────────────────────────────────
// Renders the 3×3 seam lines on each face in that face's manifold color.
// Fades out as the explosion begins; pulses brighter when the matching
// antipodal-pair text is on screen.
const GridLines = ({ time }) => {
  const S = 1.5, G = 0.5, E = 0.006; // half-extent, seam offset, depth epsilon

  // Static line endpoints — one pair per seam line, per face
  const faces = useMemo(() => [
    { colorId: 1, pulse: 'z',
      seams: [[[-S,-G,S+E],[S,-G,S+E]], [[-S,G,S+E],[S,G,S+E]],
               [[-G,-S,S+E],[-G,S,S+E]], [[G,-S,S+E],[G,S,S+E]]] },
    { colorId: 4, pulse: 'z',
      seams: [[[-S,-G,-S-E],[S,-G,-S-E]], [[-S,G,-S-E],[S,G,-S-E]],
               [[-G,-S,-S-E],[-G,S,-S-E]], [[G,-S,-S-E],[G,S,-S-E]]] },
    { colorId: 5, pulse: 'x',
      seams: [[[S+E,-G,-S],[S+E,-G,S]], [[S+E,G,-S],[S+E,G,S]],
               [[S+E,-S,-G],[S+E,S,-G]], [[S+E,-S,G],[S+E,S,G]]] },
    { colorId: 2, pulse: 'x',
      seams: [[[-S-E,-G,-S],[-S-E,-G,S]], [[-S-E,G,-S],[-S-E,G,S]],
               [[-S-E,-S,-G],[-S-E,S,-G]], [[-S-E,-S,G],[-S-E,S,G]]] },
    { colorId: 3, pulse: 'y',
      seams: [[[-S,S+E,-G],[S,S+E,-G]], [[-S,S+E,G],[S,S+E,G]],
               [[-G,S+E,-S],[-G,S+E,S]], [[G,S+E,-S],[G,S+E,S]]] },
    { colorId: 6, pulse: 'y',
      seams: [[[-S,-S-E,-G],[S,-S-E,-G]], [[-S,-S-E,G],[S,-S-E,G]],
               [[-G,-S-E,-S],[-G,-S-E,S]], [[G,-S-E,-S],[G,-S-E,S]]] },
  ], []);

  // Base opacity fades to zero as the explosion starts
  const baseOpacity = (() => {
    if (time >= EXPLOSION_START) return 0;
    if (time >= TUNNEL_FORM_START) return (1 - progress(time, TUNNEL_FORM_START, EXPLOSION_START)) * 0.15;
    return 0.15;
  })();

  if (baseOpacity <= 0) return null;

  // Grid line pulses — highlight the relevant face pair during each callout window.
  // Pre-explosion: x-axis (PX=Blue, NX=Green) during "Blue ↔ Green" text.
  const xPulse = (time >= GREEN_SHOW_START + 0.4 && time < FULL_FLIP_START)
    ? Math.sin(progress(time, GREEN_SHOW_START + 0.4, FULL_FLIP_START) * Math.PI) * 0.70
    : 0;
  // Smaller ambient pulses for z and y axes whenever blue/green are pulsing
  // (gives the other seams a faint sympathetic glow so the cube feels alive).
  const zPulse = xPulse * 0.4;
  const yPulse = xPulse * 0.3;

  const pulseFor = { x: xPulse, y: yPulse, z: zPulse };

  return (
    <>
      {faces.map(({ colorId, pulse, seams }, fi) =>
        seams.map((pts, si) => {
          const p = pulseFor[pulse];
          return (
            <Line
              key={`gl-${fi}-${si}`}
              points={pts}
              color={FACE_COLORS[colorId]}
              transparent
              opacity={Math.min(1, baseOpacity + p)}
              lineWidth={1 + p * 1.5}
            />
          );
        })
      )}
    </>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────
const IntroScene = ({ time, onComplete }) => {
  const cubeGroupRef = useRef();
  const cubieRefs    = useRef([]);
  const { camera }   = useThree();
  const size = 3;
  const completedRef = useRef(false);
  const cameraStateRef = useRef({ x: 0, y: 0, z: 9 });
  const cubeRotRef = useRef({ x: 0, y: 0 });

  // ── KEY FIX: keep a ref to time so useFrame always sees the latest value ──
  // useFrame callbacks capture variables at registration time (stale closure).
  // Storing time in a ref and reading timeRef.current inside useFrame gives
  // fresh access every frame without needing to re-register the callback.
  const timeRef = useRef(time);
  timeRef.current = time; // updated synchronously on every render

  if (time >= IMPLODE_END && !completedRef.current && onComplete) {
    completedRef.current = true;
    setTimeout(() => onComplete(), 100);
  }

  const [wormComplete, setWormComplete] = useState({});
  const [showBurst,    setShowBurst]    = useState({});
  const [burstTimes,   setBurstTimes]   = useState({});

  // ── Face reveal intensities ──────────────────────────────────────────────────
  // Requested behavior:
  // 1) Start as an all-black cube.
  // 2) Introduce color during explosion.
  // 3) Return to all-black when the cube reassembles.
  const getFaceReveal = (faceKey) => {
    // Keep the full cube black until explosion begins.
    if (time < EXPLOSION_START) return 0;

    // During explosion, reveal antipodal axis pairs in sequence so each step is legible.
    // z-axis pair first (blue/green), then x-axis (red/orange), then y-axis (white/yellow).
    if (time < EXPLOSION_END) {
      const axisSlots = {
        PZ: [0.00, 0.33], NZ: [0.00, 0.33],
        PX: [0.20, 0.66], NX: [0.20, 0.66],
        PY: [0.40, 1.00], NY: [0.40, 1.00],
      };
      const [startN, endN] = axisSlots[faceKey] || [0, 1];
      const blastN = progress(time, EXPLOSION_START, EXPLOSION_END);
      return smoothstep(progress(blastN, startN, endN));
    }

    // Hold fully colored while exploded.
    if (time < IMPLODE_START) return 1;

    // Reverse-order drain: Y axis first (0–60%), X (20–80%), Z last (40–100%)
    // Mirrors the reveal sequence in reverse for a satisfying pedagogical callback.
    const drainSlots = {
      PY: [0.0, 0.6], NY: [0.0, 0.6],
      PX: [0.2, 0.8], NX: [0.2, 0.8],
      PZ: [0.4, 1.0], NZ: [0.4, 1.0],
    };
    const [dStart, dEnd] = drainSlots[faceKey] || [0, 1];
    const implodeN = progress(time, IMPLODE_START, IMPLODE_END);
    return 1 - smoothstep(progress(implodeN, dStart, dEnd));
  };

  // ── Center tile flip: forward 0→π, brief hold, then reverse π→0 ─────────────
  // Reversing before EXPLOSION_START ensures the PX center sticker is face-forward
  // (not back-face culled) when the exploded blue face is revealed.
  const getCenterTileFlip = () => {
    const HOLD_END = FULL_FLIP_END + 0.3; // pause at π for 0.3 s before snapping back
    if (time >= FULL_FLIP_START && time < FULL_FLIP_END) {
      return ease(clamp01(progress(time, FULL_FLIP_START, FULL_FLIP_END))) * Math.PI;
    }
    if (time >= FULL_FLIP_END && time < HOLD_END) return Math.PI;
    if (time >= HOLD_END && time < EXPLOSION_START) {
      return (1 - ease(progress(time, HOLD_END, EXPLOSION_START))) * Math.PI;
    }
    return 0;
  };

  // ── No shader styles — clean solid Rubik's colors throughout ───────────────
  const faceStyles = {};

  // ── Explosion factor ────────────────────────────────────────────────────────
  let explosionFactor = 0;
  let antipodalTwist = 0;

  if (time >= EXPLOSION_START && time < EXPLOSION_END) {
    const t = (time - EXPLOSION_START) / (EXPLOSION_END - EXPLOSION_START);
    explosionFactor = ease(t) * 1.5;
    antipodalTwist = Math.sin(t * Math.PI) * Math.PI;
  } else if (time >= EXPLOSION_END && time < IMPLODE_START) {
    explosionFactor = 1.5;
  } else if (time >= IMPLODE_START && time < IMPLODE_END) {
    const t = (time - IMPLODE_START) / (IMPLODE_END - IMPLODE_START);
    explosionFactor = (1 - ease(t)) * 1.5;
  }

  // ── useFrame: reads timeRef.current (always fresh) ─────────────────────────
  useFrame(({ clock }, delta) => {
    updateSharedTime(clock.getElapsedTime());

    const t = timeRef.current; // ← always the current prop value, never stale

    if (cubeGroupRef.current) {
      let targetRotY = 0;
      let targetRotX = 0;
      if (t < FULL_FLIP_START) {
        const baseRot = t * 0.28;
        targetRotY = baseRot;
        targetRotX = Math.sin(t * 0.15) * 0.12;
      } else if (t < EXPLOSION_START) {
        // Gently settle instead of abruptly switching to the pre-explosion pose.
        const settle = smoothstep(progress(t, FULL_FLIP_START, EXPLOSION_START));
        const preY = FULL_FLIP_START * 0.28 + Math.sin((t - FULL_FLIP_START) * 0.5) * 0.05;
        const preX = Math.sin(t * 0.15) * 0.08;
        targetRotY = preY * (1 - settle);
        targetRotX = preX * (1 - settle);
      }

      const rotLerp = 1 - Math.exp(-Math.max(0, delta) * 10);
      cubeRotRef.current.y += (targetRotY - cubeRotRef.current.y) * rotLerp;
      cubeRotRef.current.x += (targetRotX - cubeRotRef.current.x) * rotLerp;
      cubeGroupRef.current.rotation.set(cubeRotRef.current.x, cubeRotRef.current.y, 0);

      // "Cube awakening": soft scale-up + rise settle in the opening beat.
      // During explosion hold: subtle breathing pulse.
      if (t < AWAKEN_END) {
        const p = smoothstep(progress(t, 0, AWAKEN_END));
        const targetScale = 0.9 + p * 0.1 + (1 - p) * Math.sin(t * 10) * 0.01;
        const targetY = (1 - p) * -0.35;
        const awakenLerp = 1 - Math.exp(-Math.max(0, delta) * 8);
        cubeGroupRef.current.scale.x += (targetScale - cubeGroupRef.current.scale.x) * awakenLerp;
        cubeGroupRef.current.scale.y += (targetScale - cubeGroupRef.current.scale.y) * awakenLerp;
        cubeGroupRef.current.scale.z += (targetScale - cubeGroupRef.current.scale.z) * awakenLerp;
        cubeGroupRef.current.position.y += (targetY - cubeGroupRef.current.position.y) * awakenLerp;
      } else if (t >= EXPLOSION_END && t < IMPLODE_START) {
        cubeGroupRef.current.scale.setScalar(1 + Math.sin(t * 2.8) * 0.025);
        const settleLerp = 1 - Math.exp(-Math.max(0, delta) * 10);
        cubeGroupRef.current.position.y += (0 - cubeGroupRef.current.position.y) * settleLerp;
      } else {
        const settleLerp = 1 - Math.exp(-Math.max(0, delta) * 10);
        cubeGroupRef.current.scale.x += (1 - cubeGroupRef.current.scale.x) * settleLerp;
        cubeGroupRef.current.scale.y += (1 - cubeGroupRef.current.scale.y) * settleLerp;
        cubeGroupRef.current.scale.z += (1 - cubeGroupRef.current.scale.z) * settleLerp;
        cubeGroupRef.current.position.y += (0 - cubeGroupRef.current.position.y) * settleLerp;
      }
    }

    // Camera choreography
    let radius = 9;
    let camY   = 2.5;
    let angle  = 0;

    if (t < 1.0) {
      const p = ease(t / 1.0);
      radius = 18 - p * 9;
      camY   = 6  - p * 3.5;
      angle  = 0.3;
    } else if (t < EXPLOSION_START) {
      radius = 9;
      camY   = 2.5 + Math.sin((t - 1.0) * 0.6) * 0.8;
      angle  = 0.3 + (t - 1.0) * 0.04;
    } else if (t < EXPLOSION_START + 1.5) {
      const p = ease((t - EXPLOSION_START) / 1.5);
      radius = 9 + p * 13;
      camY   = 2.5 + p * 4.5;
      angle  = 0.3 + (t - 1.0) * 0.04;
    } else if (t < IMPLODE_START) {
      radius = 22;
      camY   = 7;
      // Faster orbit during explosion showcase; keep continuity from previous phase
      const angleAtHoldStart = 0.3 + (EXPLOSION_START + 1.5 - 1.0) * 0.04;
      angle  = angleAtHoldStart + (t - (EXPLOSION_START + 1.5)) * 0.16;
    } else {
      const p = ease((t - IMPLODE_START) / (IMPLODE_END - IMPLODE_START));
      radius = 22 - p * 10;
      camY   = 7  - p * 3;
      angle  = 0.3 + (t - 1.0) * 0.08;
    }

    const targetX = Math.sin(angle) * radius;
    const targetZ = Math.cos(angle) * radius;
    const targetY = camY;
    const camLerp = 1 - Math.exp(-Math.max(0, delta) * 6);

    cameraStateRef.current.x += (targetX - cameraStateRef.current.x) * camLerp;
    cameraStateRef.current.y += (targetY - cameraStateRef.current.y) * camLerp;
    cameraStateRef.current.z += (targetZ - cameraStateRef.current.z) * camLerp;

    camera.position.x = cameraStateRef.current.x;
    camera.position.z = cameraStateRef.current.z;
    camera.position.y = cameraStateRef.current.y;
    camera.lookAt(0, 0, 0);
  });

  // ── Cubies layout ───────────────────────────────────────────────────────────
  const items = useMemo(() => {
    const k = (size - 1) / 2;
    const arr = [];
    let i = 0;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          arr.push({ key: i++, pos: [x - k, y - k, z - k], gx: x, gy: y, gz: z });
        }
      }
    }
    return arr;
  }, [size]);

  // ── Tunnels ─────────────────────────────────────────────────────────────────
  const tunnels = useMemo(() => {
    const pairs = [];
    for (let x = 0; x < size; x++)
      for (let y = 0; y < size; y++)
        pairs.push({ id: `z-${x}-${y}`, group: 0,
          start: getStickerWorldPos(x, y, size-1, 'PZ', size, explosionFactor),
          end:   getStickerWorldPos(x, y, 0,      'NZ', size, explosionFactor),
          color1: FACE_COLORS[1], color2: FACE_COLORS[4] });
    for (let y = 0; y < size; y++)
      for (let z = 0; z < size; z++)
        pairs.push({ id: `x-${y}-${z}`, group: 1,
          start: getStickerWorldPos(size-1, y, z, 'PX', size, explosionFactor),
          end:   getStickerWorldPos(0,      y, z, 'NX', size, explosionFactor),
          color1: FACE_COLORS[5], color2: FACE_COLORS[2] });
    for (let x = 0; x < size; x++)
      for (let z = 0; z < size; z++)
        pairs.push({ id: `y-${x}-${z}`, group: 2,
          start: getStickerWorldPos(x, size-1, z, 'PY', size, explosionFactor),
          end:   getStickerWorldPos(x, 0,      z, 'NY', size, explosionFactor),
          color1: FACE_COLORS[3], color2: FACE_COLORS[6] });
    return pairs;
  }, [explosionFactor, size]);

  const tunnelFormation = useMemo(() => {
    if (time < TUNNEL_FORM_START) return 0;
    if (time < EXPLOSION_START) return ease(progress(time, TUNNEL_FORM_START, EXPLOSION_START));
    return 1;
  }, [time]);

  const tunnelOpacity = useMemo(() => {
    if (time < TUNNEL_FORM_START)             return 0;
    if (time < EXPLOSION_START)               return progress(time, TUNNEL_FORM_START, EXPLOSION_START) * 0.7;
    if (time < EXPLOSION_START + 0.5)         return 0.7 + progress(time, EXPLOSION_START, EXPLOSION_START + 0.5) * 0.3;
    if (time >= IMPLODE_START)                return 1 - progress(time, IMPLODE_START, IMPLODE_END) * 0.7;
    return 1;
  }, [time]);

  const highlightedGroup = useMemo(() => {
    if (time >= EXPLOSION_END   && time < EXPLOSION_END + 1.0) return 0;
    if (time >= EXPLOSION_END + 1.0 && time < EXPLOSION_END + 2.0) return 1;
    if (time >= EXPLOSION_END + 2.0 && time < EXPLOSION_END + 3.0) return 2;
    return -1;
  }, [time]);

  // ── Worm paths ──────────────────────────────────────────────────────────────
  const wormPaths = useMemo(() => {
    const paths = [];
    for (let x = 0; x < size; x++)
      for (let y = 0; y < size; y++)
        paths.push({
          id:     `${x}-${y}`,
          start:  getStickerWorldPos(x, y, size-1, 'PZ', size, explosionFactor),
          end:    getStickerWorldPos(x, y, 0,      'NZ', size, explosionFactor),
          color1: FACE_COLORS[1],
          color2: FACE_COLORS[4],
        });
    return paths;
  }, [explosionFactor]);

  const handleWormComplete = (id) => {
    if (wormComplete[id]) return;
    setWormComplete(prev => ({ ...prev, [id]: true }));
    setShowBurst(prev   => ({ ...prev, [id]: true }));
    setBurstTimes(prev  => ({ ...prev, [id]: time }));
    if (id === '1-1') { play('/sounds/flip.mp3'); vibrate(20); }
  };

  // ── Pre-compute the center tile flip ───────────────────────────────────────
  const centerFlipAngle = getCenterTileFlip();
  const CENTER_X = size - 1;
  const CENTER_Y = 1;
  const CENTER_Z = 1;

  // ── Axis-pair face pulses during explosion hold callouts ─────────────────
  // Bell-curve pulse (0→1→0) over each 1-second axis-callout window.
  const pulseFaces = useMemo(() => {
    const bell = (start, end) => {
      if (time < start || time > end) return 0;
      return Math.sin(progress(time, start, end) * Math.PI);
    };
    return {
      PZ: bell(EXPLOSION_END,       EXPLOSION_END + 1.0),
      NZ: bell(EXPLOSION_END,       EXPLOSION_END + 1.0),
      PX: bell(EXPLOSION_END + 1.0, EXPLOSION_END + 2.0),
      NX: bell(EXPLOSION_END + 1.0, EXPLOSION_END + 2.0),
      PY: bell(EXPLOSION_END + 2.0, EXPLOSION_END + 3.0),
      NY: bell(EXPLOSION_END + 2.0, EXPLOSION_END + 3.0),
    };
  }, [time]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <group>
      <group ref={cubeGroupRef}>
        <GridLines time={time} />
        {items.map((it, idx) => {
          const { pos, gx, gy, gz } = it;
          const k = (size - 1) / 2;

          const faceReveal = {
            PZ: getFaceReveal('PZ'),
            NZ: getFaceReveal('NZ'),
            PX: getFaceReveal('PX'),
            NX: getFaceReveal('NX'),
            PY: getFaceReveal('PY'),
            NY: getFaceReveal('NY'),
          };

          const cubieFlips = {};
          const antipodalSwaps = {};

          const isCenterPX = (gx === CENTER_X && gy === CENTER_Y && gz === CENTER_Z);

          if (isCenterPX && centerFlipAngle > 0) {
            cubieFlips['PX'] = centerFlipAngle;
          }

          let topoPos = [...pos];
          let topoRot = 0;

          if (antipodalTwist > 0) {
            const antipodal = [-pos[0], -pos[1], -pos[2]];
            const dist = Math.sqrt(pos[0] ** 2 + pos[1] ** 2 + pos[2] ** 2);
            const twistFactor = antipodalTwist * (dist / (k * Math.sqrt(3)));
            topoPos = [
              pos[0] * Math.cos(twistFactor) - antipodal[0] * Math.sin(twistFactor) * 0.3,
              pos[1] * Math.cos(twistFactor) - antipodal[1] * Math.sin(twistFactor) * 0.3,
              pos[2] * Math.cos(twistFactor) - antipodal[2] * Math.sin(twistFactor) * 0.3,
            ];
            topoRot = twistFactor * 2;
          }

          const ef = explosionFactor;
          const explodedPos = [
            topoPos[0] * (1 + ef * 1.8),
            topoPos[1] * (1 + ef * 1.8),
            topoPos[2] * (1 + ef * 1.8),
          ];

          return (
            <group
              key={it.key}
              position={explodedPos}
              rotation={[topoRot, topoRot, topoRot]}
            >
              <IntroCubie
                ref={el => (cubieRefs.current[idx] = el)}
                position={[0, 0, 0]}
                gridPos={[gx, gy, gz]}
                size={size}
                explosionFactor={ef}
                faceStyles={faceStyles}
                cubieFlips={cubieFlips}
                antipodalSwaps={antipodalSwaps}
                faceReveal={faceReveal}
                pulseFaces={pulseFaces}
              />
            </group>
          );
        })}
      </group>

      {/* Antipodal tunnel connections */}
      {time >= TUNNEL_FORM_START && tunnels.map(t => (
        <IntroTunnel
          key={t.id}
          start={t.start}
          end={t.end}
          color1={t.color1}
          color2={t.color2}
          opacity={tunnelOpacity * (highlightedGroup === t.group ? 1.0
                                 : highlightedGroup >= 0        ? 0.22
                                 : 0.75

)}
          groupId={t.group}
          formation={tunnelFormation}
        />
      ))}

      {/* Worms traversing antipodal tunnels */}
      {time >= WORM_START && wormPaths.filter(path => !wormComplete[path.id]).map(path => (
        <WormParticle
          key={path.id}
          start={path.start}
          end={path.end}
          color1={path.color1}
          color2={path.color2}
          startTime={WORM_START}
          currentTime={time}
          onComplete={() => handleWormComplete(path.id)}
        />
      ))}

      {/* Arrival bursts when worms exit */}
      {wormPaths.map(path => {
        const bt = burstTimes[path.id];
        return (showBurst[path.id] && bt && time < bt + 0.5) ? (
          <ArrivalBurst
            key={`burst-${path.id}`}
            position={path.end}
            color={path.color2}
            startTime={bt}
            currentTime={time}
          />
        ) : null;
      })}
    </group>
  );
};

export default IntroScene;
