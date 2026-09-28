// src/worm/healerWorm/HealerBombs.jsx
// Renders WORM healer-mode bombs, disarm crumbles and detonation fire.
//
// Live bombs live in a ref written by the mode's frame loop (bombsRef); this
// component mirrors the set of bomb IDs into state so each bomb mounts/unmounts
// once, then reads bomb.fuse live every frame to animate the burning fuse, the
// pulsing danger ring, and a floating countdown number that reddens as the fuse
// runs out. Detonations are pushed imperatively through blastApiRef.spawn() and
// drawn as flame-shaped, flickering, rising fire that shoots out along the blast
// arms — a plus of flames that flare over every covered tile.
// Successful disarms instead leave a harmless shell that uses the opening cube's
// dissolve shader and drifting flecks, with all danger indicators extinguished.
//
// Performance: every mesh reuses a module-level shared geometry (the same
// pattern as orbSystems/ParityOrb) so a spawn never allocates or GPU-uploads new
// geometry mid-crawl, and a hidden <WarmUp> compiles all the bomb/flame/sprite
// shader programs (sprites are used nowhere else, so they'd otherwise compile the
// first time a bomb appears — a visible hitch) during the frozen scramble phase.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getWormStickerWorldPos as getStickerWorldPos } from '../wormExpansion.js';
import { FACE_NORMALS, DIR_FORWARD } from './constants.js';
import { BOMB_FUSE_SECONDS } from './bombs.js';
import { addFrameDissolve } from '../../components/intro/introDissolve.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import {
  BOMB_RADIUS, BOMB_DISSOLVE_HOLD, BOMB_FLECKS, BOMB_FIELD_SCALE,
  BOMB_FIELD_MID, bombDissolveProgress, bombFleck,
} from './bombDissolve.js';

const BOMB_LIFT = 0.34; // how far the bomb body floats off the tile surface
const _UP = new THREE.Vector3(0, 1, 0);
const DISSOLVE_FIELD = new THREE.Matrix4().makeScale(BOMB_FIELD_SCALE, BOMB_FIELD_SCALE, BOMB_FIELD_SCALE)
  .setPosition(0, -BOMB_FIELD_SCALE * BOMB_FIELD_MID, 0);

// ─── Shared flame texture (teardrop: white-hot base → orange → transparent tip) ─
function makeFlameTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.moveTo(32, 126);
  ctx.bezierCurveTo(2, 92, 14, 30, 32, 4); // left edge up to the tip
  ctx.bezierCurveTo(50, 30, 62, 92, 32, 126); // right edge back down
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,240,170,1)');
  g.addColorStop(0.5, 'rgba(255,150,40,0.95)');
  g.addColorStop(0.8, 'rgba(255,60,20,0.55)');
  g.addColorStop(1.0, 'rgba(120,0,0,0)');
  ctx.fillStyle = g;
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 2;
  return tex;
}
// Exported so the FIRE element's cube skin burns with the same flame the bombs do
// (see ElementalFireSkin) rather than carrying a second, differently-shaped one.
export const FLAME_TEX = makeFlameTexture();

// ─── Shared geometries (created once, reused by every bomb + flame) ─────────────
const GEO = {
  body: new THREE.SphereGeometry(BOMB_RADIUS, 24, 24),
  highlight: new THREE.SphereGeometry(BOMB_RADIUS * 0.22, 12, 12),
  ring: new THREE.TorusGeometry(BOMB_RADIUS + 0.24, 0.05, 10, 40),
  disc: new THREE.CircleGeometry(BOMB_RADIUS + 0.5, 28),
  fuse: new THREE.CylinderGeometry(0.03, 0.045, 0.32, 8),
  spark: new THREE.SphereGeometry(0.09, 10, 10),
  ember: new THREE.SphereGeometry(0.05, 6, 6),
  flameCore: new THREE.SphereGeometry(0.3, 14, 14),
  fleck: new THREE.PlaneGeometry(1, 0.62)
};
// Static (non-animated) shared materials — safe to reuse; R3F never disposes
// objects passed by prop (only ones it creates from JSX intrinsics).
const MAT = {
  body: new THREE.MeshStandardMaterial({ color: '#0f1116', roughness: 0.25, metalness: 0.75 }),
  highlight: new THREE.MeshBasicMaterial({ color: '#8a93a8', transparent: true, opacity: 0.5, toneMapped: false }),
  fuse: new THREE.MeshStandardMaterial({ color: '#6b5330', roughness: 0.9 }),
  spark: new THREE.MeshBasicMaterial({ color: '#fff0a0', toneMapped: false }),
  fleck: new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.5 })
};
// Retain the warmed programs after WarmUp unmounts. Disarmed bombs clone their
// own uniforms/materials but use these same program keys; disposing a remnant
// must not evict the shader and force the next disarm to compile it again.
const WARM_DISSOLVE_UNIFORMS = { uDissolve: { value: 0 }, uDissolveFrame: { value: new THREE.Matrix4() } };
const WARM_DISSOLVE_MATERIALS = Object.fromEntries(['body', 'highlight', 'fuse']
  .map(key => [key, addFrameDissolve(MAT[key].clone(), WARM_DISSOLVE_UNIFORMS)]));

