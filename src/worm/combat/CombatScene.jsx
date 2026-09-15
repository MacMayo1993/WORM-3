import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { combatBridge, COMBAT, surfacePose } from './portalCombat.js';

const up = new Vector3(0,0,1), normal = new Vector3();
function place(group, actor, size, lift = 0.18) {
  const p = surfacePose(actor.tile, actor.next || actor.tile, actor.t || 0, size, lift);
  group.position.fromArray(p.position);
  group.quaternion.setFromUnitVectors(up, normal.fromArray(p.normal));
}
function Crawler({ slot }) {
  const ref = useRef(), body = useRef(), target = useRef();
  useFrame(() => {
    const c = combatBridge.current, e = c?.enemies[slot];
    if (!ref.current) return;
    ref.current.visible = !!e;
    if (!e) return;
    place(ref.current,e,c.size);
    const emerge = 1-Math.max(0,e.emerging)/0.8;
    ref.current.scale.setScalar(Math.max(0.05,emerge));
    body.current.rotation.z = Math.sin(c.time * 9 + e.id) * 0.14;
    body.current.position.z = 0.06 + Math.sin(c.time*12+e.id)*0.025;
    target.current.visible = c.lockedId === e.id;
    target.current.rotation.z = c.time;
  });
  return <group ref={ref} visible={false}>
    <group ref={body}>
      <mesh scale={[0.28,0.35,0.17]}><icosahedronGeometry args={[1,1]} /><meshStandardMaterial color="#261738" emissive="#862552" emissiveIntensity={0.7} metalness={0.5} roughness={0.3} /></mesh>
      <mesh position={[0,0,0.16]} scale={[0.06,0.28,0.025]}><boxGeometry /><meshBasicMaterial color="#ff8bc4" toneMapped={false} /></mesh>
      {[-1,1].map(side => <group key={side}>
        <mesh position={[side*0.11,0.21,0.12]}><sphereGeometry args={[0.045,8,6]} /><meshBasicMaterial color="#ffdf85" toneMapped={false} /></mesh>
        {[-1,0,1].map(i => <mesh key={i} position={[side*0.28,i*0.19,0]} rotation={[0,side*0.3,side*(0.35+i*0.2)]} scale={[0.2,0.035,0.035]}><boxGeometry /><meshStandardMaterial color="#a7528b" metalness={0.6} roughness={0.3} /></mesh>)}
      </group>)}
    </group>
    <mesh ref={target} position={[0,0,0.02]}><ringGeometry args={[0.44,0.47,24,1,0,Math.PI*1.6]} /><meshBasicMaterial color="#d4fff1" transparent opacity={0.85} depthWrite={false} toneMapped={false} /></mesh>
  </group>;
}
function Shot({ slot }) {
  const ref = useRef(), orbit = useRef();
  useFrame(() => {
    const c = combatBridge.current, shot = c?.shots[slot];
    if (!ref.current) return;
    ref.current.visible = !!shot;
    if (!shot) return;
    place(ref.current,shot,c.size,0.2); orbit.current.rotation.z = c.time*18;
  });
  return <group ref={ref} visible={false}>
    <mesh><sphereGeometry args={[0.075,10,8]} /><meshBasicMaterial color="#fff8e0" toneMapped={false} /></mesh>
    <group ref={orbit}>
      {[-1,1].map(side => <mesh key={side} position={[side*0.12,0,0]}><sphereGeometry args={[0.06,8,6]} /><meshBasicMaterial color={side<0?'#bd80ff':'#84ffdd'} toneMapped={false} /></mesh>)}
      <mesh rotation={[0.5,0,0]}><torusGeometry args={[0.15,0.013,5,16]} /><meshBasicMaterial color="#c8eaff" toneMapped={false} /></mesh>
    </group>
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
    for (const child of ref.current.children) { child.material.opacity = 1-t; child.material.color.set(b.kind === 'hit' ? '#ff7759' : '#bdfce3'); }
  });
  return <group ref={ref} visible={false}>
    <mesh><ringGeometry args={[0.7,0.76,24]} /><meshBasicMaterial transparent depthWrite={false} toneMapped={false} /></mesh>
    {Array.from({length:8},(_,i) => <mesh key={i} position={[Math.cos(i*Math.PI/4)*0.6,Math.sin(i*Math.PI/4)*0.6,0.1]}><octahedronGeometry args={[0.09]} /><meshBasicMaterial transparent depthWrite={false} toneMapped={false} /></mesh>)}
  </group>;
}
function PortalBeacon() {
  const ref = useRef(), ring = useRef();
  useFrame(() => {
    const c = combatBridge.current;
    if (!ref.current) return;
    ref.current.visible = !!c && c.portalOpen && !c.won;
    if (!c) return;
    place(ref.current,{tile:c.portal},c.size,0.12);
    const warning = c.started && c.enemies.length < COMBAT.maxEnemies && c.spawnTimer <= COMBAT.warning;
    ring.current.material.color.set(warning ? '#ffab76' : '#c29aff');
    ring.current.scale.setScalar(1+(warning?0.1*Math.sin(c.time*10):0));
    ref.current.children[1].position.z = 0.6+Math.sin(c.time*3)*0.08;
  });
  return <group ref={ref} visible={false}>
    <mesh ref={ring}><torusGeometry args={[0.52,0.035,6,32]} /><meshBasicMaterial toneMapped={false} /></mesh>
    <mesh><octahedronGeometry args={[0.13]} /><meshBasicMaterial color="#c29aff" toneMapped={false} /></mesh>
  </group>;
}
export default function CombatScene() {
  return <group><PortalBeacon />{[0,1].map(i=><Crawler key={i} slot={i} />)}
    {Array.from({length:8},(_,i)=><Shot key={i} slot={i} />)}
    {Array.from({length:6},(_,i)=><Drop key={i} slot={i} />)}
    {Array.from({length:8},(_,i)=><Burst key={i} slot={i} />)}
  </group>;
}
