import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, Object3D, Vector3 } from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { FACE_NORMALS, WORM_LIFT } from './constants.js';
import { storyArrivalPose } from './storyArrival.js';

const Z = new Vector3(0, 0, 1);
const SHARDS = 24;
const vertexShader = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragmentShader = `
  varying vec2 vUv; uniform float uTime; uniform float uPower;
  void main(){
    vec2 p=(vUv-.5)*2.; float r=length(p), a=atan(p.y,p.x);
    float rim=exp(-pow((r-.73)*30.,2.));
    float spiral=pow(.5+.5*sin(a*5.-r*19.+uTime*4.),5.);
    float aperture=(1.-smoothstep(.66,.78,r));
    vec3 color=mix(vec3(.025,.025,.12),vec3(.13,.85,1.),spiral*.6);
    color+=rim*vec3(.45,1.,.75)*2.;
    float alpha=(aperture*.82+rim*.8)*uPower;
    gl_FragColor=vec4(color,alpha);
  }`;

// A fixed number of low-poly effects, driven on the existing render clock.
// The equipped worm stays mounted; its authored body/history never changes.
export function StoryArrival({ worm, elapsed, children }) {
  const body = useRef(), portal = useRef(), rings = useRef([]), shards = useRef(), aperture = useRef();
  const scratch = useMemo(() => ({ dummy: new Object3D(), pivot: new Vector3(),
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 } } }), []);
  useFrame(() => {
    if (!body.current || !portal.current) return;
    const state = useGameStore.getState();
    const arriving = state.wormGamePhase === 'spawning';
    const hidden = state.wormGamePhase === 'scrambling' || (!!state.wormStoryLevel && !state.wormStoryStarted);
    body.current.visible = !hidden;
    portal.current.visible = arriving && !hidden;
    body.current.scale.setScalar(1);
    body.current.position.set(0, 0, 0);
    body.current.quaternion.identity();
    if (!arriving) return;
    const reduced = state.settings?.reducedMotion || prefersReducedMotion();
    const pose = storyArrivalPose(elapsed.current, reduced);
    const head = worm.headInterpPos.current;
    const normal = FACE_NORMALS[worm.pos.current.dirKey] ?? FACE_NORMALS.PZ;
    const scale = Math.max(0.001, pose.scale);
    body.current.visible = !hidden && pose.scale > 0;
    body.current.scale.setScalar(scale);
    body.current.quaternion.setFromAxisAngle(normal, pose.yaw);
    scratch.pivot.copy(head).multiplyScalar(scale).applyQuaternion(body.current.quaternion);
    body.current.position.copy(head).sub(scratch.pivot).addScaledVector(normal, pose.lift);
    portal.current.visible = !hidden && !reduced;
    portal.current.position.copy(head).addScaledVector(normal, WORM_LIFT + 0.025);
    portal.current.quaternion.setFromUnitVectors(Z, normal);
    scratch.uniforms.uTime.value = elapsed.current;
    scratch.uniforms.uPower.value = pose.ring;
    aperture.current.scale.setScalar(0.2 + pose.ring * 1.45);
    for (let i = 0; i < rings.current.length; i++) {
      const ring = rings.current[i];
      ring.rotation.z = elapsed.current * (i % 2 ? -1.2 : 0.9) + i * 0.7;
      ring.scale.setScalar(i === 2 ? 0.9 + pose.settle * 3.4 : 0.2 + pose.ring * (1 + i * 0.25));
      ring.material.opacity = i === 2 ? pose.burst * 0.8 : pose.ring * 0.85;
    }
    const d = scratch.dummy;
    for (let i = 0; i < SHARDS; i++) {
      const a = i * Math.PI * 2 / SHARDS + elapsed.current * 0.65;
      const radius = pose.t < 0.7 ? 2.3 - pose.t * 2.4 : 0.62 + pose.settle * 2.3;
      d.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0.12 + Math.sin(a * 3) * 0.09 + pose.burst * (i % 3) * 0.14);
      d.rotation.set(a, a * 0.5, -a);
      d.scale.setScalar((0.035 + (i % 3) * 0.008) * pose.ring);
      d.updateMatrix(); shards.current.setMatrixAt(i, d.matrix);
    }
    shards.current.instanceMatrix.needsUpdate = true;
  }, -0.3);
  return <>
    <group ref={body} name="story-worm-arrival">{children}</group>
    <group ref={portal} visible={false} name="story-arrival-portal">
      <mesh ref={aperture}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial uniforms={scratch.uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
          transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      {[0, 1, 2].map(i => <mesh key={i} ref={node => { rings.current[i] = node; }} position={[0, 0, 0.04 + i * 0.025]}>
        <torusGeometry args={[0.83, i === 2 ? 0.016 : 0.025, 6, 64, i === 2 ? Math.PI * 2 : Math.PI * 1.65]} />
        <meshBasicMaterial color={i === 1 ? '#bd9aff' : '#91ffe2'} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>)}
      <instancedMesh ref={shards} args={[undefined, undefined, SHARDS]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#befcff" toneMapped={false} />
      </instancedMesh>
    </group>
  </>;
}