function bombPosition(bomb, size) {
  const { x, y, z, dirKey } = bomb.tile;
  const base = getStickerWorldPos(x, y, z, dirKey, size);
  const normal = FACE_NORMALS[dirKey] ?? _UP;
  return [base[0] + normal.x * BOMB_LIFT, base[1] + normal.y * BOMB_LIFT, base[2] + normal.z * BOMB_LIFT];
}

// Both states draw exactly the same shell and fuse. Only the disarmed copy owns
// patched materials: changing its uniforms must never dissolve a nearby live bomb.
function BombShell({ materials = MAT, quatUp }) {
  return <>
    <mesh geometry={GEO.body} material={materials.body} />
    <mesh geometry={GEO.highlight} material={materials.highlight} position={[-BOMB_RADIUS * 0.35, BOMB_RADIUS * 0.5, BOMB_RADIUS * 0.55]} />
    <group quaternion={quatUp}>
      <mesh geometry={GEO.fuse} material={materials.fuse} position={[0, BOMB_RADIUS + 0.14, 0]} rotation={[0, 0, 0.25]} />
    </group>
  </>;
}

// A visual-only remnant. The simulation has already removed this bomb, awarded
// its reward and stopped its fuse. The front crosses in 1.1s, then the last flecks
// settle out. Like the blast effect, completion can finish behind a success card.
function DisarmedBomb({ bomb, size, hidden, onDone, warmup = false }) {
  const root = useRef(), frame = useRef(), shell = useRef(), flecks = useRef();
  const age = useRef(0), done = useRef(false);
  const uniforms = useMemo(() => ({ uDissolve: { value: 0 }, uDissolveFrame: { value: new THREE.Matrix4() } }), []);
  const materials = useMemo(() => warmup ? WARM_DISSOLVE_MATERIALS : Object.fromEntries(['body', 'highlight', 'fuse']
    .map(key => [key, addFrameDissolve(MAT[key].clone(), uniforms)])), [uniforms, warmup]);
  useEffect(() => () => {
    if (!warmup) Object.values(materials).forEach(material => material.dispose());
  }, [materials, warmup]);
  const scratch = useMemo(() => ({ dummy: new THREE.Object3D(), color: new THREE.Color() }), []);
  const fleckColors = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(BOMB_FLECKS * 3).fill(1), 3), []);
  const quatUp = useMemo(() => new THREE.Quaternion().setFromUnitVectors(_UP,
    new THREE.Vector3(...(DIR_FORWARD[bomb.tile.dirKey]?.up ?? [0, 1, 0])).normalize()), [bomb.tile.dirKey]);

  useFrame((_, delta) => {
    if (warmup || hidden || done.current) return;
    age.current += Math.min(delta, 0.1);
    const progress = bombDissolveProgress(age.current);
    shell.current.visible = progress < 1;
    uniforms.uDissolve.value = progress;
    root.current.updateWorldMatrix(true, true);
    uniforms.uDissolveFrame.value.copy(frame.current.matrixWorld).invert().premultiply(DISSOLVE_FIELD);
    const reduced = prefersReducedMotion() || useGameStore.getState().settings?.reducedMotion;
    let flying = 0;
    for (let i = 0; i < BOMB_FLECKS; i++) {
      const fleck = bombFleck(i, age.current, bomb.id, reduced);
      if (fleck) {
        flying++;
        scratch.dummy.position.fromArray(fleck.position);
        scratch.dummy.rotation.set(...fleck.spin);
        scratch.dummy.scale.setScalar(fleck.scale);
        flecks.current.setColorAt(i, scratch.color.set(fleck.color));
      } else scratch.dummy.scale.setScalar(0);
      scratch.dummy.updateMatrix();
      flecks.current.setMatrixAt(i, scratch.dummy.matrix);
    }
    flecks.current.visible = flying > 0;
    flecks.current.instanceMatrix.needsUpdate = true;
    if (flecks.current.instanceColor) flecks.current.instanceColor.needsUpdate = true;
    if (age.current >= BOMB_DISSOLVE_HOLD) { done.current = true; onDone(); }
  });

  return <group ref={root} position={bombPosition(bomb, size)}>
    <group ref={shell}><BombShell materials={materials} quatUp={quatUp} /></group>
    <group ref={frame} quaternion={quatUp}>
      <instancedMesh ref={flecks} args={[GEO.fleck, MAT.fleck, BOMB_FLECKS]} instanceColor={fleckColors} visible={warmup} frustumCulled={false} />
    </group>
  </group>;
}

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
  ctx.shadowColor = urgency > 0.5 ? 'rgba(255,60,20,0.9)' : 'rgba(255,200,80,0.7)';
  ctx.shadowBlur = 18;
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(String(sec), 64, 70);
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.fillText(String(sec), 64, 70);
}

