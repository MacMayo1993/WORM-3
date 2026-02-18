import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import IntroCubie from './IntroCubie.jsx';
import IntroTunnel from '../../manifold/IntroTunnel.jsx';
import WormParticle from '../../manifold/WormParticle.jsx';
import ArrivalBurst from '../../manifold/ArrivalBurst.jsx';
import { FACE_COLORS } from '../../utils/constants.js';
import { play, vibrate } from '../../utils/audio.js';
import { updateSharedTime } from '../../3d/TileStyleMaterials.jsx';

// ─── Tile style assignment ─────────────────────────────────────────────────────
const STYLE_SEQUENCE = ['lava', 'circuit', 'holographic', 'galaxy', 'neural', 'pulse'];

// ─── Timing constants ─────────────────────────────────────────────────────────
// Phase 0:  0.0 – 1.5s   Black cube emerges, slow rotation
// Phase 1:  1.5 – 3.2s   Blue face (PX) gently reveals as cube rotates to show it
// Phase 2:  3.2 – 4.8s   Center blue tile (manifold center of PX face) hints at tilt
// Phase 3:  4.8 – 6.5s   Cube rotates to show green face (NX = blue's antipodal pair)
//                         Blue tile is now the center of the green face
// Phase 4:  6.5 – 8.2s   Center tile does full Rummikub flip — reveals antipodal back
// Phase 5:  8.2 – 8.7s   Brief pause, then explosion begins
// Phase 6:  8.7 – 10.5s  Explosion → antipodal showcase
// Phase 7: 10.5 – 12.0s  Tunnel highlights
// Phase 8: 12.0 – 13.5s  Worm traversal
// Phase 9: 13.5 – 15.0s  Implode

const BLUE_REVEAL_START   = 1.5;
const BLUE_REVEAL_END     = 3.2;
const HINT_TILT_START     = 3.2;
const HINT_TILT_END       = 4.8;
const GREEN_SHOW_START    = 4.8;
const GREEN_SHOW_END      = 6.5;
const FULL_FLIP_START     = 6.5;
const FULL_FLIP_END       = 8.2;
const TUNNEL_FORM_START   = 8.5;
const EXPLOSION_START     = 8.7;
const EXPLOSION_END       = 10.5;
const WORM_START          = 11.0;
const IMPLODE_START       = 12.5;
const IMPLODE_END         = 14.5;

// Antipodal pairs
const ANTIPODAL_PAIRS = {
  PZ: 'NZ', NZ: 'PZ',
  PX: 'NX', NX: 'PX',
  PY: 'NY', NY: 'PY',
};

// Face color indices (matching FACE_COLORS)
// PZ=1(red), NZ=4(orange), PX=5(blue), NX=2(green), PY=3(white), NY=6(yellow)
const FACE_COLOR_IDX = { PZ: 1, NZ: 4, PX: 5, NX: 2, PY: 3, NY: 6 };

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ease = t => t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = t => Math.max(0, Math.min(1, t));
const progress = (t, start, end) => clamp01((t - start) / (end - start));

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

