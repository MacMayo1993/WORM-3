// src/worm/healerWorm/HealerBombs.jsx
// Renders WORM healer-mode bombs and their detonation fire.
//
// Live bombs live in a ref written by the mode's frame loop (bombsRef); this
// component mirrors the set of bomb IDs into state so each bomb mounts/unmounts
// once, then reads bomb.fuse live every frame to pulse a fuse ring and drive a
// floating countdown number that reddens as the fuse runs out. Detonations are
// pushed imperatively through blastApiRef.spawn(flamePoints) and drawn as
// Bomberman-style fire that shoots out along the blast arms — a staggered burst
// of additive flames that flare over each covered tile.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { FACE_NORMALS, DIR_FORWARD } from './constants.js';
import { BOMB_FUSE_SECONDS } from './bombs.js';

const BOMB_LIFT = 0.34; // how far the bomb body floats off the tile surface
const BOMB_RADIUS = 0.42; // +30% over the original 0.32
const _v = new THREE.Vector3();

// ─── Floating countdown number (canvas-texture sprite, always faces camera) ────
function makeCountdownCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  return canvas;
}
function drawCountdown(canvas, sec, urgency) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '900 92px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const color = urgency > 0.66 ? '#ff3b30' : urgency > 0.33 ? '#ffcc33' : '#ffffff';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(String(sec), 64, 70);
  ctx.fillStyle = color;
  ctx.fillText(String(sec), 64, 70);
}

// ─── One live bomb ─────────────────────────────────────────────────────────────
function Bomb({ bomb, size }) {
  const ringRef = useRef();
  const ringMatRef = useRef();
  const sparkRef = useRef();

  const canvas = useMemo(() => makeCountdownCanvas(), []);
  const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas]);
  const lastSecRef = useRef(-1);

  const base = getStickerWorldPos(bomb.tile.x, bomb.tile.y, bomb.tile.z, bomb.tile.dirKey, size);
  const normal = FACE_NORMALS[bomb.tile.dirKey] ?? _v.set(0, 1, 0);
  const pos = [base[0] + normal.x * BOMB_LIFT, base[1] + normal.y * BOMB_LIFT, base[2] + normal.z * BOMB_LIFT];
  // Countdown floats ABOVE the bomb: along the face-local "up" (so it reads as
  // above on screen), lifted a touch off the surface so it never clips the tile.
  const up = DIR_FORWARD[bomb.tile.dirKey]?.up ?? [0, 1, 0];
  const labelPos = [up[0] * 1.0 + normal.x * 0.35, up[1] * 1.0 + normal.y * 0.35, up[2] * 1.0 + normal.z * 0.35];

  useFrame((_, delta) => {
    const maxFuse = bomb.maxFuse ?? BOMB_FUSE_SECONDS;
    const frac = Math.max(0, Math.min(1, (bomb.fuse ?? 0) / maxFuse)); // 1 at spawn → 0 at blast
    const urgency = 1 - frac;
    bomb._blink = (bomb._blink ?? 0) + delta * (2 + urgency * 14);
    const pulse = 0.5 + 0.5 * Math.sin(bomb._blink);
    if (ringRef.current) ringRef.current.scale.setScalar(1 + pulse * (0.15 + urgency * 0.5));
    if (ringMatRef.current) {
      ringMatRef.current.color.setRGB(0.2 + urgency * 0.8, Math.max(0.05, frac * 0.9), 0.1);
      ringMatRef.current.opacity = 0.55 + pulse * 0.35;
    }
    if (sparkRef.current) {
      const flick = 0.6 + 0.4 * Math.sin(bomb._blink * 2.3);
      sparkRef.current.scale.setScalar(0.4 + flick * (0.4 + urgency));
    }
    // Update the countdown only when the whole-second value changes.
    const sec = Math.max(0, Math.ceil(bomb.fuse ?? 0));
    if (sec !== lastSecRef.current) {
      lastSecRef.current = sec;
      drawCountdown(canvas, sec, urgency);
      texture.needsUpdate = true;
    }
  });

  return (
    <group position={pos}>
      {/* bomb body */}
      <mesh>
        <sphereGeometry args={[BOMB_RADIUS, 20, 20]} />
        <meshStandardMaterial color="#14161c" roughness={0.35} metalness={0.6} />
      </mesh>
      {/* fuse ring hugging the tile — the visible countdown pulse */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BOMB_RADIUS + 0.13, 0.08, 10, 28]} />
        <meshBasicMaterial ref={ringMatRef} color="#ffcc33" transparent opacity={0.8} toneMapped={false} />
      </mesh>
      {/* spark on top */}
      <mesh ref={sparkRef} position={[0, BOMB_RADIUS + 0.13, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#fff2a8" toneMapped={false} />
      </mesh>
      {/* floating countdown number */}
      <sprite position={labelPos} scale={[0.75, 0.75, 0.75]}>
        <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

// ─── Detonation fire ─────────────────────────────────────────────────────────
const FLAME_LIFE = 0.75; // seconds each flame burns after it ignites
const _flameOpacity = [0.95, 0.8, 0.55];

// A single flare of additive fire over one blast tile. Ignites after `delay`
// (so the blast reads as shooting outward from the centre), flashes bright, then
// flickers down to nothing.
function Flame({ position, delay }) {
  const groupRef = useRef();
  const ageRef = useRef(0);
  const seed = useMemo(() => Math.random() * 10, []);

  useFrame((_, dt) => {
    ageRef.current += dt;
    const g = groupRef.current;
    if (!g) return;
    const t = ageRef.current - delay;
    if (t < 0) { g.visible = false; return; }
    g.visible = true;
    const life = Math.min(1, t / FLAME_LIFE);
    const grow = t < 0.1 ? t / 0.1 : 1; // fast flash-in
    const flick = 0.85 + 0.25 * Math.sin((t + seed) * 38);
    g.scale.setScalar(Math.max(0.001, grow * (1.2 - life * 0.55) * flick));
    const fade = 1 - life;
    g.children.forEach((c, i) => { if (c.material) c.material.opacity = fade * _flameOpacity[i]; });
  });

  return (
    <group ref={groupRef} position={position} visible={false}>
      <mesh>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshBasicMaterial color="#fff2b0" transparent blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.42, 12, 12]} />
        <meshBasicMaterial color="#ff9026" transparent blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.62, 12, 12]} />
        <meshBasicMaterial color="#ff2e0e" transparent blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function BlastBurst({ points, onDone }) {
  const ageRef = useRef(0);
  const ttl = useMemo(() => Math.max(0, ...points.map((p) => p.delay)) + FLAME_LIFE + 0.15, [points]);
  useFrame((_, dt) => {
    ageRef.current += dt;
    if (ageRef.current >= ttl) onDone();
  });
  return (
    <>
      {points.map((p, i) => <Flame key={i} position={p.pos} delay={p.delay} />)}
    </>
  );
}

