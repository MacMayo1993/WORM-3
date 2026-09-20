import { useGameStore } from '../../hooks/useGameStore.js';
import { ENEMIES, ELEMENTS, WAVES } from './combatDefs.js';
import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Quaternion, Vector3 } from 'three';
import { combatBridge, COMBAT, surfacePose } from './portalCombat.js';

const up = new Vector3(0,0,1), normal = new Vector3(), tangent = new Vector3(), inverse = new Quaternion();
function place(group, actor, size, lift = 0.18) {
  const p = surfacePose(actor.tile, actor.next || actor.tile, actor.t || 0, size, lift);
  group.position.fromArray(p.position);
  group.quaternion.setFromUnitVectors(up, normal.fromArray(p.normal));
}
// Two inverted shells share the body's geometry: a clear red edge and a wider
// faint halo. Depth testing keeps enemies behind the cube hidden; no bloom or
// lights are required, so the outline also works on low graphics settings.
function EnemyOutline() {
  const enhanced = useGameStore(s => s.wormCharacter === 'glow');
  const ref = useRef();
  useLayoutEffect(() => {
    const group = ref.current;
    for (const mesh of group.children) mesh.geometry = group.parent.geometry;
  }, []);
  return <group ref={ref}>
    <mesh scale={enhanced ? 1.42 : 1.24}><meshBasicMaterial color="#ff1828" side={BackSide} transparent opacity={enhanced ? 0.5 : 0.2} depthWrite={false} toneMapped={false} /></mesh>
    <mesh scale={enhanced ? 1.16 : 1.1}><meshBasicMaterial color="#ff3038" side={BackSide} transparent opacity={0.95} depthWrite={false} toneMapped={false} /></mesh>
  </group>;
}
// Four pooled rigs; shells and joints animate in place without React state.
function Crawler({ slot }) {
  const ref = useRef(), rig = useRef(), body = useRef(), target = useRef(), shell = useRef();
  const accents = useRef(), armor = useRef(), status = useRef(), legs = useRef(), fins = useRef(), frost = useRef(), warning = useRef();
  const facing = useRef({ id: null, angle: 0 });
  useFrame((_,delta) => {
    const c = combatBridge.current, e = c?.enemies[slot];
    if (!ref.current) return;
    ref.current.visible = !!e;
    if (!e) return;
    place(ref.current,e,c.size,0.13);
    const emerge = Math.max(0.05,1-Math.max(0,e.emerging)/0.8);
    const def = ENEMIES[e.type] || ENEMIES.crawler;
    ref.current.scale.setScalar(emerge*def.scale);
    if (facing.current.id !== e.id) facing.current = { id: e.id, angle: 0 };
    if (e.next) {
      const a = surfacePose(e.tile,e.tile,0,c.size).position;
      const b = surfacePose(e.next,e.next,0,c.size).position;
      tangent.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]).applyQuaternion(inverse.copy(ref.current.quaternion).invert());
      const angle = Math.atan2(-tangent.x,tangent.y);
      const turn = Math.atan2(Math.sin(angle-facing.current.angle),Math.cos(angle-facing.current.angle));
      if (!c.held) facing.current.angle += turn*Math.min(1,delta*14);
    }
    rig.current.rotation.z = facing.current.angle;
    const frozen = e.freeze > 0, rooted = e.root > 0;
    const charging = e.type === 'scout' && e.dashClock < 0.45 && !frozen && !rooted && e.emerging <= 0;
    const dashing = e.type === 'scout' && e.dashClock >= 0.45 && e.dashClock < 0.95;
    const moving = e.next && !frozen && !rooted && !(e.stun > 0) && !charging && e.emerging <= 0;
    const gait = c.time*(dashing ? 15 : e.type === 'brute' ? 4 : 7.5)+e.id;
    body.current.position.z = 0.08+(moving ? Math.sin(gait*2)*0.016 : 0);
    body.current.rotation.x = charging ? -0.14 : dashing ? 0.09 : 0;
    shell.current.scale.set(e.type === 'scout' ? 0.7 : 1,e.type === 'scout' ? 1.15 : 1,1);
    for (const mesh of shell.current.children) {
      mesh.material.color.set(e.type === 'brute' ? '#55446f' : e.type === 'scout' ? '#8d512c' : '#813b61');
      mesh.material.emissive.set(e.hitFlash > 0 ? '#ffffff' : frozen ? '#58b9ff' : e.burn > 0 ? '#ff6633' : def.color);
      mesh.material.emissiveIntensity = e.hitFlash > 0 ? 1.8 : e.burn > 0 ? 0.8 : useGameStore.getState().wormCharacter === 'glow' ? 0.75 : 0.18;
    }
    accents.current.children.forEach(mesh => mesh.material.color.set(frozen ? '#c9f4ff' : def.color));
    legs.current.children.forEach((joint,i) => {
      const side = i < 3 ? -1 : 1, row = i%3-1;
      const step = moving ? Math.sin(gait+row*1.8+(side<0 ? 0 : Math.PI)) : 0;
      joint.rotation.z = side*(row*0.32+step*0.26);
      joint.rotation.y = side*(-0.18+Math.max(0,step)*0.35);
      joint.children[1].rotation.y = side*(0.65+Math.max(0,-step)*0.4);
    });
    armor.current.visible = e.type === 'brute';
    armor.current.children.forEach((plate,i) => {
      plate.visible = i < Math.ceil(e.hp);
      plate.children[0].material.emissiveIntensity = e.hitFlash > 0 ? 1.4 : 0.08;
    });
    fins.current.visible = e.type === 'scout';
    fins.current.scale.x = charging ? 1.2+Math.sin(c.time*35)*0.05 : dashing ? 0.85 : 1;
    warning.current.visible = charging;
    warning.current.scale.setScalar(0.8+Math.min(1,e.dashClock/0.45)*0.25);
    status.current.visible = frozen || rooted;
    status.current.material.color.set(frozen ? '#a0e7ff' : '#b6ed80');
    frost.current.visible = frozen;
    target.current.visible = c.lockedId === e.id && !c.held && !c.won;
    target.current.scale.setScalar((1+Math.sin(c.time*5)*0.035)/def.scale);
  });
  return <group ref={ref} visible={false}>
    <group ref={rig}>
      <group ref={legs}>{[-1,1].flatMap(side => [-1,0,1].map(row => <group key={`${side}:${row}`} position={[side*0.18,row*0.19,0.02]}>
        <mesh position={[side*0.1,0,0.015]} scale={[0.25,0.055,0.055]}><boxGeometry /><meshStandardMaterial color="#9e91aa" emissive="#ff2038" emissiveIntensity={0.5} metalness={0.65} roughness={0.38} /></mesh>
        <group position={[side*0.21,0,0]}>
          <mesh position={[side*0.075,0,0]} scale={[0.2,0.035,0.045]}><boxGeometry /><meshStandardMaterial color="#312538" emissive="#ff2038" emissiveIntensity={0.45} metalness={0.65} roughness={0.35} /></mesh>
          <mesh position={[side*0.15,0,0]}><icosahedronGeometry args={[0.048,0]} /><meshStandardMaterial color="#e1b7cb" metalness={0.45} roughness={0.4} /></mesh>
        </group>
      </group>))}</group>
      <group ref={body}>
        <mesh position={[0,-0.07,0.03]} scale={[0.23,0.32,0.1]}><icosahedronGeometry args={[1,1]} /><meshStandardMaterial color="#201d32" metalness={0.45} roughness={0.45} /><EnemyOutline /></mesh>
        <group ref={shell}>{[-1,1].map(side => <mesh key={side} position={[side*0.125,-0.035,0.12]} rotation={[0,side*0.18,side*0.06]} scale={[0.155,0.32,0.18]}><icosahedronGeometry args={[1,1]} /><meshStandardMaterial metalness={0.65} roughness={0.3} /><EnemyOutline /></mesh>)}</group>
        <mesh position={[0,0.28,0.09]} scale={[0.205,0.14,0.12]}><icosahedronGeometry args={[1,0]} /><meshStandardMaterial color="#302739" metalness={0.65} roughness={0.28} /><EnemyOutline /></mesh>
        <group ref={accents}>
          {[-1,1].map(side => <mesh key={side} position={[side*0.094,0.365,0.14]} rotation={[0,0,side*0.16]} scale={[0.12,0.03,0.027]}><boxGeometry /><meshBasicMaterial toneMapped={false} /></mesh>)}
          {[-1,0,1].map(i => <mesh key={i+3} position={[0,i*0.16-0.055,0.265]} scale={[0.045,0.075,0.03]}><octahedronGeometry /><meshBasicMaterial toneMapped={false} /></mesh>)}
        </group>
        {[-1,1].map(side => <mesh key={side} position={[side*0.14,0.425,0.065]} rotation={[0,0,-side*0.35]}><coneGeometry args={[0.055,0.18,4]} /><meshStandardMaterial color="#e2c6d9" metalness={0.5} roughness={0.32} /></mesh>)}
        <group ref={fins}>{[-1,1].map(side => <mesh key={side} position={[side*0.21,-0.27,0.16]} rotation={[0.15,side*0.3,side*0.5]} scale={[0.07,0.3,0.11]}><octahedronGeometry /><meshStandardMaterial color="#e9bc6f" emissive="#ff8b35" emissiveIntensity={0.25} metalness={0.65} roughness={0.3} /><EnemyOutline /></mesh>)}</group>
        <group ref={armor}>{[0,1,2].map(i => <group key={i} position={[0,(i-1)*0.185,0.26]}>
          <mesh scale={[0.34,0.135,0.1]}><icosahedronGeometry args={[1,0]} /><meshStandardMaterial color="#b8accb" emissive="#b79bff" metalness={0.7} roughness={0.3} /><EnemyOutline /></mesh>
          <mesh position={[0,0,0.085]} scale={[0.13,0.024,0.025]}><boxGeometry /><meshBasicMaterial color="#ddc8ff" toneMapped={false} /></mesh>
        </group>)}</group>
      </group>
      <group ref={warning} position={[0,0.67,0.015]}>{[-1,1].map(side => <mesh key={side} position={[side*0.085,0,0]} rotation={[0,0,side*Math.PI/4]} scale={[0.035,0.24,0.015]}><boxGeometry /><meshBasicMaterial color="#ffd18b" transparent opacity={0.85} depthWrite={false} toneMapped={false} /></mesh>)}</group>
    </group>
    <mesh ref={frost} position={[0,0,0.18]} scale={[0.39,0.49,0.3]}><icosahedronGeometry args={[1,1]} /><meshBasicMaterial color="#a0e7ff" wireframe transparent opacity={0.5} depthWrite={false} toneMapped={false} /></mesh>
    <mesh ref={status} position={[0,0,0.005]}><ringGeometry args={[0.42,0.46,6]} /><meshBasicMaterial transparent opacity={0.75} depthWrite={false} toneMapped={false} /></mesh>
    <group ref={target} position={[0,0,0.02]}>{[0,1,2,3].map(i => <mesh key={i} rotation={[0,0,i*Math.PI/2+0.2]}><ringGeometry args={[0.54,0.58,6,1,0,Math.PI/2-0.4]} /><meshBasicMaterial color="#e4fff5" transparent opacity={0.95} depthWrite={false} toneMapped={false} /></mesh>)}</group>
  </group>;
}
function AimGuide() {
  const ref = useRef();
  useFrame(() => {
    const c = combatBridge.current, aim = c?.aim;
    ref.current.visible = !!aim && !c.held && !c.won && c.health > 0;
    if (!aim) return;
    ref.current.position.fromArray(aim.origin);
    ref.current.quaternion.setFromUnitVectors(up,tangent.fromArray(aim.direction));
    ref.current.children.forEach((mesh,i) => {
      const distance = 0.28+i*0.25;
      mesh.visible = distance < aim.range;
      mesh.position.z = distance;
      mesh.material.color.set(c.lockedId == null ? '#9ac5c0' : '#e4fff5');
    });
  });
  return <group ref={ref} visible={false}>{[0,1,2,3].map(i => <mesh key={i}>
    <sphereGeometry args={[0.025,6,4]} /><meshBasicMaterial transparent opacity={0.65} depthWrite={false} toneMapped={false} />
  </mesh>)}</group>;
}
function Shot({ slot }) {
  const ref = useRef(), orbit = useRef();
  useFrame(() => {
    const c = combatBridge.current, shot = c?.shots[slot];
    if (!ref.current) return;
    ref.current.visible = !!shot;
    if (!shot) return;
    ref.current.position.fromArray(shot.position);
    ref.current.quaternion.setFromUnitVectors(up,tangent.fromArray(shot.direction));
    orbit.current.rotation.z = c.time*18;
    orbit.current.children.forEach(mesh => mesh.material.color.set(shot.color));
  });
  return <group ref={ref} visible={false}>
    <mesh><sphereGeometry args={[0.075,10,8]} /><meshBasicMaterial color="#fff8e0" toneMapped={false} /></mesh>
    <group ref={orbit}>
      {[-1,1].map(side => <mesh key={side} position={[side*0.12,0,0]}><sphereGeometry args={[0.06,8,6]} /><meshBasicMaterial color={side<0?'#bd80ff':'#84ffdd'} toneMapped={false} /></mesh>)}
      <mesh rotation={[0.5,0,0]}><torusGeometry args={[0.15,0.013,5,16]} /><meshBasicMaterial color="#c8eaff" toneMapped={false} /></mesh>
    </group>
  </group>;
}
// One local firing flash, fixed to the actual shot origin. No camera impulse.
function MuzzleFlash() {
  const ref = useRef();
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  useFrame(() => {
    const c = combatBridge.current, flash = c?.muzzle, group = ref.current;
    group.visible = !!flash && !c.held && !c.won;
    if (!group.visible) return;
    group.position.fromArray(flash.origin);
    group.quaternion.setFromUnitVectors(up, tangent.fromArray(flash.direction));
    const remaining = flash.life / 0.12;
    group.scale.setScalar(reduced ? 0.6 : 0.7 + (1 - remaining) * 0.8);
    group.children.forEach(mesh => { mesh.material.color.set(flash.color); mesh.material.opacity = remaining * (reduced ? 0.35 : 0.8); });
  });
  return <group ref={ref} visible={false}>
    <mesh position={[0,0,0.16]}><ringGeometry args={[0.055,0.085,16]} /><meshBasicMaterial transparent depthWrite={false} toneMapped={false} side={2} /></mesh>
    <mesh position={[0,0,0.1]} scale={[0.045,0.045,0.17]}><octahedronGeometry /><meshBasicMaterial transparent depthWrite={false} toneMapped={false} /></mesh>
  </group>;
}
function Drop({ slot }) {
  const ref = useRef();
  useFrame(() => {
    const c = combatBridge.current, d = c?.drops[slot];
    if (!ref.current) return;
    ref.current.visible = !!d;
    if (!d) return;
    place(ref.current,d,c.size,0.35+Math.sin(c.time*3)*0.08);
    ref.current.rotateZ(c.time*1.5);
    const color = ELEMENTS[d.element]?.color || '#84ffdd';
    ref.current.children[0].material.color.set(color);
    ref.current.scale.setScalar(d.element ? 1.5 : 1);
  });
  return <group ref={ref} visible={false}><mesh><octahedronGeometry args={[0.16]} /><meshBasicMaterial color="#84ffdd" toneMapped={false} /></mesh><mesh><torusGeometry args={[0.23,0.012,5,16]} /><meshBasicMaterial color="#c9adff" /></mesh></group>;
}
function Burst({ slot }) {
  const ref = useRef();
  useFrame(() => {
    const c = combatBridge.current, b = c?.bursts[slot];
    if (!ref.current) return;
    ref.current.visible = !!b;
    if (!b) return;
    place(ref.current,b,c.size,0.28);
    const t = 1-b.life/0.55;
    ref.current.scale.setScalar(0.2+t*1.2);
    for (const child of ref.current.children) { child.material.opacity = 1-t; child.material.color.set(b.kind === 'hit' ? '#ff7759' : b.kind === 'lightning' ? '#d39bff' : b.kind === 'impact' ? '#fff4cd' : '#bdfce3'); }
  });
  return <group ref={ref} visible={false}>
    <mesh><ringGeometry args={[0.7,0.76,24]} /><meshBasicMaterial transparent depthWrite={false} toneMapped={false} /></mesh>
    {Array.from({length:8},(_,i) => <mesh key={i} position={[Math.cos(i*Math.PI/4)*0.6,Math.sin(i*Math.PI/4)*0.6,0.1]}><octahedronGeometry args={[0.09]} /><meshBasicMaterial transparent depthWrite={false} toneMapped={false} /></mesh>)}
  </group>;
}
function ChainArc({ slot }) {
  const ref = useRef();
  const positions = useMemo(() => new Float32Array(27*3), []);
  useFrame(() => {
    const c = combatBridge.current, arc = c?.arcs[slot], line = ref.current;
    if (!line) return;
    line.visible = !!arc;
    if (!arc) return;
    let count = 0;
    const tiles = arc.tiles.length === 1 ? [arc.tiles[0],arc.tiles[0]] : arc.tiles;
    for (let i=1;i<tiles.length;i++) for (let j=0;j<=8;j++) {
      const p = surfacePose(tiles[i-1],tiles[i],j/8,c.size,0.32);
      // Jitter lifts the spark off the surface; it never cuts through the shell.
      const jitter = j%2 ? 0.08*(1+Math.sin(c.time*40+j*3)) : 0;
      for (let axis=0;axis<3;axis++) positions[count*3+axis] = p.position[axis]+p.normal[axis]*jitter;
      count++;
    }
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.setDrawRange(0,count);
    line.material.opacity = Math.min(1,arc.life/0.15);
  });
  return <line ref={ref} visible={false} frustumCulled={false}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]} /></bufferGeometry><lineBasicMaterial color="#e2baff" transparent depthWrite={false} toneMapped={false} /></line>;
}
function PortalBeacon() {
  const ref = useRef(), ring = useRef();
  useFrame(() => {
    const c = combatBridge.current;
    if (!ref.current) return;
    ref.current.visible = !!c && c.portalOpen && !c.won;
    if (!ref.current.visible || !c.portal) return;
    place(ref.current,{tile:c.portal},c.size,0.12);
    const wave = WAVES[c.wave];
    const warning = c.ambient ? c.warning > 0 : c.started && c.intermission === 0 && c.waveSpawned < wave.enemies.length && c.enemies.length < wave.cap && c.spawnTimer <= COMBAT.warning;
    ring.current.material.color.set(warning ? '#ffab76' : '#c29aff');
    ring.current.scale.setScalar(1+(warning?0.1*Math.sin(c.time*10):0));
    ref.current.children[1].position.z = 0.6+Math.sin(c.time*3)*0.08;
  });
  return <group ref={ref} visible={false}>
    <mesh ref={ring}><torusGeometry args={[0.52,0.035,6,32]} /><meshBasicMaterial toneMapped={false} /></mesh>
    <mesh><octahedronGeometry args={[0.13]} /><meshBasicMaterial color="#c29aff" toneMapped={false} /></mesh>
  </group>;
}
export default function CombatScene({ maxEnemies = COMBAT.maxEnemies }) {
  return <group><PortalBeacon /><AimGuide /><MuzzleFlash />{Array.from({length:maxEnemies},(_,i)=><Crawler key={i} slot={i} />)}
    {Array.from({length:8},(_,i)=><Shot key={i} slot={i} />)}
    {Array.from({length:6},(_,i)=><Drop key={i} slot={i} />)}
    {Array.from({length:8},(_,i)=><Burst key={i} slot={i} />)}
    {Array.from({length:6},(_,i)=><ChainArc key={i} slot={i} />)}
  </group>;
}
