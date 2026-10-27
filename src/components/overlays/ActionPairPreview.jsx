import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Matrix4 } from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, selectEffectiveFlipCap } from '../../hooks/useGameStore.js';
import { getManifoldMap } from '../../game/manifoldMapStore.js';
import { actionPair, cursorTile } from '../../game/actionPair.js';
import { ACTION_CUES } from '../../game/actionCues.js';
import { inspectionSurfaces } from '../../3d/inspectionBridge.js';

function PairRings({ pair }) {
  const root = useRef(), refs = useRef([]), anchors = useRef([]);
  const inverse = useMemo(() => new Matrix4(), []);
  useFrame(() => {
    if (!root.current) return;
    root.current.updateWorldMatrix(true, false);
    inverse.copy(root.current.matrixWorld).invert();
    pair.ids.forEach((id, index) => {
      // Cache live sticker anchors; re-resolve only when a tile remounts or the
      // selected pair changes. At most two markers, independent of cube size.
      let anchor = anchors.current[index];
      if (inspectionSurfaces.get(anchor) !== id) {
        anchor = null;
        for (const [object, gridId] of inspectionSurfaces) if (gridId === id) { anchor = object; break; }
        anchors.current[index] = anchor;
      }
      const marker = refs.current[index];
      if (!marker) return;
      marker.visible = !!anchor;
      if (anchor) {
        anchor.updateWorldMatrix(true, false);
        marker.matrix.multiplyMatrices(inverse, anchor.matrixWorld);
        marker.matrixWorldNeedsUpdate = true;
      }
    });
  });
  const cue = pair.available ? ACTION_CUES.link : ACTION_CUES.danger;
  return <group ref={root} name="action-linked-pair">
    {pair.ids.map((id, i) => <group key={id} ref={node => { refs.current[i] = node; }} matrixAutoUpdate={false} visible={false}>
      {[0.35, 0.43].map(radius => <mesh key={radius} position={[0, 0, 0.055]} raycast={() => null}>
        <ringGeometry args={[radius, radius + 0.025, pair.available ? 32 : 3]} />
        <meshBasicMaterial color={cue.color} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>)}
    </group>)}
  </group>;
}

function SelectedPair({ focus }) {
  const s = useGameStore(useShallow(s => ({ cubies: s.cubies, size: s.size, epoch: s.rotationEpoch,
    cursor: s.cursor, cap: selectEffectiveFlipCap(s) })));
  const pair = useMemo(() => actionPair(s.cubies, s.size, getManifoldMap(s.cubies, s.size, s.epoch),
    focus ?? cursorTile(s.cursor, s.size), s.cap), [s.cubies, s.size, s.epoch, s.cursor, s.cap, focus]);
  return pair ? <PairRings pair={pair} /> : null;
}

export default function ActionPairPreview() {
  const focus = useGameStore(s => s.currentLevelData?.actionFocus);
  const selected = useGameStore(s => s.showCursor && s.flipMode);
  const hidden = useGameStore(s => s.wormHealerMode || s.showMainMenu || s.victory || s.showWelcome);
  return !hidden && (focus || selected) ? <SelectedPair focus={focus} /> : null;
}
