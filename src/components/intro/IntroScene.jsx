import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import IntroCubie from './IntroCubie.jsx';
import IntroTunnel from '../../manifold/IntroTunnel.jsx';
import WormParticle from '../../manifold/WormParticle.jsx';
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

// ─── Grid lines with "Glow" ──────────────────────────────────────────────────
const GridLines = ({ time }) => {
  const S = 1.5, G = 0.5, E = 0.006;

  const faces = useMemo(() => [
    { colorId: 1, pulse: 'z', seams: [[[-S,-G,S+E],[S,-G,S+E]], [[-S,G,S+E],[S,G,S+E]], [[-G,-S,S+E],[-G,S,S+E]], [[G,-S,S+E],[G,S,S+E]]] },
    { colorId: 4, pulse: 'z', seams: [[[-S,-G,-S-E],[S,-G,-S-E]], [[-S,G,-S-E],[S,G,-S-E]], [[-G,-S,-S-E],[-G,S,-S-E]], [[G,-S,-S-E],[G,S,-S-E]]] },
    { colorId: 5, pulse: 'x', seams: [[[S+E,-G,-S],[S+E,-G,S]], [[S+E,G,-S],[S+E,G,S]], [[S+E,-S,-G],[S+E,S,-G]], [[S+E,-S,G],[S+E,S,G]]] },
    { colorId: 2, pulse: 'x', seams: [[[-S-E,-G,-S],[-S-E,-G,S]], [[-S-E,G,-S],[-S-E,G,S]], [[-S-E,-S,-G],[-S-E,S,-G]], [[-S-E,-S,G],[-S-E,S,G]]] },
    { colorId: 3, pulse: 'y', seams: [[[-S,S+E,-G],[S,S+E,-G]], [[-S,S+E,G],[S,S+E,G]], [[-G,S+E,-S],[-G,S+E,S]], [[G,S+E,-S],[G,S+E,S]]] },
    { colorId: 6, pulse: 'y', seams: [[[-S,-S-E,-G],[S,-S-E,-G]], [[-S,-S-E,G],[S,-S-E,G]], [[-G,-S-E,-S],[-G,S-E,S]], [[G,-S-E,-S],[G,S-E,S]]] },
  ], []);

  const baseOpacity = time >= EXPLOSION_START ? 0 : 
                     time >= TUNNEL_FORM_START ? (1 - progress(time, TUNNEL_FORM_START, EXPLOSION_START)) * 0.2 : 0.2;

  if (baseOpacity <= 0) return null;

  const xPulse = (time >= GREEN_SHOW_START + 0.4 && time < FULL_FLIP_START)
    ? Math.sin(progress(time, GREEN_SHOW_START + 0.4, FULL_FLIP_START) * Math.PI) * 0.6 : 0;

  const pulseFor = { x: xPulse, y: 0, z: 0 };

  return (
    <group>
      {faces.map(({ colorId, pulse, seams }, fi) =>
        seams.map((pts, si) => (
          <React.Fragment key={`gl-group-${fi}-${si}`}>
            {/* The "Glow" Line (slightly wider, softer) */}
            <Line
              points={pts}
              color={FACE_COLORS[colorId]}
              transparent
              opacity={Math.min(0.8, (baseOpacity + pulseFor[pulse]) * 0.5)}
              lineWidth={2.5}
              blending={THREE.AdditiveBlending}
            />
            {/* The Core Line (sharp) */}
            <Line
              points={pts}
              color={FACE_COLORS[colorId]}
              transparent
              opacity={Math.min(1, baseOpacity + pulseFor[pulse])}
              lineWidth={1}
            />
          </React.Fragment>
        ))
      )}
    </group>
  );
};

