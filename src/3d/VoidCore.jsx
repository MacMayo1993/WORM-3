/**
 * VoidCore
 *
 * The antipodal cube at the centre of the puzzle: a miniature of the play cube,
 * the same N×N, in which every tile shows its antipodal partner (see
 * antipodalCore.js). Tunnels dock on it tile by tile (tunnelDockInto): each one
 * dives into the core tile beneath its mouth, which shows where it leads,
 * crosses the centre and comes out of the core tile beneath its partner, which
 * shows where it came from. The miniature follows the live cubie meshes, so a
 * slice turn turns the same slice of the core.
 *
 * Flips flash the two core tiles their tunnel runs between and tint the glow;
 * the more of the network is alive, the brighter the corona. Once the cube is
 * opened (Explode, glass, gap, hollow) the core also lights the pieces around
 * it. It is opaque in every mode, so it hides the worm's crossing. Riding a
 * WORM tunnel, the core swells as the lens closes on it, anchored on the tile
 * the worm is diving into, then relaxes once the rider is through.
 *
 * For odd-sized cubes (3×3, 5×5) the centre cubie is skipped in CubeAssembly
 * so the core fills that space. For even sizes the origin is a gap between
 * cubies.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { isMobile } from '../utils/device.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { tunnelDockForCellInto } from '../utils/tunnelPath.js';
import { createPlayStickerGeometry } from './rubiksPiece.js';
import { liveRotation } from '../worm/liveRotation.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
import {
  CORE_DIRS, CORE_STICKER, CORE_STICKER_LOCAL,
  coreLayout, coreCubieMatrixInto, corePartnerColorId,
  coreZoomLimit, coreZoomAt,
  countFlippedStickers, networkCharge, interiorExposure,
  createCoreStickerMaterial, createCoreBodyMaterial, createCoreHaloMaterial
} from './antipodalCore.js';

const LIGHT_WARM = new THREE.Color('#ffe7c2');
const WHITE = new THREE.Color(1, 1, 1);
const _tint = new THREE.Color();
const _color = new THREE.Color();
const _cubie = new THREE.Matrix4();
const _sticker = new THREE.Matrix4();
const _lens = new THREE.Vector3();

function VoidCore({ cubieRefs = null }) {
  const cubies = useGameStore(s => s.cubies);
  const size = useGameStore(s => s.size);
  const wormMode = useGameStore(s => s.wormHealerMode);
  const settings = useGameStore(s => s.settings);

  const faceColors = useMemo(
    () => resolveColors(settings, settings?.biomeMode?.faceAssignment) || {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings?.colorScheme, settings?.biomeMode?.faceAssignment, settings?.customColors]
  );
  const layout = useMemo(() => coreLayout(size), [size]);
  const stickerAt = useMemo(
    () => new Map(layout.stickers.map((c, i) => [`${c.x},${c.y},${c.z},${c.dirKey}`, i])),
    [layout]
  );

  // Each core tile's partner colour, from a map of this very cube snapshot.
  const colors = useMemo(() => {
    const ready = cubies.length === size;
    const map = ready ? buildManifoldGridMap(cubies, size) : null;
    const rgb = new Float32Array(layout.stickers.length * 3);
    layout.stickers.forEach((cell, i) => {
      const id = ready ? corePartnerColorId(cubies, map, size, cell, findAntipodalStickerByGrid) : null;
      _color.set(faceColors[id] || '#888888').toArray(rgb, i * 3);
    });
    return { rgb, map };
  }, [cubies, size, layout, faceColors]);
  const charge = useMemo(() => networkCharge(countFlippedStickers(cubies)), [cubies]);

  const glow = useMemo(() => ({ value: 0.22 }), []);
  const parts = useMemo(() => ({
    body: new THREE.BoxGeometry(1, 1, 1),
    sticker: createPlayStickerGeometry(CORE_STICKER),
    halo: new THREE.PlaneGeometry(1, 1),
    bodyMaterial: createCoreBodyMaterial(isMobile),
    stickerMaterial: createCoreStickerMaterial(glow, isMobile),
    haloMaterial: createCoreHaloMaterial()
  }), [glow]);
  useEffect(() => () => Object.values(parts).forEach(p => p.dispose()), [parts]);

  const rootRef = useRef();
  const zoomRef = useRef();
  const bodiesRef = useRef();
  const stickersRef = useRef();
  const lightRef = useRef();
  const fx = useRef(null);
  if (!fx.current) {
    fx.current = {
      layoutDirty: true, flash: 0, flashTiles: [], tint: LIGHT_WARM.clone(), tintMix: 0,
      seenPulse: useGameStore.getState().flipPulse?.at ?? null,
      zoom: 1, rideId: null, through: false, limit: 1,
      dock: new THREE.Vector3(), normal: new THREE.Vector3()
    };
  }

  // Colours land with the cube state they belong to; the next frame re-lays
  // the matrices too, since a committed turn snaps the meshes back to rest.
  useLayoutEffect(() => {
    const mesh = stickersRef.current;
    if (!mesh) return;
    if (!mesh.instanceColor || mesh.instanceColor.count !== layout.stickers.length) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(layout.stickers.length * 3), 3);
    }
    mesh.instanceColor.array.set(colors.rgb);
    mesh.instanceColor.needsUpdate = true;
    fx.current.layoutDirty = true;
  }, [colors, layout]);

  const motionQuery = useMemo(() => (typeof window === 'undefined' ? null : window.matchMedia?.('(prefers-reduced-motion: reduce)')), []);

  useFrame(({ camera }, rawDt) => {
    const f = fx.current;
    const state = useGameStore.getState();
    const dt = Math.min(rawDt, 0.05);
    const still = !!(state.settings?.reducedMotion || motionQuery?.matches);
    const bodies = bodiesRef.current, stickers = stickersRef.current;
    if (!bodies || !stickers) return;

    // Follow the play cube's meshes while any slice moves (and just after, when
    // they snap back to rest); otherwise the core holds still for free.
    if (f.layoutDirty || liveRotation.active || state.animState) {
      f.layoutDirty = !!(liveRotation.active || state.animState); // one more pass after it ends
      layout.cells.forEach((cell, i) => {
        coreCubieMatrixInto(_cubie, cell.x, cell.y, cell.z, size, cubieRefs?.[cell.idx]?.quaternion);
        bodies.setMatrixAt(i, _cubie);
      });
      layout.stickers.forEach((s, i) => {
        bodies.getMatrixAt(s.cell, _cubie);
        stickers.setMatrixAt(i, _sticker.multiplyMatrices(_cubie, CORE_STICKER_LOCAL[s.dirKey]));
      });
      bodies.instanceMatrix.needsUpdate = true;
      stickers.instanceMatrix.needsUpdate = true;
    }

    // A new flip lights the two core tiles its tunnel runs between.
    const pulse = state.flipPulse;
    if (pulse && pulse.at !== f.seenPulse) {
      f.seenPulse = pulse.at;
      const last = state.moveHistory?.[state.moveHistory.length - 1];
      f.flashTiles = [];
      if (last?.type === 'flip' && last.timestamp === pulse.at && last.pos) {
        const { x, y, z } = last.pos;
        const own = stickerAt.get(`${x},${y},${z},${last.dirKey}`);
        if (own !== undefined) f.flashTiles.push(own);
        const sticker = cubies[x]?.[y]?.[z]?.stickers?.[last.dirKey];
        const loc = sticker && colors.map ? findAntipodalStickerByGrid(colors.map, sticker, size) : null;
        const other = loc ? stickerAt.get(`${loc.x},${loc.y},${loc.z},${loc.dirKey}`) : undefined;
        if (other !== undefined) f.flashTiles.push(other);
      }
      f.flash = 1;
      if (pulse.color) { f.tint.set(pulse.color); f.tintMix = 1; }
    }
    if (f.flash > 0) {
      f.flash = f.flash < 0.004 ? 0 : f.flash * Math.exp(-dt * 2.2);
      const rgb = stickers.instanceColor?.array;
      if (rgb) {
        for (const i of f.flashTiles) {
          _color.fromArray(colors.rgb, i * 3).lerp(WHITE, 0.75 * f.flash).toArray(rgb, i * 3);
        }
        stickers.instanceColor.needsUpdate = true;
      }
    }
    f.tintMix *= Math.exp(-dt * 1.2);
    glow.value = (wormMode ? 0.3 : 0.22) + f.flash * 0.25;

    // The approach zoom: while a WORM ride closes on the core, grow it about the
    // tile the worm is diving into, then let it go once the rider is through.
    let zoomTarget = 1;
    const ride = tunnelState.tunnel;
    if (wormMode && !still && tunnelState.active && ride?.entry && rootRef.current) {
      if (f.rideId !== tunnelState.activeTunnelId) {
        const { entry } = ride;
        f.rideId = tunnelState.activeTunnelId;
        f.through = false;
        tunnelDockForCellInto(f.dock, entry.x, entry.y, entry.z, entry.dirKey, size);
        f.normal.fromArray(CORE_DIRS[entry.dirKey] || CORE_DIRS.PY);
        f.limit = coreZoomLimit(f.dock, size);
      }
      rootRef.current.worldToLocal(_lens.copy(camera.position));
      const height = _lens.sub(f.dock).dot(f.normal);
      if (height <= 0) f.through = true;
      const release = THREE.MathUtils.smoothstep(tunnelState.t, 0.62, 0.8);
      zoomTarget = coreZoomAt(f.through ? 0 : height, f.limit, size, release);
    } else {
      f.rideId = null;
    }
    f.zoom += (zoomTarget - f.zoom) * (1 - Math.exp(-dt * 10));
    if (Math.abs(f.zoom - 1) < 1e-4 && zoomTarget === 1) f.zoom = 1;
    tunnelState.coreZoom = wormMode ? f.zoom : 1;
    if (zoomRef.current) {
      zoomRef.current.scale.setScalar(f.zoom);
      zoomRef.current.position.copy(f.dock).multiplyScalar(1 - f.zoom);
    }

    const energy = 0.35 + 0.65 * charge;
    _tint.copy(LIGHT_WARM).lerp(f.tint, 0.65 * f.tintMix);
    const halo = parts.haloMaterial.uniforms;
    halo.uColor.value.copy(_tint);
    halo.uSize.value = (1.0 + 0.8 * charge + 0.3 * f.flash) * f.zoom;
    halo.uIntensity.value = wormMode ? 0 : (0.18 + 0.35 * energy) * (1 + f.flash * 1.5);

    const light = lightRef.current;
    if (light) {
      const exposure = wormMode || state.perfReducedFX ? 0 : interiorExposure(state);
      light.color.copy(_tint);
      light.intensity = exposure * (0.5 + 1.1 * energy) * (1 + f.flash * 1.5);
    }
  });

  return (
    <group ref={rootRef} name="antipodal-core">
      <group ref={zoomRef}>
        <instancedMesh
          key={`bodies-${size}`}
          name="antipodal-core-body"
          frustumCulled={false}
          ref={bodiesRef}
          args={[parts.body, parts.bodyMaterial, layout.cells.length]}
        />
        <instancedMesh
          key={`stickers-${size}`}
          name="antipodal-core-stickers"
          frustumCulled={false}
          ref={stickersRef}
          args={[parts.sticker, parts.stickerMaterial, layout.stickers.length]}
        />
        {!wormMode && <mesh name="antipodal-core-halo" geometry={parts.halo} material={parts.haloMaterial} frustumCulled={false} />}
      </group>
      {/* Mounted in every mode (dark in WORM) so switching modes never changes
          the scene's light count and recompiles every lit material. No distance
          decay: the core sits a hair from the pieces around its own slot, and a
          physical 1/d² falloff would blow those out while barely reaching the
          rest. This lights them evenly, then fades at the edge. */}
      {!isMobile && <pointLight name="antipodal-core-light" ref={lightRef} intensity={0} distance={4.5} decay={0} />}
    </group>
  );
}

export default VoidCore;
