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
 * an exposed core sits in a dark antiverse with a bowed lattice and ± light
 * pairs. The more of the network is alive, the brighter that field. Once the cube is
 * opened (Explode, glass, gap, hollow) the core also lights the pieces around
 * it. Its shell stays opaque, with real openings along the occupied WORM
 * passage. The core swells as the lens closes on it, anchored on the entry
 * tile, while the cutouts stay on the rider's simulation route.
 *
 * For odd-sized cubes (3×3, 5×5) the centre cubie is skipped in CubeAssembly
 * so the core fills that space. For even sizes the origin is a gap between
 * cubies.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { isMobile } from '../utils/device.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { tunnelDockForCellInto, tunnelCoreScale } from '../utils/tunnelPath.js';
import { createPlayStickerGeometry } from './rubiksPiece.js';
import { CLASSIC_BODY_SIZE } from './cubeViewStyles.js';
import { createCoreTileStyle } from './coreTileStyle.js';
import { withPortalCutout } from './portalCutout.js';
import { makeCorePassage, updateCorePassage, coreRoomCutoutGLSL, CORE_MIRROR_HALF, coreOpeningRadius } from './corePassage.js';
import { createCoreReflection, createCoreMirrorRoom } from './coreMirrorRoom.js';
import { wormExpansion, currentExplosion } from '../worm/wormExpansion.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { getViewPowerDef } from '../worm/healerWorm/viewPowerups.js';
import { createAntiverse, antiverseVisibility } from './antiverse.js';
import { liveRotation } from '../worm/liveRotation.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
import {
  CORE_DIRS, CORE_STICKER, CORE_STICKER_LOCAL,
  coreLayout, coreCubieMatrixInto, corePartnerColorId,
  coreZoomLimit, coreZoomAt, CORE_HALF,
  countFlippedStickers, networkCharge, interiorExposure,
  createCoreStickerMaterial, createCoreBodyMaterial
} from './antipodalCore.js';

const LIGHT_BASE = new THREE.Color('#9aacc8');
const WHITE = new THREE.Color(1, 1, 1);
const _tint = new THREE.Color();
const _color = new THREE.Color();
const _cubie = new THREE.Matrix4();
const _sticker = new THREE.Matrix4();
const _lens = new THREE.Vector3();
const HIDDEN_STICKER = new THREE.Matrix4().makeScale(0, 0, 0);

