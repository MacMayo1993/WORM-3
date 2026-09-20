import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { WormBody } from '../healerWorm/WormBody.jsx';
import { WormFace } from '../healerWorm/WormFace.jsx';
import { makeGapTraversal, advanceGap, setReachHeld, gapBusy } from '../traversal/gapTraversal.js';
import { sampleBridgeInto } from '../traversal/bridgeCurve.js';
import { makeGapLabWorm } from './gapLabAdapter.js';
import './gapLab.css';

const PHASE_LABEL = { idle: 'Plant your tail. Reach across.', plant: 'Planting', reach: 'Reaching — release to retract', latch: 'Caught! Settling into the span', pull: 'Pulling across', retract: 'Returning to support', complete: 'Crossing complete' };
function Island({ bounds, glass }) {
  const geometry = useMemo(() => {
    const size = bounds.max.clone().sub(bounds.min);
    const box = new THREE.BoxGeometry(...size.toArray());
    return { box, edges: new THREE.EdgesGeometry(box), center: bounds.max.clone().add(bounds.min).multiplyScalar(.5) };
  }, [bounds]);
  useEffect(() => () => { geometry.box.dispose(); geometry.edges.dispose(); }, [geometry]);
  return <group position={geometry.center}>
    <mesh geometry={geometry.box}><meshStandardMaterial color={glass ? '#80b9c8' : '#455857'} transparent={glass} opacity={glass ? .30 : 1} roughness={glass ? .15 : .72} depthWrite={!glass} /></mesh>
    <lineSegments geometry={geometry.edges}><lineBasicMaterial color="#b2cbc3" transparent opacity={.6} /></lineSegments>
  </group>;
}
function Scene({ session, presentation, onSnapshot }) {
  const worm = useMemo(() => makeGapLabWorm(session), [session]);
  const elapsed = useRef(0), markers = useRef();
  const scratch = useMemo(() => ({ p: new THREE.Vector3(), n: new THREE.Vector3(), f: new THREE.Vector3(), dummy: new THREE.Object3D() }), []);
  useFrame((_, delta) => {
    advanceGap(session, delta);
    session.paused ? elapsed.current = 0 : elapsed.current += delta;
    if (elapsed.current >= .08) { elapsed.current = 0; onSnapshot(); }
    // A preview is only a target; actual support markers below remain separate.
    if (markers.current) {
      markers.current.visible = session.phase === 'idle';
      for (let i = 0; i < 22; i++) {
        sampleBridgeInto(session.bridge, session.bridge.length * i / 21, scratch.p, scratch.n, scratch.f);
        scratch.dummy.position.copy(scratch.p); scratch.dummy.scale.setScalar(.013); scratch.dummy.updateMatrix();
        markers.current.setMatrixAt(i, scratch.dummy.matrix);
      }
      markers.current.instanceMatrix.needsUpdate = true;
    }
  }, -1);
  return <>
    <color attach="background" args={['#101c21']} />
    <ambientLight intensity={1.5} /><directionalLight position={[-2,6,4]} intensity={2.8} />
    {session.supports.map((bounds, i) => <Island key={i} bounds={bounds} glass={presentation === 'glass'} />)}
    {session.obstacles.map((bounds, i) => <Island key={i} bounds={bounds} />)}
    <instancedMesh ref={markers} args={[undefined, undefined, 22]}><sphereGeometry args={[1,6,6]} /><meshBasicMaterial color={session.reason === 'READY' ? '#a6e2bd' : '#ed827a'} /></instancedMesh>
    <WormBody worm={worm} size={3} /><WormFace worm={worm} size={3} />
    <OrbitControls makeDefault target={[.2,.3,0]} minDistance={2} maxDistance={Math.max(16, session.length * 4)} enablePan />
  </>;
}
export default function GapLab() {
  const [gap, setGap] = useState(.65), [orbs, setOrbs] = useState(5), [height, setHeight] = useState(0);
  const [obstacle, setObstacle] = useState(false), [glass, setGlass] = useState(false), [run, setRun] = useState(0);
  const [snapshot, setSnapshot] = useState(0), [paused, setPaused] = useState(false), [toggle, setToggle] = useState(false);
  const session = useMemo(() => makeGapTraversal({ gap, segments: 4 + orbs * 3, landingHeight: height, obstacle, epoch: run }), [gap, orbs, height, obstacle, run]);
  const refresh = () => setSnapshot(n => n + 1);
  const held = useRef(new Set());
  const setHeld = (source, value) => { value ? held.current.add(source) : held.current.delete(source); setReachHeld(session, held.current.size > 0); refresh(); };
  useEffect(() => {
    const before = useGameStore.getState();
    useGameStore.setState({ wormAlive: true, wormPaused: false, wormGamePhase: 'active', wormCharacter: 'classic' });
    return () => useGameStore.setState({ wormAlive: before.wormAlive, wormPaused: before.wormPaused, wormGamePhase: before.wormGamePhase, wormCharacter: before.wormCharacter });
  }, []);
  useEffect(() => {
    const clear = () => { held.current.clear(); setReachHeld(session, false); };
    const down = e => { if (e.code === 'KeyR' && !e.repeat && !['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); held.current.add('keyboard'); setReachHeld(session, true); refresh(); } };
    const up = e => { if (e.code === 'KeyR') { held.current.delete('keyboard'); setReachHeld(session, held.current.size > 0); refresh(); } };
    const blur = () => { clear(); session.paused = true; setPaused(true); useGameStore.setState({ wormPaused: true }); refresh(); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => { clear(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); };
  }, [session]);
  const reset = () => { held.current.clear(); setPaused(false); useGameStore.setState({ wormPaused: false }); setRun(n => n + 1); };
  const pause = () => { session.paused = !session.paused; setPaused(session.paused); useGameStore.setState({ wormPaused: session.paused }); refresh(); };
  const busy = gapBusy(session);
  const label = session.reason === 'LENGTH' ? `Need +${session.missingOrbs} orbs` : session.reason === 'OBSTRUCTED' ? 'Path blocked' : PHASE_LABEL[session.phase];
  const ledger = session.ledger;
  return <main className="gap-lab" data-frame={snapshot}>
    <header><div><span className="gap-eyebrow">WORM · DEVELOPMENT FIXTURE</span><h1>Reach. Catch. Pull.</h1></div><a href={import.meta.env.BASE_URL}>Back to WORM</a></header>
    <section className="gap-canvas" aria-label="Two islands and the worm crossing a gap">
      <Canvas camera={{ position: [.2, Math.max(2.8, (session.length + gap) * .85), Math.max(5, (session.length + gap) * 1.9)], fov: 44 }} dpr={[1,1.5]}><Scene session={session} presentation={glass ? 'glass' : 'classic'} onSnapshot={refresh} /></Canvas>
      <div className="gap-status" role="status">{paused ? 'Paused' : label}</div>
    </section>
    <section className="gap-panel">
      <div className="gap-controls">
        <button className="gap-reach" disabled={paused || session.reason !== 'READY' || session.phase === 'complete'}
          onPointerDown={e => { e.preventDefault(); if (!toggle) { e.currentTarget.setPointerCapture(e.pointerId); setHeld('pointer', true); } }}
          onPointerUp={() => { if (!toggle) setHeld('pointer', false); }} onPointerCancel={() => setHeld('pointer', false)} onLostPointerCapture={() => { if (!toggle) setHeld('pointer', false); }}
          onKeyDown={e => { if (!toggle && ['Enter',' '].includes(e.key) && !e.repeat) { e.preventDefault(); setHeld('button', true); } }}
          onKeyUp={e => { if (!toggle && ['Enter',' '].includes(e.key)) { e.preventDefault(); setHeld('button', false); } }}
          onClick={() => { if (toggle) setHeld('toggle', !held.current.has('toggle')); }}>
          {toggle ? (held.current.has('toggle') && !session.targetAttached ? 'RETRACT' : 'REACH') : 'HOLD TO REACH'}
        </button>
        <button onClick={pause}>{paused ? 'RESUME' : 'PAUSE'}</button><button onClick={reset}>RESET</button>
      </div>
      <p>Hold R or REACH. Release before the catch to return. Drag the view to inspect the hanging body.</p>
      <fieldset disabled={busy || paused}>
        <label>Gap <output>{gap.toFixed(2)}</output><input aria-label="Gap width" type="range" min=".25" max="1.6" step=".05" value={gap} onChange={e => setGap(+e.target.value)} /></label>
        <label>Carried orbs <output>{orbs}</output><input aria-label="Carried orbs" type="range" min="0" max="20" step="1" value={orbs} onChange={e => setOrbs(+e.target.value)} /></label>
        <label>Landing height <output>{height.toFixed(2)}</output><input aria-label="Landing height" type="range" min="-.3" max=".3" step=".05" value={height} onChange={e => setHeight(+e.target.value)} /></label>
        <label className="gap-check"><input type="checkbox" checked={obstacle} onChange={e => setObstacle(e.target.checked)} />Block the route</label>
        <label className="gap-check"><input type="checkbox" checked={glass} onChange={e => setGlass(e.target.checked)} />Glass supports</label>
        <label className="gap-check"><input type="checkbox" checked={toggle} onChange={e => { held.current.clear(); setReachHeld(session, false); setToggle(e.target.checked); }} />Toggle instead of hold</label>
      </fieldset>
      <details><summary>Length and support diagnostics</summary><dl><dt>Total body</dt><dd>{session.length.toFixed(3)}</dd><dt>Supported / hanging / landed</dt><dd>{ledger.departure.toFixed(3)} / {ledger.free.toFixed(3)} / {ledger.landing.toFixed(3)}</dd><dt>Length error</dt><dd>{Math.abs(ledger.total - session.length).toFixed(8)}</dd><dt>Reserved supports</dt><dd>{[...session.reservations].join(', ') || 'None'}</dd><dt>Catch / completion / cancel</dt><dd>{session.stats.catches} / {session.stats.completions} / {session.stats.cancellations}</dd></dl></details>
    </section>
  </main>;
}
