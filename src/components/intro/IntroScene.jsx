import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import IntroCubie from './IntroCubie.jsx';
import IntroTunnel from '../../manifold/IntroTunnel.jsx';
import WormParticle from '../../manifold/WormParticle.jsx';
import ArrivalBurst from '../../manifold/ArrivalBurst.jsx';
import { FACE_COLORS } from '../../utils/constants.js';
import { play, vibrate } from '../../utils/audio.js';

// Helper function to get sticker world position
const getStickerWorldPos = (x, y, z, dirKey, size, explosionFactor = 0) => {
  const k = (size - 1) / 2;
  const cubeX = x - k;
  const cubeY = y - k;
  const cubeZ = z - k;

  const expansionFactor = 1 + explosionFactor * 1.8;
  const explodedX = cubeX * expansionFactor;
  const explodedY = cubeY * expansionFactor;
  const explodedZ = cubeZ * expansionFactor;

  const offset = 0.51;
  if (dirKey === 'PZ') return [explodedX, explodedY, explodedZ + offset];
  if (dirKey === 'NZ') return [explodedX, explodedY, explodedZ - offset];
  if (dirKey === 'PX') return [explodedX + offset, explodedY, explodedZ];
  if (dirKey === 'NX') return [explodedX - offset, explodedY, explodedZ];
  if (dirKey === 'PY') return [explodedX, explodedY + offset, explodedZ];
  if (dirKey === 'NY') return [explodedX, explodedY - offset, explodedZ];
  return [explodedX, explodedY, explodedZ];
};

