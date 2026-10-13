import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { FACE_NORMALS, WORM_LIFT } from './constants.js';
import { storyArrivalPose } from './storyArrival.js';

const Z = new Vector3(0, 0, 1);

// Scale around the head's world-space anchor, including its face and cosmetics.
// No path/history edits, new worm instances or per-frame React updates.
export function StoryArrival({ worm, elapsed, children }) {
  const body = useRef();
  const portal = useRef();
  const ring = useRef();
  const halo = useRef();
  useFrame(() => {
    if (!body.current || !portal.current) return;
    const state = useGameStore.getState();
    const story = !!state.wormStoryLevel;
    const arriving = story && state.wormGamePhase === 'spawning';
    const hidden = story && !state.wormStoryStarted;
    body.current.visible = !hidden;
    portal.current.visible = arriving;
    body.current.scale.setScalar(1);
    body.current.position.set(0, 0, 0);
    if (!arriving) return;
    const reduced = state.settings?.reducedMotion || prefersReducedMotion();
    const pose = storyArrivalPose(elapsed.current, reduced);
    const head = worm.headInterpPos.current;
    const normal = FACE_NORMALS[worm.pos.current.dirKey] ?? FACE_NORMALS.PZ;
    const scale = Math.max(0.001, pose.scale);
    body.current.visible = pose.scale > 0;
    body.current.scale.setScalar(scale);
    body.current.position.copy(head).multiplyScalar(1 - scale).addScaledVector(normal, pose.lift);
    portal.current.position.copy(head).addScaledVector(normal, WORM_LIFT + 0.02);
    portal.current.quaternion.setFromUnitVectors(Z, normal);
    ring.current.rotation.z = reduced ? 0 : pose.t * Math.PI;
    ring.current.scale.setScalar(0.25 + 0.9 * pose.ring);
    ring.current.material.opacity = pose.ring * 0.95;
    halo.current.scale.setScalar(0.3 + 1.5 * pose.t);
    halo.current.material.opacity = pose.ring * 0.35;
  }, -0.3);
  return <>
    <group ref={body} name="story-worm-arrival">{children}</group>
    <group ref={portal} visible={false} name="story-arrival-portal">
      <mesh ref={ring}>
        <torusGeometry args={[0.5, 0.035, 8, 48, Math.PI * 1.75]} />
        <meshBasicMaterial color="#b6ffdd" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={halo}>
        <torusGeometry args={[0.5, 0.012, 6, 48]} />
        <meshBasicMaterial color="#55ddff" transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  </>;
}
