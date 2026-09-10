import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { FACE_COLORS } from '../../utils/constants.js';
import { INTRO_END, sampleIntro, passagePoint, introCameraDistance } from './introChoreography.js';

const FACES = [
  { axis: 2, sign: 1, color: 1, rotation: [0, 0, 0] },
  { axis: 2, sign: -1, color: 4, rotation: [0, Math.PI, 0] },
  { axis: 0, sign: 1, color: 5, rotation: [0, Math.PI / 2, 0] },
  { axis: 0, sign: -1, color: 2, rotation: [0, -Math.PI / 2, 0] },
  { axis: 1, sign: 1, color: 3, rotation: [-Math.PI / 2, 0, 0] },
  { axis: 1, sign: -1, color: 6, rotation: [Math.PI / 2, 0, 0] }
];
const CELLS = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
  if (x || y || z) CELLS.push([x, y, z]);
}
const TILES = CELLS.flatMap(position => FACES.filter(f => position[f.axis] === f.sign).map(face => ({ position, face })));
const SEGMENTS = 18;

// Two instanced cube draws, one instanced worm, and a single reusable passage
// buffer replace hundreds of independently animated tunnel strands.
export default function IntroScene({ time, onComplete, reducedMotion = false }) {
  const root = useRef();
  const bodies = useRef();
  const tiles = useRef();
  const worm = useRef();
  const eyes = useRef();
  const passage = useRef();
  const gates = useRef([]);
  const finished = useRef(false);
  const assets = useMemo(() => {
    const body = new RoundedBoxGeometry(0.96, 0.96, 0.96, 2, 0.065);
    const tile = new RoundedBoxGeometry(0.84, 0.84, 0.055, 2, 0.025);
    const path = new THREE.CatmullRomCurve3(Array.from({ length: 65 }, (_, i) => passagePoint(i / 64, 1, new THREE.Vector3())));
    const curve = new THREE.TubeGeometry(path, 64, 0.026, 6, false);
    curve.setAttribute('color', new THREE.BufferAttribute(new Float32Array(curve.attributes.position.count * 3), 3));
    const red = new THREE.Color(FACE_COLORS[1]);
    const orange = new THREE.Color(FACE_COLORS[4]);
    const color = new THREE.Color();
    for (let i = 0; i < curve.attributes.position.count; i++) {
      color.copy(red).lerp(orange, Math.max(0, Math.min(1, (1 - curve.attributes.position.getZ(i)) / 2)));
      curve.attributes.color.setXYZ(i, color.r, color.g, color.b);
    }
    return { body, tile, curve, dummy: new THREE.Object3D(), color,
      faceRotation: new THREE.Quaternion(), flipRotation: new THREE.Quaternion(),
      xAxis: new THREE.Vector3(1, 0, 0), euler: new THREE.Euler(),
      dark: new THREE.Color('#293329'), colors: FACES.map(f => new THREE.Color(FACE_COLORS[f.color])) };
  }, []);
  useEffect(() => () => { assets.body.dispose(); assets.tile.dispose(); assets.curve.dispose(); }, [assets]);
  useEffect(() => {
    if (time >= INTRO_END && !finished.current) {
      finished.current = true;
      onComplete?.();
    }
  }, [time, onComplete]);

  useFrame(({ camera }) => {
    const pose = sampleIntro(time, reducedMotion);
    const { dummy, color, faceRotation, flipRotation, xAxis, euler } = assets;
    const spacing = 1 + 1.5 * pose.open;
    const extent = spacing + 0.51;
    root.current.rotation.set(reducedMotion ? 0.12 : 0.12 + 0.1 * pose.open, pose.turn, 0);
    root.current.position.y = 0.25;
    CELLS.forEach((p, i) => {
      dummy.position.set(p[0] * spacing, p[1] * spacing, p[2] * spacing);
      dummy.rotation.set(0, 0, 0);
      // Open the central pair into portals while the other cubies separate.
      const centerPair = p[0] === 0 && p[1] === 0;
      dummy.scale.setScalar(centerPair ? Math.max(0.001, 1 - pose.open) : 1);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(i, dummy.matrix);
    });
    TILES.forEach(({ position: p, face: f }, i) => {
      dummy.position.set(p[0] * spacing, p[1] * spacing, p[2] * spacing);
      dummy.position.setComponent(f.axis, dummy.position.getComponent(f.axis) + 0.51 * f.sign);
      faceRotation.setFromEuler(euler.set(...f.rotation));
      const centerPair = p[0] === 0 && p[1] === 0 && f.axis === 2;
      flipRotation.setFromAxisAngle(xAxis, centerPair ? pose.flip : 0);
      dummy.quaternion.copy(faceRotation).multiply(flipRotation);
      dummy.scale.setScalar(centerPair ? Math.max(0.001, 1 - pose.open) : 1);
      dummy.updateMatrix();
      tiles.current.setMatrixAt(i, dummy.matrix);
      color.copy(assets.dark).lerp(assets.colors[FACES.indexOf(f)], pose.reveal);
      tiles.current.setColorAt(i, color);
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    tiles.current.instanceMatrix.needsUpdate = true;
    tiles.current.instanceColor.needsUpdate = true;

    passage.current.visible = pose.passage > 0.001;
    passage.current.material.opacity = pose.passage * 0.65;
    passage.current.scale.z = extent;
    gates.current.forEach((gate, i) => {
      gate.position.z = (i ? -1 : 1) * extent;
      gate.visible = pose.passage > 0.001;
      gate.scale.setScalar(0.75 + pose.open * 0.25);
      gate.material.opacity = pose.passage;
    });
    worm.current.visible = pose.wormVisible;
    eyes.current.visible = pose.wormVisible;
    for (let i = 0; i < SEGMENTS; i++) {
      const u = pose.worm - i * 0.018;
      passagePoint(u, extent, dummy.position);
      dummy.quaternion.identity();
      const taper = 0.055 + 0.09 * (1 - i / SEGMENTS);
      dummy.scale.setScalar(u < 0 ? 0 : taper);
      dummy.updateMatrix();
      worm.current.setMatrixAt(i, dummy.matrix);
    }
    worm.current.instanceMatrix.needsUpdate = true;
    passagePoint(pose.worm, extent, eyes.current.position);

    // Leave the lower quarter for typography and preserve the entire silhouette
    // on narrow phones; projection changes are handled by the shared Canvas.
    const distance = introCameraDistance(pose.distance, camera.aspect, camera.fov);
    camera.position.set(Math.sin(pose.orbit) * distance, distance * 0.32, Math.cos(pose.orbit) * distance);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, -0.55, 0);
  });

  return (
    <group ref={root}>
      <instancedMesh ref={bodies} args={[assets.body, null, CELLS.length]} frustumCulled={false}>
        <meshStandardMaterial color="#293329" roughness={0.32} metalness={0.2} />
      </instancedMesh>
      <instancedMesh ref={tiles} args={[assets.tile, null, TILES.length]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.32} metalness={0.08} />
      </instancedMesh>
      <mesh ref={passage} geometry={assets.curve} frustumCulled={false}>
        <meshBasicMaterial vertexColors transparent depthWrite={false} />
      </mesh>
      {[1, 4].map((colorId, i) => (
        <mesh key={colorId} ref={el => { gates.current[i] = el; }}>
          <torusGeometry args={[0.44, 0.035, 8, 48]} />
          <meshBasicMaterial color={FACE_COLORS[colorId]} transparent depthWrite={false} />
        </mesh>
      ))}
      <instancedMesh ref={worm} args={[null, null, SEGMENTS]} frustumCulled={false}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#b9ef86" emissive="#5f7f4a" emissiveIntensity={0.3} roughness={0.5} />
      </instancedMesh>
      <group ref={eyes}>
        {[-1, 1].map(side => <mesh key={side} position={[0.1, 0.085, side * 0.055]}>
          <sphereGeometry args={[0.033, 8, 6]} /><meshBasicMaterial color="#1e1612" />
        </mesh>)}
      </group>
    </group>
  );
}