/**
 * @param {{ bombsRef: {current: Array}, blastApiRef: {current: any}, size: number }} props
 */
export function HealerBombs({ bombsRef, blastApiRef, size }) {
  const [ids, setIds] = useState([]);
  const lastKeyRef = useRef('');
  const [bursts, setBursts] = useState([]);
  const burstSeq = useRef(0);

  // Register the imperative blast-spawn handle for the mode's frame loop.
  // `flamePoints` is [{ pos:[x,y,z], delay:number }] — the covered blast tiles,
  // ordered so arms ignite outward from the centre.
  useEffect(() => {
    if (!blastApiRef) return undefined;
    blastApiRef.current = {
      spawn: (flamePoints) => {
        const id = burstSeq.current++;
        setBursts((b) => [...b, { id, points: flamePoints.map((p) => ({ pos: [p.pos[0], p.pos[1], p.pos[2]], delay: p.delay ?? 0 })) }]);
      }
    };
    return () => { if (blastApiRef.current) blastApiRef.current = null; };
  }, [blastApiRef]);

  // Detect add/remove of bombs once per change (not per frame).
  useFrame(() => {
    const live = bombsRef.current ?? [];
    const key = live.map((b) => b.id).join(',');
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    setIds(live.map((b) => b.id));
  });

  const live = bombsRef.current ?? [];
  return (
    <>
      {ids.map((id) => {
        const bomb = live.find((b) => b.id === id);
        return bomb ? <Bomb key={id} bomb={bomb} size={size} /> : null;
      })}
      {bursts.map((burst) => (
        <BlastBurst
          key={burst.id}
          points={burst.points}
          onDone={() => setBursts((b) => b.filter((x) => x.id !== burst.id))}
        />
      ))}
    </>
  );
}
