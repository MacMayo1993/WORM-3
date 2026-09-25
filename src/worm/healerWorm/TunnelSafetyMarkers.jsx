import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getWormStickerWorldPos } from '../wormExpansion.js';
import { isParityLocked } from './signatures.js';
import { WORMHOLE_MAX_TRAVERSALS } from './constants.js';

// Texture signs remain readable without bloom, particles, color vision or motion.
// Six batched draws for the whole board, with ordinary depth testing: far-side
// markers cannot show through the cube. Healing affordability lives in the HUD.
const LABELS = ['3 SAFE', '2 SAFE', '1 SAFE', 'FATAL', 'CLOSED', 'LOCKED'];
const dummy = new THREE.Object3D();
const cameraPosition = new THREE.Vector3();
const cameraQuaternion = new THREE.Quaternion();
let textures;
function signTextures() {
  if (textures) return textures;
  textures = LABELS.map((label, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = 384; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    const danger = index === 3 || index === 4;
    ctx.fillStyle = '#111722';
    ctx.fillRect(4, 4, 376, 152);
    ctx.strokeStyle = danger ? '#ffddd6' : index === 2 ? '#ffe49a' : '#ffffff';
    ctx.lineWidth = 9; ctx.strokeRect(9, 9, 366, 142);
    // A stop symbol for danger; discrete remaining-pass pips for safe tunnels.
    if (danger) {
      ctx.fillStyle = '#c52d31';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = Math.PI / 8 + i * Math.PI / 4;
        const x = 61 + Math.cos(angle) * 39, y = 80 + Math.sin(angle) * 39;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(36, 73, 50, 14);
    } else if (index < 3) {
      for (let i = 0; i < WORMHOLE_MAX_TRAVERSALS; i++) {
        ctx.fillStyle = i < WORMHOLE_MAX_TRAVERSALS - index ? '#ffffff' : '#434b5a';
        ctx.fillRect(35, 32 + i * 34, 48, 24);
      }
    } else {
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 64px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('—', 61, 80);
    }
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 49px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 234, 67);
    ctx.font = 'bold 23px Arial';
    ctx.fillText(danger ? 'DO NOT ENTER' : index === 5 ? 'WAIT TO ENTER' : 'PASSES LEFT', 234, 113);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
  return textures;
}

export default function TunnelSafetyMarkers({ positions, size, worm, cubies, voidTunnelKeysRef, tunnelUseCountsRef, hidden }) {
  const meshes = useRef([]);
  const counts = useRef(new Uint16Array(LABELS.length));
  const maps = useMemo(() => signTextures(), []);
  const capacity = 6 * size * size;
  useFrame(({ camera }) => {
    if (hidden) return;
    counts.current.fill(0);
    camera.getWorldPosition(cameraPosition);
    camera.getWorldQuaternion(cameraQuaternion);
    for (const tile of positions) {
      const wp = getWormStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size);
      const n = tile.normal;
      // Do not let a raised sign peek around a face turned away from the camera.
      if ((cameraPosition.x - wp[0]) * n.x + (cameraPosition.y - wp[1]) * n.y + (cameraPosition.z - wp[2]) * n.z <= 0) continue;
      const uses = tunnelUseCountsRef?.current?.get(tile.tunnelKey) ?? 0;
      const locked = isParityLocked({ signature: worm?.signature?.current }, tile, { getCubies: () => cubies });
      const index = locked ? 5 : voidTunnelKeysRef?.current?.has(tile.tunnelKey) ? 4 : Math.min(uses, WORMHOLE_MAX_TRAVERSALS);
      const mesh = meshes.current[index];
      if (!mesh) continue;
      dummy.position.set(...wp).addScaledVector(n, 1.05);
      dummy.quaternion.copy(cameraQuaternion);
      dummy.scale.set(1.05, 0.44, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(counts.current[index]++, dummy.matrix);
    }
    meshes.current.forEach((mesh, index) => {
      if (!mesh) return;
      mesh.count = counts.current[index];
      if (mesh.count) mesh.instanceMatrix.needsUpdate = true;
    });
  });
  return <group visible={!hidden}>{maps.map((map, index) =>
    <instancedMesh key={index} ref={mesh => { meshes.current[index] = mesh; }} count={0} args={[undefined, undefined, capacity]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </instancedMesh>
  )}</group>;
}
