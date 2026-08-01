// src/worm/healerWorm/HealerBombs.jsx
// Renders WORM healer-mode bombs and their detonation flash.
//
// Live bombs live in a ref written by the mode's frame loop (bombsRef); this
// component mirrors the set of bomb IDs into state so each bomb mounts/unmounts
// once, then reads bomb.fuse live every frame to pulse a fuse ring that reddens
// and quickens as the countdown runs out. Detonations are pushed imperatively
// through blastApiRef.spawn(worldPoints, color) and drawn as a short expanding,
// fading burst along the blast arms.
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { FACE_NORMALS } from './constants.js';
import { BOMB_FUSE_SECONDS } from './bombs.js';

const BOMB_LIFT = 0.28; // how far the bomb body floats off the tile surface
const _v = new THREE.Vector3();

// ─── One live bomb ─────────────────────────────────────────────────────────────
function Bomb({ bomb, size }) {
  const ringRef = useRef();
  const ringMatRef = useRef();
  const sparkRef = useRef();

  const base = getStickerWorldPos(bomb.tile.x, bomb.tile.y, bomb.tile.z, bomb.tile.dirKey, size);
  const normal = FACE_NORMALS[bomb.tile.dirKey] ?? _v.set(0, 1, 0);
  const pos = [base[0] + normal.x * BOMB_LIFT, base[1] + normal.y * BOMB_LIFT, base[2] + normal.z * BOMB_LIFT];

  useFrame((_, delta) => {
    const maxFuse = bomb.maxFuse ?? BOMB_FUSE_SECONDS;
    const frac = Math.max(0, Math.min(1, (bomb.fuse ?? 0) / maxFuse)); // 1 at spawn → 0 at blast
    // Pulse faster and redder as the fuse burns down.
    const urgency = 1 - frac;
    bomb._blink = (bomb._blink ?? 0) + delta * (2 + urgency * 14);
    const pulse = 0.5 + 0.5 * Math.sin(bomb._blink);
    if (ringRef.current) {
      const s = 1 + pulse * (0.15 + urgency * 0.5);
      ringRef.current.scale.setScalar(s);
    }
    if (ringMatRef.current) {
      // green-ish → yellow → red as it counts down
      ringMatRef.current.color.setRGB(0.2 + urgency * 0.8, Math.max(0.05, frac * 0.9), 0.1);
      ringMatRef.current.opacity = 0.55 + pulse * 0.35;
    }
    if (sparkRef.current) {
      const flick = 0.6 + 0.4 * Math.sin(bomb._blink * 2.3);
      sparkRef.current.scale.setScalar(0.4 + flick * (0.4 + urgency));
    }
  });

  return (
    <group position={pos}>
      {/* bomb body */}
      <mesh>
        <sphereGeometry args={[0.32, 20, 20]} />
        <meshStandardMaterial color="#14161c" roughness={0.35} metalness={0.6} />
      </mesh>
      {/* fuse ring hugging the tile — the visible countdown */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} quaternion={undefined}>
        <torusGeometry args={[0.42, 0.06, 10, 28]} />
        <meshBasicMaterial ref={ringMatRef} color="#ffcc33" transparent opacity={0.8} toneMapped={false} />
      </mesh>
      {/* spark on top */}
      <mesh ref={sparkRef} position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshBasicMaterial color="#fff2a8" toneMapped={false} />
      </mesh>
    </group>
  );
}

// ─── Detonation bursts ─────────────────────────────────────────────────────────
const BLAST_TTL = 0.5;

function BlastBurst({ points, color, onDone }) {
  const groupRef = useRef();
  const ageRef = useRef(0);
  useFrame((_, delta) => {
    ageRef.current += delta;
    const t = Math.min(1, ageRef.current / BLAST_TTL);
    if (groupRef.current) {
      const s = 0.5 + t * 1.3; // expand outward
      groupRef.current.scale.setScalar(s);
      groupRef.current.children.forEach((child) => {
        if (child.material) child.material.opacity = (1 - t) * 0.9;
      });
    }
    if (ageRef.current >= BLAST_TTL) onDone();
  });
  return (
    <group ref={groupRef}>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.3, 10, 10]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * @param {{ bombsRef: {current: Array}, blastApiRef: {current: any}, size: number }} props
 */
export function HealerBombs({ bombsRef, blastApiRef, size }) {
  // Mirror the live bomb ID set into state so bombs mount/unmount exactly once.
  const [ids, setIds] = useState([]);
  const lastKeyRef = useRef('');
  const [bursts, setBursts] = useState([]);
  const burstSeq = useRef(0);

  // Register the imperative blast-spawn handle for the mode's frame loop.
  useEffect(() => {
    if (!blastApiRef) return undefined;
    blastApiRef.current = {
      spawn: (worldPoints, color) => {
        const id = burstSeq.current++;
        setBursts((b) => [...b, { id, points: worldPoints.map((p) => [p[0], p[1], p[2]]), color: color ?? '#ff7b2e' }]);
      }
    };
    return () => {
      if (blastApiRef.current) blastApiRef.current = null;
    };
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
          color={burst.color}
          onDone={() => setBursts((b) => b.filter((x) => x.id !== burst.id))}
        />
      ))}
    </>
  );
}