const IntroScene = ({ time, onComplete }) => {
  const cubieRefs = useRef([]);
  const { camera } = useThree();
  const size = 3;

  const [wormComplete, setWormComplete] = useState({});
  const [showBurst, setShowBurst] = useState({});
  const [burstTimes, setBurstTimes] = useState({});

  const explosionStart = 4;
  const explosionEnd = 6;
  const implodeStart = 9;
  const implodeEnd = 10;

  let explosionFactor = 0;
  if (time >= explosionStart && time < explosionEnd) {
    const t = (time - explosionStart) / (explosionEnd - explosionStart);
    const eased = t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
    explosionFactor = eased * 1.5;
  } else if (time >= explosionEnd && time < implodeStart) {
    explosionFactor = 1.5;
  } else if (time >= implodeStart && time < implodeEnd) {
    const t = (time - implodeStart) / (implodeEnd - implodeStart);
    const eased = 1 - (t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2);
    explosionFactor = eased * 1.5;
  }

  const wormStartTime = 7;

  // Generate all 9 worm paths (3x3 grid of antipodal pairs)
  const wormPaths = useMemo(() => {
    const paths = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const id = `${x}-${y}`;
        paths.push({
          id,
          start: getStickerWorldPos(x, y, size - 1, 'PZ', size, explosionFactor),
          end: getStickerWorldPos(x, y, 0, 'NZ', size, explosionFactor),
          color1: FACE_COLORS[1],
          color2: FACE_COLORS[4]
        });
      }
    }
    return paths;
  }, [explosionFactor]);

  const handleWormComplete = (id) => {
    if (!wormComplete[id]) {
      setWormComplete(prev => ({ ...prev, [id]: true }));
      setShowBurst(prev => ({ ...prev, [id]: true }));
      setBurstTimes(prev => ({ ...prev, [id]: time }));
      if (id === '1-1') { // Only play sound for center worm
        play('/sounds/flip.mp3');
        vibrate(20);
      }
    }
  };

  useFrame(() => {
    let radius = 12;
    let rotSpeed = 0.2;

    if (time < 2) {
      radius = 12;
      rotSpeed = 0.2;
    } else if (time >= 2 && time < 3) {
      const jitter = Math.sin(time * 50) * 0.3;
      radius = 12 + jitter;
    } else if (time >= 3 && time < 4) {
      const t = (time - 3);
      radius = 12 + t * 6;
    } else if (time >= 4 && time < 9) {
      radius = 22;
      rotSpeed = 0.15;
    } else if (time >= 9 && time < 10) {
      const t = (time - 9);
      radius = 22 - t * 10;
    } else {
      radius = 12;
      rotSpeed = 0.2;
    }

    const angle = time * rotSpeed;
    camera.position.x = Math.sin(angle) * radius;
    camera.position.z = Math.cos(angle) * radius;
    camera.position.y = 3;
    camera.lookAt(0, 0, 0);
  });

  const items = useMemo(() => {
    const k = (size - 1) / 2;
    const arr = [];
    let i = 0;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          arr.push({ key: i++, pos: [x - k, y - k, z - k] });
        }
      }
    }
    return arr;
  }, [size]);

  const tunnelOpacity = useMemo(() => {
    if (time < explosionStart) return 0;
    if (time >= explosionStart && time < explosionStart + 0.5) {
      return (time - explosionStart) / 0.5;
    }
    if (time >= implodeStart) {
      const t = (time - implodeStart) / (implodeEnd - implodeStart);
      return 1 - t * 0.7;
    }
    return 1;
  }, [time]);

  const tunnels = useMemo(() => {
    const k = (size - 1) / 2;
    const pairs = [];

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        pairs.push({
          id: `z-${x}-${y}`,
          start: getStickerWorldPos(x, y, size - 1, 'PZ', size, explosionFactor),
          end: getStickerWorldPos(x, y, 0, 'NZ', size, explosionFactor),
          color1: FACE_COLORS[1],
          color2: FACE_COLORS[4],
          group: 0
        });
      }
    }

    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        pairs.push({
          id: `x-${y}-${z}`,
          start: getStickerWorldPos(size - 1, y, z, 'PX', size, explosionFactor),
          end: getStickerWorldPos(0, y, z, 'NX', size, explosionFactor),
          color1: FACE_COLORS[5],
          color2: FACE_COLORS[2],
          group: 1
        });
      }
    }

    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        pairs.push({
          id: `y-${x}-${z}`,
          start: getStickerWorldPos(x, size - 1, z, 'PY', size, explosionFactor),
          end: getStickerWorldPos(x, 0, z, 'NY', size, explosionFactor),
          color1: FACE_COLORS[3],
          color2: FACE_COLORS[6],
          group: 2
        });
      }
    }

    return pairs;
  }, [explosionFactor, size]);

  const highlightedGroup = useMemo(() => {
    if (time >= 6.5 && time < 7.5) return 0;
    if (time >= 7.5 && time < 8.5) return 1;
    if (time >= 8.5 && time < 9.5) return 2;
    return -1;
  }, [time]);

  return (
    <group>
      {items.map((it, idx) => {
        const explodedPos = [
          it.pos[0] * (1 + explosionFactor * 1.8),
          it.pos[1] * (1 + explosionFactor * 1.8),
          it.pos[2] * (1 + explosionFactor * 1.8)
        ];
        return (
          <IntroCubie
            key={it.key}
            ref={el => (cubieRefs.current[idx] = el)}
            position={explodedPos}
            size={size}
            explosionFactor={explosionFactor}
          />
        );
      })}

      {time >= explosionStart && tunnels.map(t => (
        <IntroTunnel
          key={t.id}
          start={t.start}
          end={t.end}
          color1={t.color1}
          color2={t.color2}
          opacity={tunnelOpacity * (highlightedGroup === t.group ? 1 : highlightedGroup >= 0 ? 0.3 : 1)}
          groupId={t.group}
        />
      ))}

      {time >= wormStartTime && wormPaths.map(path => {
        const shouldShow = !wormComplete[path.id];
        return shouldShow ? (
          <WormParticle
            key={path.id}
            start={path.start}
            end={path.end}
            color1={path.color1}
            color2={path.color2}
            startTime={wormStartTime}
            currentTime={time}
            onComplete={() => handleWormComplete(path.id)}
          />
        ) : null;
      })}

      {wormPaths.map(path => {
        const burstTime = burstTimes[path.id];
        return showBurst[path.id] && burstTime && time < burstTime + 0.5 ? (
          <ArrivalBurst
            key={`burst-${path.id}`}
            position={path.end}
            color={path.color2}
            startTime={burstTime}
            currentTime={time}
          />
        ) : null;
      })}
    </group>
  );
};

export default IntroScene;