function VoidCore({ cubieRefs = null }) {
  const cubies = useGameStore(s => s.cubies);
  const size = useGameStore(s => s.size);
  const wormMode = useGameStore(s => s.wormHealerMode);
  const settings = useGameStore(s => s.settings);
  const visualMode = useGameStore(s => s.visualMode);
  const wormViewPower = useGameStore(s => s.wormViewPower);
  const mode = (wormMode ? getViewPowerDef(wormViewPower)?.view : null) ?? visualMode;

  const faceColors = useMemo(
    () => resolveColors(settings, settings?.biomeMode?.faceAssignment) || {},
    [settings]
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
    const ids = [];
    layout.stickers.forEach((cell, i) => {
      const id = ready ? corePartnerColorId(cubies, map, size, cell, findAntipodalStickerByGrid) : null;
      ids.push(id);
      _color.set(faceColors[id] || '#888888').toArray(rgb, i * 3);
    });
    return { rgb, map, ids };
  }, [cubies, size, layout, faceColors]);
  const charge = useMemo(() => networkCharge(countFlippedStickers(cubies)), [cubies]);

  const glow = useMemo(() => ({ value: 0.08 }), []);
  const passage = useMemo(() => makeCorePassage(), []);
  const parts = useMemo(() => ({
    body: new THREE.BoxGeometry(CLASSIC_BODY_SIZE, CLASSIC_BODY_SIZE, CLASSIC_BODY_SIZE),
    sticker: createPlayStickerGeometry(CORE_STICKER),
    bodyMaterial: withPortalCutout(createCoreBodyMaterial(isMobile, mode), passage.uniforms, coreRoomCutoutGLSL, 'core-room', true),
    stickerMaterial: withPortalCutout(createCoreStickerMaterial(glow, isMobile), passage.uniforms, coreRoomCutoutGLSL, 'core-room', true)
  }), [glow, mode, passage]);
  useEffect(() => () => Object.values(parts).forEach(p => p.dispose()), [parts]);
  const antiverse = useMemo(() => createAntiverse(size), [size]);
  useEffect(() => () => antiverse.dispose(), [antiverse]);
  const reflection = useMemo(() => wormMode ? createCoreReflection(cubies, size, faceColors) : null, [wormMode, cubies, size, faceColors]);
  useEffect(() => () => reflection?.dispose(), [reflection]);
  const mirrors = useMemo(() => createCoreMirrorRoom(size, passage.uniforms, null), [size, passage]);
  useLayoutEffect(() => {
    mirrors.material.envMap = reflection;
    mirrors.material.needsUpdate = true;
  }, [mirrors, reflection]);
  useEffect(() => () => mirrors.dispose(), [mirrors]);
  useLayoutEffect(() => {
    antiverse.uniforms.uPalette.value.forEach((color, i) => color.set(faceColors[i + 1]));
  }, [antiverse, faceColors]);

  // At most six style batches, never one mesh per inner tile. Plain stickers
  // keep the original single draw; patterned faces use the equipped shader.
  const appearances = useMemo(() => {
    const byColor = new Map();
    for (let id = 1; id <= 6; id++) {
      const style = mode === 'glass' ? 'glass' : settings?.manifoldStyles?.[id] || 'solid';
      if (style === 'solid') continue;
      const key = `${id}-${style}`;
      byColor.set(id, {
        key, id, style,
        geometry: new THREE.PlaneGeometry(CORE_STICKER, CORE_STICKER, style === 'eyeball' ? 12 : 1, style === 'eyeball' ? 12 : 1),
        material: withPortalCutout(createCoreTileStyle(style, faceColors[id], faceColors[ANTIPODAL_COLOR[id]], tunnelCoreScale(size)),
          passage.uniforms, coreRoomCutoutGLSL, 'core-room', true)
      });
    }
    return byColor;
  }, [settings, mode, faceColors, size, passage]);
  useEffect(() => () => appearances.forEach(b => { b.geometry.dispose(); b.material.dispose(); }), [appearances]);
  const styled = useMemo(() => {
    const groups = new Map(), slots = new Set();
    colors.ids.forEach((id, i) => {
      const appearance = appearances.get(id);
      if (!appearance) return;
      if (!groups.has(id)) groups.set(id, { ...appearance, indices: [] });
      groups.get(id).indices.push(i); slots.add(i);
    });
    return { batches: [...groups.values()], slots };
  }, [colors, appearances]);
  const styledRefs = useRef(new Map());
  const syncStyledColors = useCallback(() => {
    const rgb = stickersRef.current?.instanceColor?.array;
    if (!rgb) return;
    for (const batch of styled.batches) {
      const mesh = styledRefs.current.get(batch.key);
      if (!mesh) continue;
      batch.indices.forEach((index, slot) => mesh.setColorAt(slot, _color.fromArray(rgb, index * 3)));
      mesh.instanceColor.needsUpdate = true;
    }
  }, [styled]);

  const rootRef = useRef();
  const zoomRef = useRef();
  const bodiesRef = useRef();
  const stickersRef = useRef();
  const lightRef = useRef();
  const fx = useRef(null);
  if (!fx.current) {
    fx.current = {
      layoutDirty: true, flash: 0, flashTiles: [], tint: LIGHT_BASE.clone(), tintMix: 0,
      seenPulse: useGameStore.getState().flipPulse?.at ?? null,
      zoom: 1, rideId: null, through: false, inside: false, departed: false, release: 0, limit: 1,
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
    syncStyledColors();
    fx.current.layoutDirty = true;
  }, [colors, layout, syncStyledColors]);

  const motionQuery = useMemo(() => (typeof window === 'undefined' ? null : window.matchMedia?.('(prefers-reduced-motion: reduce)')), []);

  useFrame(({ camera, gl }, rawDt) => {
    const f = fx.current;
    const state = useGameStore.getState();
    const dt = Math.min(rawDt, 0.05);
    const still = !!(state.settings?.reducedMotion || motionQuery?.matches);
    const bodies = bodiesRef.current, stickers = stickersRef.current;
    if (!bodies || !stickers) return;
    // World-space cuts follow the simulation, not the cosmetic core zoom. Both
    // entry and exit remain clear as the enlarged core moves across the route.
    updateCorePassage(passage, wormMode ? tunnelState.portalTunnel ?? (tunnelState.active ? tunnelState.tunnel : null) : null,
      size, wormExpansion.amount);

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
        stickers.setMatrixAt(i, styled.slots.has(i) ? HIDDEN_STICKER : _sticker.multiplyMatrices(_cubie, CORE_STICKER_LOCAL[s.dirKey]));
      });
      for (const batch of styled.batches) {
        const mesh = styledRefs.current.get(batch.key);
        if (!mesh) continue;
        batch.indices.forEach((index, slot) => {
          const s = layout.stickers[index];
          bodies.getMatrixAt(s.cell, _cubie);
          mesh.setMatrixAt(slot, _sticker.multiplyMatrices(_cubie, CORE_STICKER_LOCAL[s.dirKey]));
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
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
        syncStyledColors();
      }
    }
    f.tintMix *= Math.exp(-dt * 1.2);
    glow.value = (wormMode ? 0.12 : 0.08) + f.flash * 0.25;

    // The approach zoom: while a WORM ride closes on the core, grow it about the
    // tile the worm is diving into, then let it go once the rider is through.
    let zoomTarget = 1;
    const ride = tunnelState.tunnel;
    if (wormMode && !still && tunnelState.active && ride?.entry && rootRef.current) {
      if (f.rideId !== tunnelState.activeTunnelId) {
        const { entry } = ride;
        f.rideId = tunnelState.activeTunnelId;
        f.through = false;
        f.inside = false; f.departed = false; f.release = 0;
        tunnelDockForCellInto(f.dock, entry.x, entry.y, entry.z, entry.dirKey, size);
        f.normal.fromArray(CORE_DIRS[entry.dirKey] || CORE_DIRS.PY);
        f.limit = coreZoomLimit(f.dock, size);
      }
      rootRef.current.worldToLocal(_lens.copy(camera.position));
      const height = _lens.dot(f.normal) - f.dock.dot(f.normal);
      if (height <= 0) f.through = true;
      _lens.addScaledVector(f.dock, f.zoom - 1);
      const inside = Math.max(Math.abs(_lens.x), Math.abs(_lens.y), Math.abs(_lens.z)) < CORE_HALF * f.zoom;
      if (inside) f.inside = true;
      else if (f.inside) f.departed = true;
      if (f.departed) f.release = Math.min(1, f.release + dt / .55);
      // The head is well ahead of the lens. Keep the room open until the
      // camera itself leaves, instead of shrinking it around the following view.
      zoomTarget = coreZoomAt(f.through ? 0 : height, f.limit, size, f.release);
    } else {
      f.rideId = null;
    }
    f.zoom += (zoomTarget - f.zoom) * (1 - Math.exp(-dt * 10));
    if (Math.abs(f.zoom - 1) < 1e-4 && zoomTarget === 1) f.zoom = 1;
    tunnelState.coreZoom = wormMode ? f.zoom : 1;
    tunnelState.coreZoomAnchor = f.dock;
    if (zoomRef.current) {
      zoomRef.current.scale.setScalar(f.zoom);
      zoomRef.current.position.copy(f.dock).multiplyScalar(1 - f.zoom);
    }
    passage.uniforms.uPassageRadius.value = coreOpeningRadius(size, f.zoom);
    mirrors.group.visible = wormMode && passage.uniforms.uPassageOpen.value > .5;
    // Clear the plastic a little behind the mirrors so their surfaces cannot z-fight.
    passage.uniforms.uCoreRoomHalf.value = mirrors.group.visible ? (CORE_MIRROR_HALF + .001) * f.zoom : 0;
    passage.uniforms.uCoreRoomCenter.value.copy(f.dock).multiplyScalar(1 - f.zoom);

    const energy = 0.35 + 0.65 * charge;
    _tint.copy(LIGHT_BASE).lerp(f.tint, 0.65 * f.tintMix);
    const universe = antiverse.uniforms;
    const opacity = antiverseVisibility(state, f.zoom, currentExplosion(state));
    antiverse.group.visible = opacity > 0;
    antiverse.points.visible = !state.perfReducedFX;
    if (opacity > 0) {
      if (!still && !state.perfReducedFX) universe.uTime.value += dt;
      universe.uOpacity.value = opacity;
      universe.uEnergy.value = 0.8 + 0.4 * charge + (still ? 0 : f.flash * 0.3);
      universe.uPixelRatio.value = Math.min(2, gl.getPixelRatio?.() || 1);
    }

    const light = lightRef.current;
    if (light) {
      const exposure = wormMode || state.perfReducedFX ? 0 : interiorExposure(state);
      light.color.copy(_tint);
      light.intensity = exposure * (0.5 + 1.1 * energy) * (1 + f.flash * 1.5);
    }
  }, -0.25); // publish the core pose before its attached ribbons/cords update

  return (
    <group ref={rootRef} name="antipodal-core">
      <group ref={zoomRef}>
        <primitive object={mirrors.group} dispose={null} />
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
          visible={styled.slots.size < layout.stickers.length}
          frustumCulled={false}
          ref={stickersRef}
          args={[parts.sticker, parts.stickerMaterial, layout.stickers.length]}
        />
        {styled.batches.map(batch => <instancedMesh key={`${size}-${batch.key}`}
          name={`antipodal-core-style-${batch.key}`} frustumCulled={false}
          ref={mesh => { if (mesh) styledRefs.current.set(batch.key, mesh); else styledRefs.current.delete(batch.key); }}
          args={[batch.geometry, batch.material, batch.indices.length]} />)}
      </group>
      <primitive object={antiverse.group} dispose={null} />
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
