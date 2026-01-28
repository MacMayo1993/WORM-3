import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import Cubie from './Cubie.jsx';
import DragGuide from './DragGuide.jsx';
import CursorHighlight from '../components/overlays/CursorHighlight.jsx';
import WormholeNetwork from '../manifold/WormholeNetwork.jsx';
import ChaosWave from '../manifold/ChaosWave.jsx';
import FlipPropagationWave from '../manifold/FlipPropagationWave.jsx';
import { vibrate } from '../utils/audio.js';

const CubeAssembly = ({
  size, cubies, onMove, onTapFlip, visualMode, animState, onAnimComplete,
  showTunnels, explosionFactor, cascades, onCascadeComplete, manifoldMap,
  cursor, showCursor, flipMode, onSelectTile, flipWaveOrigins, onFlipWaveComplete
}) => {
  const cubieRefs = useRef([]);
  const controlsRef = useRef();
  const { camera } = useThree();
  const [dragStart, setDragStart] = useState(null);
  const [activeDir, setActiveDir] = useState(null);

  const getBasis = () => {
    const f = new THREE.Vector3();
    camera.getWorldDirection(f).normalize();
    const r = new THREE.Vector3().crossVectors(camera.up, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, r).normalize();
    return { right: r, upScreen: u };
  };

  const normalFromEvent = e => {
    const n = (e?.face?.normal || new THREE.Vector3(0, 0, 1)).clone();
    const nm = new THREE.Matrix3().getNormalMatrix(e?.object?.matrixWorld ?? new THREE.Matrix4());
    n.applyNormalMatrix(nm).normalize();
    return n;
  };

  const sgn = v => v >= 0 ? 1 : -1;

  const mapSwipe = (faceN, dx, dy, isFaceTwist = false) => {
    // If face twist mode, rotate around the face normal itself
    if (isFaceTwist) {
      const ax = Math.abs(faceN.x), ay = Math.abs(faceN.y), az = Math.abs(faceN.z);
      const m = Math.max(ax, ay, az);
      let axis, twistDir;
      if (m === ax) { axis = 'col'; twistDir = -sgn(faceN.x) * sgn(dx); } // Flipped
      else if (m === ay) { axis = 'row'; twistDir = -sgn(faceN.y) * sgn(-dy); } // Flipped
      else { axis = 'depth'; twistDir = -sgn(faceN.z) * sgn(dx); } // Flipped
      return { axis, dir: twistDir };
    }
    // Normal slice rotation
    const { right, upScreen } = getBasis();
    const sw = new THREE.Vector3().addScaledVector(right, dx).addScaledVector(upScreen, dy); // Fixed: removed negative sign
    const t = sw.clone().projectOnPlane(faceN);
    if (t.lengthSq() < 1e-6) return null;
    const ra = new THREE.Vector3().crossVectors(t, faceN).normalize();
    const ax = Math.abs(ra.x), ay = Math.abs(ra.y), az = Math.abs(ra.z);
    if (ax >= ay && ax >= az) return { axis: 'col', dir: sgn(ra.x) };
    if (ay >= ax && ay >= az) return { axis: 'row', dir: sgn(ra.y) };
    return { axis: 'depth', dir: sgn(ra.z) };
  };

  const dirFromNormal = n => {
    const a = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)], m = Math.max(...a);
    if (m === a[0]) return n.x >= 0 ? 'PX' : 'NX';
    if (m === a[1]) return n.y >= 0 ? 'PY' : 'NY';
    return n.z >= 0 ? 'PZ' : 'NZ';
  };

  const onPointerDown = ({ pos, worldPos, event }) => {
    if (animState) return;
    // Prevent context menu on right click
    if (event.button === 2) event.preventDefault();
    setDragStart({
      pos, worldPos, event,
      screenX: event.clientX,
      screenY: event.clientY,
      n: normalFromEvent(event),
      shiftKey: event.shiftKey,
      isRightClick: event.button === 2 // Track right click
    });
    if (controlsRef.current) controlsRef.current.enabled = false;
  };

  useEffect(() => {
    const move = e => {
      if (!dragStart) return;
      const dx = e.clientX - dragStart.screenX, dy = e.clientY - dragStart.screenY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10)
        setActiveDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      else setActiveDir(null);
    };
    const up = e => {
      if (!dragStart) return;
      const dx = e.clientX - dragStart.screenX, dy = e.clientY - dragStart.screenY;
      const dist = Math.hypot(dx, dy);
      if (dist >= 10) {
        const m = mapSwipe(dragStart.n, dx, dy, dragStart.shiftKey); // Pass shiftKey for face twist
        if (m) onMove(m.axis, m.dir, dragStart.pos);
      } else {
        const dirKey = dirFromNormal(dragStart.n);
        if (dragStart.isRightClick) {
          // Right click = flip (only if flipMode is on)
          if (flipMode) onTapFlip(dragStart.pos, dirKey);
        } else {
          // Left click/tap behavior depends on flipMode
          if (flipMode) {
            // When flip mode is enabled, tap/left-click performs flip (mobile-friendly)
            onTapFlip(dragStart.pos, dirKey);
          } else {
            // When flip mode is disabled, tap/left-click selects tile
            if (onSelectTile) onSelectTile(dragStart.pos, dirKey);
          }
        }
      }
      setDragStart(null);
      setActiveDir(null);
      if (controlsRef.current) controlsRef.current.enabled = true;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragStart, onMove, onTapFlip, flipMode, onSelectTile]);

  useFrame((_, delta) => {
    if (!animState) return;
    const { axis, dir, sliceIndex, t } = animState;
    const speed = 2.52, newT = Math.min(1, (t ?? 0) + delta * speed);
    const ease = newT < 0.5 ? 4 * newT ** 3 : 1 - (-2 * newT + 2) ** 3 / 2;
    const prev = (t ?? 0) < 0.5 ? 4 * (t ?? 0) ** 3 : 1 - (-2 * (t ?? 0) + 2) ** 3 / 2;
    const dRot = (ease - prev) * (Math.PI / 2);
    const worldAxis = axis === 'col' ? new THREE.Vector3(1, 0, 0) : axis === 'row' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    const k = (size - 1) / 2;

    const expansionFactor = 1 + explosionFactor * 1.8;

    cubieRefs.current.forEach(g => {
      if (!g) return;
      const gx = Math.round(g.position.x / expansionFactor + k);
      const gy = Math.round(g.position.y / expansionFactor + k);
      const gz = Math.round(g.position.z / expansionFactor + k);
      const inSlice = (axis === 'col' && gx === sliceIndex) || (axis === 'row' && gy === sliceIndex) || (axis === 'depth' && gz === sliceIndex);
      if (inSlice) {
        g.position.applyAxisAngle(worldAxis, dRot * dir);
        g.rotateOnWorldAxis(worldAxis, dRot * dir);
      }
    });
    const wasComplete = (t ?? 0) >= 1;
    animState.t = newT;
    if (newT >= 1 && !wasComplete) { onAnimComplete(); vibrate(14); }
  });

  const k = (size - 1) / 2;
  const items = useMemo(() => {
    // Guard against size/cubies mismatch during size transitions
    if (cubies.length !== size) return [];
    const arr = []; let i = 0;
    for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) {
      arr.push({ key: i++, pos: [x - k, y - k, z - k], cubie: cubies[x][y][z] });
    }
    return arr;
  }, [cubies, size, k]);

  useEffect(() => {
    if (!animState) {
      items.forEach((it, idx) => {
        const g = cubieRefs.current[idx];
        if (g) {
          const exploded = [
            it.pos[0] * (1 + explosionFactor * 1.8),
            it.pos[1] * (1 + explosionFactor * 1.8),
            it.pos[2] * (1 + explosionFactor * 1.8)
          ];
          g.position.set(...exploded);
          g.rotation.set(0, 0, 0);
        }
      });
    }
  }, [animState, items, explosionFactor]);

  return (
    <group>
      <WormholeNetwork
        cubies={cubies}
        size={size}
        showTunnels={showTunnels}
        manifoldMap={manifoldMap}
        cubieRefs={cubieRefs.current}
      />
      {cascades.map(c => (
        <ChaosWave
          key={c.id}
          from={c.from}
          to={c.to}
          onComplete={() => onCascadeComplete(c.id)}
        />
      ))}
      {flipWaveOrigins && flipWaveOrigins.length > 0 && (
        <FlipPropagationWave
          origins={flipWaveOrigins}
          onComplete={onFlipWaveComplete}
        />
      )}
      {items.map((it, idx) => (
        <Cubie
          key={it.key}
          ref={el => (cubieRefs.current[idx] = el)}
          position={it.pos}
          cubie={it.cubie}
          size={size}
          visualMode={visualMode}
          onPointerDown={onPointerDown}
          explosionFactor={explosionFactor}
        />
      ))}
      {showCursor && cursor && (
        <CursorHighlight
          cursor={cursor}
          size={size}
          explosionFactor={explosionFactor}
        />
      )}
      {dragStart && !animState && <DragGuide position={dragStart.worldPos} activeDir={activeDir} />}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={5}
        maxDistance={28}
        enabled={!animState && !dragStart}
        enableDamping={true}
        dampingFactor={0.05}
        rotateSpeed={0.8}
        minPolarAngle={-Infinity}
        maxPolarAngle={Infinity}
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
      />
    </group>
  );
};

export default CubeAssembly;