// ─── Component ───────────────────────────────────────────────────────────────
const IntroScene = ({ time, onComplete }) => {
  const cubeGroupRef = useRef();
  const cubieRefs    = useRef([]);
  const { camera }   = useThree();
  const size = 3;
  const completedRef = useRef(false);

  if (time >= IMPLODE_END && !completedRef.current && onComplete) {
    completedRef.current = true;
    setTimeout(() => onComplete(), 100);
  }

  const [wormComplete, setWormComplete] = useState({});
  const [showBurst,    setShowBurst]    = useState({});
  const [burstTimes,   setBurstTimes]   = useState({});

  // ── Face reveal intensities ─────────────────────────────────────────────────
  // PX (blue) reveals between BLUE_REVEAL_START and BLUE_REVEAL_END
  // NX (green) reveals between GREEN_SHOW_START and GREEN_SHOW_END
  // All other faces stay black until explosion (then snap fully on)
  const getFaceReveal = (faceKey) => {
    if (time >= EXPLOSION_START) return 1.0; // explosion = all faces lit

    if (faceKey === 'PX') {
      // Blue face reveals smoothly
      return ease(progress(time, BLUE_REVEAL_START, BLUE_REVEAL_END));
    }
    if (faceKey === 'NX') {
      // Green face reveals smoothly
      return ease(progress(time, GREEN_SHOW_START, GREEN_SHOW_END));
    }
    return 0; // all other faces: black
  };

  // ── Center tile Rummikub flip ───────────────────────────────────────────────
  // The center cubie of PX face is at x=2, y=1, z=1 (size=3, so x=size-1=2 is PX face)
  // During hint phase: tilt forward 25° then back
  // During full flip: rotate all the way to PI (show back = green/NX color)
  const getCenterTileFlip = () => {
    const hintP = progress(time, HINT_TILT_START, HINT_TILT_END);
    if (hintP > 0 && hintP < 1) {
      // Gentle hint: sine wave, peaks at 30°
      return Math.sin(hintP * Math.PI) * (Math.PI / 6);
    }
    const flipP = progress(time, FULL_FLIP_START, FULL_FLIP_END);
    if (flipP > 0) {
      // Full Rummikub flip: 0 → PI with easing, then hold
      return ease(clamp01(flipP)) * Math.PI;
    }
    return 0;
  };

  // ── Dynamic faceStyles ──────────────────────────────────────────────────────
  const faceStyles = useMemo(() => {
    if (time < EXPLOSION_START) {
      // During reveal phases, use one specific style per face
      return {
        PX: 'holographic', // blue face
        NX: 'circuit',     // green face
        PZ: 'lava', NZ: 'galaxy', PY: 'neural', NY: 'pulse',
      };
    }
    // Post-explosion: cycle styles
    const cycleSpeed = 0.3;
    const cycleIndex = Math.floor(time * cycleSpeed) % STYLE_SEQUENCE.length;
    return {
      PZ: STYLE_SEQUENCE[(cycleIndex + 0) % STYLE_SEQUENCE.length],
      NX: STYLE_SEQUENCE[(cycleIndex + 1) % STYLE_SEQUENCE.length],
      PY: STYLE_SEQUENCE[(cycleIndex + 2) % STYLE_SEQUENCE.length],
      NZ: STYLE_SEQUENCE[(cycleIndex + 3) % STYLE_SEQUENCE.length],
      PX: STYLE_SEQUENCE[(cycleIndex + 4) % STYLE_SEQUENCE.length],
      NY: STYLE_SEQUENCE[(cycleIndex + 5) % STYLE_SEQUENCE.length],
    };
  }, [time]);

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

  // ── Camera choreography ─────────────────────────────────────────────────────
  useFrame(({ clock }) => {
    updateSharedTime(clock.getElapsedTime());

    // The cube group slowly auto-rotates on Y axis for the reveal phases
    // Then freezes during the flip, then explosion takes over
    if (cubeGroupRef.current) {
      if (time < FULL_FLIP_START) {
        // Slow auto-rotation — chosen so:
        //   t=0:        face NZ toward camera (black start)
        //   t≈1.5:      PX (blue) rotates into view
        //   t≈4.8:      NX (green) comes into view
        // Speed ≈ 0.28 rad/s → at t=1.5, rotY≈0.42 rad (≈24°, PX visible)
        //                    → at t=4.8, rotY≈1.34 rad (≈77°, NX visible)
        const baseRot = time * 0.28;
        cubeGroupRef.current.rotation.y = baseRot;
        cubeGroupRef.current.rotation.x = Math.sin(time * 0.15) * 0.12;
      } else if (time < EXPLOSION_START) {
        // Hold orientation during the full flip, just gentle wobble
        cubeGroupRef.current.rotation.y = FULL_FLIP_START * 0.28 + Math.sin((time - FULL_FLIP_START) * 0.5) * 0.05;
        cubeGroupRef.current.rotation.x = Math.sin(time * 0.15) * 0.08;
      } else {
        // During explosion/implode, stop group rotation — individual cubies handle it
        cubeGroupRef.current.rotation.set(0, 0, 0);
      }
    }

    // Camera: close and slightly elevated, orbiting slowly
    let radius = 9;
    let camY   = 2.5;
    let angle  = 0;

    if (time < 1.0) {
      // Swoop in from far
      const t = ease(time / 1.0);
      radius = 18 - t * 9;
      camY   = 6  - t * 3.5;
      angle  = 0.3;
    } else if (time < EXPLOSION_START) {
      // Steady close orbit — camera stays near the blue/green faces
      radius = 9;
      camY   = 2.5 + Math.sin((time - 1.0) * 0.6) * 0.8;
      angle  = 0.3 + (time - 1.0) * 0.04; // slow pan
    } else if (time < EXPLOSION_START + 1.5) {
      // Pull back for explosion
      const t = ease((time - EXPLOSION_START) / 1.5);
      radius = 9 + t * 13;
      camY   = 2.5 + t * 4.5;
      angle  = 0.3 + (time - 1.0) * 0.04;
    } else if (time < IMPLODE_START) {
      radius = 22;
      camY   = 7;
      angle  = 0.3 + (time - 1.0) * 0.08;
    } else {
      const t = ease((time - IMPLODE_START) / (IMPLODE_END - IMPLODE_START));
      radius = 22 - t * 10;
      camY   = 7  - t * 3;
      angle  = 0.3 + (time - 1.0) * 0.08;
    }

    camera.position.x  = Math.sin(angle) * radius;
    camera.position.z  = Math.cos(angle) * radius;
    camera.position.y  = camY;
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

  // Center cubie of PX face (right face): gx=2, gy=1, gz=1 in a 3×3
  const CENTER_X = size - 1;  // 2
  const CENTER_Y = 1;
  const CENTER_Z = 1;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <group>
      <group ref={cubeGroupRef}>
        {items.map((it, idx) => {
          const { pos, gx, gy, gz } = it;
          const k = (size - 1) / 2;

          // Per-face reveal for this cubie
          const faceReveal = {
            PZ: getFaceReveal('PZ'),
            NZ: getFaceReveal('NZ'),
            PX: getFaceReveal('PX'),
            NX: getFaceReveal('NX'),
            PY: getFaceReveal('PY'),
            NY: getFaceReveal('NY'),
          };

          // Rummikub center tile flip — only applies to the PX face center sticker
          // and the corresponding NX face center sticker (they are antipodal)
          const cubieFlips = {};
          const antipodalSwaps = {};

          const isCenterPX = (gx === CENTER_X && gy === CENTER_Y && gz === CENTER_Z);
          const isCenterNX = (gx === 0 && gy === CENTER_Y && gz === CENTER_Z);

          if (isCenterPX && centerFlipAngle > 0) {
            // The PX face sticker flips
            cubieFlips['PX'] = centerFlipAngle;
            // After 90°, it's "edge-on" — after 180°, show antipodal (green)
            antipodalSwaps['PX'] = centerFlipAngle > Math.PI * 0.5;
          }

          // Explosion topology twist
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
                size={size}
                explosionFactor={ef}
                faceStyles={faceStyles}
                cubieFlips={cubieFlips}
                antipodalSwaps={antipodalSwaps}
                faceReveal={faceReveal}
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
                                 : 0.75)}
          groupId={t.group}
          formation={tunnelFormation}
        />
      ))}

      {/* Worms traversing antipodal tunnels */}
      {time >= WORM_START && wormPaths.map(path => (
        !wormComplete[path.id] && (
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
        )
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