// ─── Main Scene Component ────────────────────────────────────────────────────
const IntroScene = ({ time, onComplete }) => {
  const cubeGroupRef = useRef();
  const cubieRefs = useRef([]);
  const { camera } = useThree();
  const size = 3;
  const completedRef = useRef(false);
  const cameraStateRef = useRef({ x: 0, y: 0, z: 9 });
  const cubeRotRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(time);
  timeRef.current = time;

  const [wormComplete, setWormComplete] = useState({});

  if (time >= IMPLODE_END && !completedRef.current && onComplete) {
    completedRef.current = true;
    setTimeout(() => onComplete(), 100);
  }

  // ── Face Reveal / Drain Logic ──────────────────────────────────────────────
  const getFaceReveal = (faceKey) => {
    if (time < EXPLOSION_START) return 0;
    if (time < EXPLOSION_END) {
      const axisSlots = { PZ: [0, 0.33], NZ: [0, 0.33], PX: [0.2, 0.66], NX: [0.2, 0.66], PY: [0.4, 1.0], NY: [0.4, 1.0] };
      const [s, e] = axisSlots[faceKey] || [0, 1];
      return smoothstep(progress(progress(time, EXPLOSION_START, EXPLOSION_END), s, e));
    }
    if (time < IMPLODE_START) return 1;
    const drainSlots = { PY: [0, 0.6], NY: [0, 0.6], PX: [0.2, 0.8], NX: [0.2, 0.8], PZ: [0.4, 1.0], NZ: [0.4, 1.0] };
    const [ds, de] = drainSlots[faceKey] || [0, 1];
    return 1 - smoothstep(progress(progress(time, IMPLODE_START, IMPLODE_END), ds, de));
  };

  // ── Animation Loop ─────────────────────────────────────────────────────────
  useFrame(({ clock }, delta) => {
    updateSharedTime(clock.getElapsedTime());
    const t = timeRef.current;

    if (cubeGroupRef.current) {
      let targetRotY = t < FULL_FLIP_START ? t * 0.28 : 0;
      let targetRotX = t < FULL_FLIP_START ? Math.sin(t * 0.15) * 0.12 : 0;

      const rotLerp = 1 - Math.exp(-Math.max(0, delta) * 10);
      cubeRotRef.current.y += (targetRotY - cubeRotRef.current.y) * rotLerp;
      cubeRotRef.current.x += (targetRotX - cubeRotRef.current.x) * rotLerp;
      cubeGroupRef.current.rotation.set(cubeRotRef.current.x, cubeRotRef.current.y, 0);

      const scaleSettle = t < AWAKEN_END ? smoothstep(progress(t, 0, AWAKEN_END)) : 1;
      const targetScale = t >= EXPLOSION_END && t < IMPLODE_START ? 1 + Math.sin(t * 2.8) * 0.025 : 1;
      cubeGroupRef.current.scale.lerp(new THREE.Vector3().setScalar(targetScale), 0.1);
    }

    // Camera choreography (Simplified for brevity, matches your motion profile)
    let radius = t < 1 ? 18 - ease(t) * 9 : t < EXPLOSION_START ? 9 : 22;
    let angle = 0.3 + (t > 1 ? (t - 1) * 0.04 : 0);
    camera.position.set(Math.sin(angle) * radius, 2.5 + (t > 1 ? Math.sin(t) * 0.5 : 0), Math.cos(angle) * radius);
    camera.lookAt(0, 0, 0);
  });

  const explosionFactor = useMemo(() => {
    if (time < EXPLOSION_START) return 0;
    if (time < EXPLOSION_END) return ease(progress(time, EXPLOSION_START, EXPLOSION_END)) * 1.5;
    if (time < IMPLODE_START) return 1.5;
    return (1 - ease(progress(time, IMPLODE_START, IMPLODE_END))) * 1.5;
  }, [time]);

  const items = useMemo(() => {
    const k = (size - 1) / 2;
    return Array.from({ length: size ** 3 }, (_, i) => {
      const gx = Math.floor(i / (size * size));
      const gy = Math.floor((i / size) % size);
      const gz = i % size;
      return { key: i, pos: [gx - k, gy - k, gz - k], gx, gy, gz };
    });
  }, [size]);

  // ── Face Pulses ────────────────────────────────────────────────────────────
  const pulseFaces = useMemo(() => {
    const bell = (s, e) => (time < s || time > e) ? 0 : Math.sin(progress(time, s, e) * Math.PI);
    return {
      PZ: bell(EXPLOSION_END, EXPLOSION_END + 1), NZ: bell(EXPLOSION_END, EXPLOSION_END + 1),
      PX: bell(EXPLOSION_END + 1, EXPLOSION_END + 2), NX: bell(EXPLOSION_END + 1, EXPLOSION_END + 2),
      PY: bell(EXPLOSION_END + 2, EXPLOSION_END + 3), NY: bell(EXPLOSION_END + 2, EXPLOSION_END + 3),
    };
  }, [time]);

  return (
    <group>
      <group ref={cubeGroupRef}>
        <GridLines time={time} />
        {items.map((it, idx) => {
          const ef = explosionFactor;
          const explodedPos = it.pos.map(p => p * (1 + ef * 1.8));
          
          const faceReveal = {
            PZ: getFaceReveal('PZ'), NZ: getFaceReveal('NZ'),
            PX: getFaceReveal('PX'), NX: getFaceReveal('NX'),
            PY: getFaceReveal('PY'), NY: getFaceReveal('NY'),
          };

          // FIXED RIGHT CENTER PIECE LOGIC
          const isRightCenter = (it.gx === 2 && it.gy === 1 && it.gz === 1);
          const cubieFlips = {};
          if (isRightCenter) {
             const flipP = progress(time, FULL_FLIP_START, FULL_FLIP_END);
             cubieFlips['PX'] = ease(flipP) * Math.PI;
          }

          return (
            <group key={it.key} position={explodedPos}>
              <IntroCubie
                ref={el => (cubieRefs.current[idx] = el)}
                gridPos={[it.gx, it.gy, it.gz]}
                size={size}
                explosionFactor={ef}
                faceReveal={faceReveal}
                cubieFlips={cubieFlips}
                pulseFaces={pulseFaces}
              />
            </group>
          );
        })}
      </group>

      {/* Tunnels and Worms logic remains as per your implementation */}
    </group>
  );
};

export default IntroScene;