// ─── One live bomb ─────────────────────────────────────────────────────────────
function Bomb({ bomb, size }) {
  const ringRef = useRef();
  const ringMatRef = useRef();
  const glowMatRef = useRef();
  const fuseSparkRef = useRef();
  const fuseFlameRef = useRef();
  const emberRefs = useRef([]);

  const canvas = useMemo(() => makeCountdownCanvas(), []);
  const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  const lastSecRef = useRef(-1);

  const dirKey = bomb.tile.dirKey;
  const normal = FACE_NORMALS[dirKey] ?? _UP;
  const pos = bombPosition(bomb, size);
  const up = DIR_FORWARD[dirKey]?.up ?? [0, 1, 0];
  // Two orientations: the danger ring lies FLAT on the tile (aligned to the face
  // normal); the fuse + embers stand UP along the face's "up" (so they read as
  // sticking up on screen, not poking out toward the camera).
  const quatFlat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(_UP, (FACE_NORMALS[dirKey] ?? _UP).clone().normalize()), [dirKey]);
  const quatUp = useMemo(() => {
    const u = DIR_FORWARD[dirKey]?.up ?? [0, 1, 0];
    return new THREE.Quaternion().setFromUnitVectors(_UP, new THREE.Vector3(u[0], u[1], u[2]).normalize());
  }, [dirKey]);
  const labelPos = [up[0] * 1.15 + normal.x * 0.35, up[1] * 1.15 + normal.y * 0.35, up[2] * 1.15 + normal.z * 0.35];
  const fuseTipY = BOMB_RADIUS + 0.34;

  useFrame((_, delta) => {
    const maxFuse = bomb.maxFuse ?? BOMB_FUSE_SECONDS;
    const frac = Math.max(0, Math.min(1, (bomb.fuse ?? 0) / maxFuse)); // 1 at spawn → 0 at blast
    const urgency = 1 - frac;
    bomb._blink = (bomb._blink ?? 0) + delta * (2 + urgency * 14);
    const pulse = 0.5 + 0.5 * Math.sin(bomb._blink);

    if (ringRef.current) ringRef.current.scale.setScalar(1 + pulse * (0.08 + urgency * 0.3));
    if (ringMatRef.current) {
      ringMatRef.current.color.setRGB(0.35 + urgency * 0.65, Math.max(0.06, frac * 0.7), 0.12);
      ringMatRef.current.opacity = 0.5 + pulse * 0.4;
    }
    if (glowMatRef.current) glowMatRef.current.opacity = 0.1 + urgency * 0.28 * (0.6 + 0.4 * pulse);

    const flick = 0.7 + 0.5 * Math.sin(bomb._blink * 2.7);
    if (fuseSparkRef.current) fuseSparkRef.current.scale.setScalar(0.5 + flick * (0.5 + urgency * 0.6));
    if (fuseFlameRef.current) {
      fuseFlameRef.current.scale.set(0.18 + 0.05 * flick, 0.3 + 0.14 * flick, 1);
      fuseFlameRef.current.material.opacity = 0.8;
    }
    emberRefs.current.forEach((e, i) => {
      if (!e) return;
      const t = (bomb._blink * (0.5 + i * 0.13) + i * 1.7) % 3;
      const k = t / 3;
      e.position.set((i - 1) * 0.05 * flick, fuseTipY + k * 0.5, 0);
      e.scale.setScalar((1 - k) * 0.06);
      e.material.opacity = (1 - k) * 0.9;
    });

    const sec = Math.max(0, Math.ceil(bomb.fuse ?? 0));
    if (sec !== lastSecRef.current) {
      lastSecRef.current = sec;
      drawCountdown(canvas, sec, urgency);
      texture.needsUpdate = true;
    }
  });

  return (
    <group position={pos}>
      <BombShell quatUp={quatUp} />

      {/* flat furniture on the tile: danger ring + underglow (aligned to normal) */}
      <group quaternion={quatFlat}>
        <mesh ref={ringRef} geometry={GEO.ring} position={[0, -BOMB_LIFT + 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <meshBasicMaterial ref={ringMatRef} color="#ff8a1e" transparent opacity={0.8} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh geometry={GEO.disc} position={[0, -BOMB_LIFT + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial ref={glowMatRef} color="#ff5a1e" transparent opacity={0.2} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
        </mesh>
      </group>

      {/* upright furniture: fuse + spark + flame + embers (aligned to face "up") */}
      <group quaternion={quatUp}>
        <mesh ref={fuseSparkRef} geometry={GEO.spark} material={MAT.spark} position={[0.06, fuseTipY, 0]} />
        <sprite ref={fuseFlameRef} position={[0.06, fuseTipY + 0.12, 0]} scale={[0.2, 0.32, 1]}>
          <spriteMaterial map={FLAME_TEX} transparent opacity={0.85} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
        </sprite>
        {[0, 1, 2].map((i) => (
          <mesh key={i} ref={(el) => { emberRefs.current[i] = el; }} geometry={GEO.ember} position={[0, fuseTipY, 0]}>
            <meshBasicMaterial color="#ffb347" transparent opacity={0.9} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
          </mesh>
        ))}
      </group>

      {/* floating countdown number */}
      <sprite position={labelPos} scale={[0.8, 0.8, 0.8]}>
        <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

// ─── Detonation fire ─────────────────────────────────────────────────────────
const FLAME_LIFE = 0.85; // seconds each flame cluster burns after it ignites
const TONGUES = 4;

// A cluster of flame tongues + a hot core over one blast tile. Ignites after
// `delay` (so the blast reads as shooting outward from the centre), flashes
// bright, licks upward off the surface, then flickers down to nothing.
function FlameCluster({ position, up, delay }) {
  const groupRef = useRef();
  const ageRef = useRef(0);
  const upV = useMemo(() => new THREE.Vector3(up[0], up[1], up[2]).normalize(), [up]);
  const tongues = useMemo(
    () => Array.from({ length: TONGUES }, () => ({
      ph: Math.random() * 6.28,
      sp: 0.8 + Math.random() * 0.8,
      jx: (Math.random() - 0.5) * 0.4,
      jz: (Math.random() - 0.5) * 0.4,
      w: 0.42 + Math.random() * 0.25,
      h: 0.7 + Math.random() * 0.5
    })),
    []
  );

  useFrame((_, dt) => {
    ageRef.current += dt;
    const g = groupRef.current;
    if (!g) return;
    const t = ageRef.current - delay;
    if (t < 0) { g.visible = false; return; }
    g.visible = true;
    const life = Math.min(1, t / FLAME_LIFE);
    const fade = 1 - life;
    const grow = t < 0.08 ? t / 0.08 : 1;
    g.position.set(
      position[0] + upV.x * life * 0.5,
      position[1] + upV.y * life * 0.5,
      position[2] + upV.z * life * 0.5
    );
    let si = 0;
    g.children.forEach((child) => {
      if (child.isSprite) {
        const s = tongues[si++];
        const flick = 0.7 + 0.55 * Math.sin((t + s.ph) * 20 * s.sp);
        child.scale.set(s.w * grow * (0.85 + 0.25 * flick), s.h * grow * (1.25 - life * 0.5) * (0.8 + 0.4 * flick), 1);
        child.material.opacity = fade * 0.92;
      } else if (child.material) {
        child.scale.setScalar(grow * (1.25 - life * 0.7) * (0.9 + 0.15 * Math.sin(t * 34)));
        child.material.opacity = fade * 0.95;
      }
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {/* hot white-orange core */}
      <mesh geometry={GEO.flameCore}>
        <meshBasicMaterial color="#ffdf9a" transparent blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* flame tongues */}
      {tongues.map((s, i) => (
        <sprite key={i} position={[s.jx, 0.28, s.jz]} scale={[s.w, s.h, 1]}>
          <spriteMaterial map={FLAME_TEX} transparent opacity={0.9} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
        </sprite>
      ))}
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
      {points.map((p, i) => <FlameCluster key={i} position={p.pos} up={p.up} delay={p.delay} />)}
    </>
  );
}

// Hidden, tiny group rendered for the first ~1.2s so the GPU compiles every
// bomb/flame shader program and uploads the flame texture during the frozen
// scramble phase — not the first time a bomb pops up next to the crawling worm.
function WarmUp() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1200);
    return () => clearTimeout(t);
  }, []);
  if (done) return null;
  return (
    <group position={[0, 0, 0]} scale={0.02} frustumCulled={false}>
      <mesh geometry={GEO.body} material={MAT.body} />
      <DisarmedBomb bomb={{ id: 0, tile: { x: 1, y: 1, z: 2, dirKey: 'PZ' } }} size={3} warmup />
      <mesh geometry={GEO.flameCore}>
        <meshBasicMaterial color="#ffdf9a" transparent blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh geometry={GEO.ring}>
        <meshBasicMaterial color="#ff8a1e" transparent opacity={0.01} toneMapped={false} depthWrite={false} />
      </mesh>
      <sprite scale={[0.5, 0.5, 1]}>
        <spriteMaterial map={FLAME_TEX} transparent opacity={0.01} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
      </sprite>
      <sprite scale={[0.5, 0.5, 1]}>
        <spriteMaterial map={FLAME_TEX} transparent opacity={0.01} depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

/**
 * @param {{ bombsRef: {current: Array}, membershipRef: {current: number},
 *          blastApiRef: {current: any}, size: number }} props
 */
export function HealerBombs({ bombsRef, membershipRef, blastApiRef, size, hidden = false }) {
  const [ids, setIds] = useState([]);
  const lastMembershipRef = useRef(-1);
  const [bursts, setBursts] = useState([]);
  const [disarmed, setDisarmed] = useState([]);
  const burstSeq = useRef(0);

  // Register the imperative blast-spawn handle for the mode's frame loop.
  // `flamePoints` is [{ pos:[x,y,z], up:[x,y,z], delay:number }] — the covered
  // blast tiles, ordered so arms ignite outward from the centre.
  useEffect(() => {
    if (!blastApiRef) return undefined;
    blastApiRef.current = {
      disarm: (bomb) => {
        // Snapshot the tile before the live hazard list compacts. A small bounded
        // tail prevents rapid practice retries from accumulating visual remnants.
        setDisarmed(list => [...list.filter(b => b.id !== bomb.id), { ...bomb, tile: { ...bomb.tile } }].slice(-6));
      },
      clear: () => { setDisarmed([]); setBursts([]); },
      spawn: (flamePoints) => {
        const id = burstSeq.current++;
        setBursts((b) => [...b, {
          id,
          points: flamePoints.map((p) => ({
            pos: [p.pos[0], p.pos[1], p.pos[2]],
            up: p.up ? [p.up[0], p.up[1], p.up[2]] : [0, 1, 0],
            delay: p.delay ?? 0
          }))
        }]);
      }
    };
    return () => { if (blastApiRef.current) blastApiRef.current = null; };
  }, [blastApiRef]);

  // Detect add/remove of bombs once per change (not per frame). The mode's frame
  // loop bumps a counter whenever the live set actually gains or loses a bomb, so
  // the steady state — which is nearly every frame of a run — is one integer
  // compare. This used to map the ids into an array and join them into a string
  // on every single frame just to find out that nothing had changed.
  useFrame(() => {
    const membership = membershipRef?.current ?? 0;
    if (membership === lastMembershipRef.current) return;
    lastMembershipRef.current = membership;
    setIds((bombsRef.current ?? []).map((b) => b.id));
  });

  const live = bombsRef.current ?? [];
  // `hidden` covers the tunnel ride. Unmounting instead would throw away every live
  // bomb's countdown canvas and CanvasTexture and rebuild them on the way out.
  return (
    <group visible={!hidden}>
      <WarmUp />
      {ids.map((id) => {
        const bomb = live.find((b) => b.id === id);
        return bomb ? <Bomb key={id} bomb={bomb} size={size} /> : null;
      })}
      {disarmed.map(bomb => <DisarmedBomb key={bomb.id} bomb={bomb} size={size} hidden={hidden}
        onDone={() => setDisarmed(list => list.filter(b => b.id !== bomb.id))} />)}
      {bursts.map((burst) => (
        <BlastBurst
          key={burst.id}
          points={burst.points}
          onDone={() => setBursts((b) => b.filter((x) => x.id !== burst.id))}
        />
      ))}
    </group>
  );
}
