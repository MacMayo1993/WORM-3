import { Line2, LineSegments2, LineGeometry, LineSegmentsGeometry, LineMaterial } from 'three-stdlib';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createFlipBurstWarmupMeshes } from '../../3d/flipBurstShaders.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { createStickerPortalWarmupMaterials } from '../../3d/stickerPortalShaders.js';
import { createMobiusWarmupMaterials } from '../../manifold/mobiusTunnelShaders.js';
import { pickupWarmupMeshes } from './pickupMaterials.js';
import { usePickupPool } from './usePickupMaterials.js';
import { exteriorPortalWarmupMaterial } from '../../3d/exteriorPortals.js';
import { createTileBoundaryWarmupMeshes } from '../../3d/tileBoundaryMaterials.js';
import { stickerWormBodyMaterial, stickerWormGlowMaterial } from '../../3d/stickerWormMaterials.js';
import { healthBarMaterial } from '../../3d/disparityHealthBarMaterial.js';
import { healSealMaterial, healParticleMaterial } from '../../3d/healEffectMaterials.js';
import { rubiksFinish } from '../../3d/rubiksPiece.js';
import { bodyMaterialProps } from '../../3d/cubeViewStyles.js';
import { rimFragmentShader, rimVertexShader } from '../../teach/LayerHighlight.jsx';
import { elementalWarmupObjects } from './elementalWarmup.js';
import { ELEMENTAL_TYPES } from './elementalDefs.js';
import { elementalOrbMaterials } from './elementalOrbMaterials.js';
import { warmOrbReveal } from '../orbReveal.js';
import { warmCautionDissolve } from './cautionDissolve.js';
import { compileOffscreen } from '../../3d/mirrorSubjects.js';
import { compileDistinct } from '../../3d/compileDistinct.js';
import { isMobile, prefersReducedMotion } from '../../utils/device.js';
import { getTileStyleMaterial, getGlassMaterial } from '../../3d/styles/TileStyleMaterials.jsx';
import { LEGO_STUD_PARTS } from '../../3d/legoStud.js';
import { ensureInstanceColor } from '../../3d/instanceUploads.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import { ANTIPODAL_COLOR } from '../../utils/constants.js';
import { wormDemoActive } from '../../game/wormDemoState.js';

// What a lit program's key reads from the scene (environment, fog, shadows, tone
// mapping, colour space) plus the worm's look; `tier` adds the quality tier, which
// some effects read and the worm's own materials never do.
const programKey = (gl, scene, s, tier) => [scene.environment?.uuid, scene.environment?.version,
  scene.fog ? (scene.fog.isFogExp2 ? 'exp2' : 'linear') : 'none', gl.shadowMap.enabled, gl.shadowMap.type,
  tier ? s.perfReducedFX : '-', s.wormCharacter, s.wormSkin, gl.toneMapping, gl.outputColorSpace].join('|');

// Styled tiles at rest are drawn by the tile-surface batches (instancedTileStyle.js),
// so the live scene holds none of the programs a styled tile's own mesh uses: the
// style the flip swaps in, and its portal-bored copy once the exterior patches it.
// A carrier per equipped style (and per view-power look below), for the run's
// warm-up; the bored copies are owned here (their sources belong to the style cache
// and legoStud.js) and keep those programs alive.
function styleWarmup(settings) {
  const warm = new THREE.Scene(), geometry = new THREE.PlaneGeometry(.1, .1), bored = [];
  const colors = resolveColors(settings, settings?.biomeMode?.faceAssignment) ?? {};
  const seen = new Set();
  for (let face = 1; face <= 6; face++) {
    const style = settings?.manifoldStyles?.[face];
    if (!style || style === 'solid') continue;
    const source = getTileStyleMaterial(style, colors[face] ?? '#888888', false, null, colors[ANTIPODAL_COLOR[face]] ?? null);
    warm.add(new THREE.Mesh(geometry, source));
    if (seen.has(style)) continue;
    seen.add(style);
    const material = exteriorPortalWarmupMaterial(source);
    bored.push(material);
    warm.add(new THREE.Mesh(geometry, material));
  }
  // The Glass and LEGO view powers swap every tile to looks the run never drew:
  // each sticker's glass clone (both passes of the double-sided front, and the
  // back), and the shared LEGO stud batches. Held here, their programs outlive the
  // swap; the glass clones are freed on restore and used to take them with them.
  // The glass back draws its bare program as well as the bored one.
  const glassSource = getGlassMaterial('#888888'), glass = exteriorPortalWarmupMaterial(glassSource);
  bored.push(glass);
  warm.add(new THREE.Mesh(geometry, glassSource), new THREE.Mesh(geometry, glass));
  const studs = LEGO_STUD_PARTS.map(part => {
    const material = exteriorPortalWarmupMaterial(part.material);
    bored.push(material);
    const mesh = new THREE.InstancedMesh(part.geometry, material, 1);
    ensureInstanceColor(mesh);
    return mesh;
  });
  warm.add(...studs);
  return { warm, dispose: () => { warm.clear(); geometry.dispose(); studs.forEach(mesh => mesh.dispose()); bored.forEach(material => material.dispose()); } };
}

// Keep one owner of each transient program for this WORM session. Real portal
// materials still have private uniforms and their normal disposal; only the
// compiled programs are shared, so one tunnel cannot recolour another.
export default function WormEffectWarmup({ body }) {
  const { gl, camera, scene } = useThree();
  const pool = usePickupPool(), resources = useRef(null), warmed = useRef(null), sceneWarmed = useRef(null);
  const fall = useRef({ key: null, dispose: null }), fallKey = useRef(null);
  useEffect(() => () => fall.current.dispose?.(), []);
  const styles = useRef({ key: null, warmup: null });
  useEffect(() => () => styles.current.warmup?.dispose(), []);
  useEffect(() => {
    const materials = [...createStickerPortalWarmupMaterials(), ...createMobiusWarmupMaterials()];
    const geometry = new THREE.PlaneGeometry(.1, .1), warm = new THREE.Scene();
    // Tally strokes and the raised cubie's coloured edge outline use drei Line.
    const lines = [false, true].map(vertexColors => {
      const lineGeometry = vertexColors ? new LineSegmentsGeometry() : new LineGeometry();
      lineGeometry.setPositions([0, 0, 0, .1, 0, 0]);
      if (vertexColors) lineGeometry.setColors([1, 1, 1, 1, 1, 1]);
      const material = new LineMaterial({ transparent: true, vertexColors });
      return vertexColors ? new LineSegments2(lineGeometry, material) : new Line2(lineGeometry, material);
    });
    const flips = [...createFlipBurstWarmupMeshes(geometry), ...lines];
    const shaderMeshes = materials.map(material => new THREE.Mesh(geometry, material));
    materials.push(...flips.map(mesh => mesh.material));
    // Everything under the cube's exterior is drawn with the portal bore patched in
    // (exteriorPortals.js), which is a different program. The tile effects, flip
    // bursts and edge lines mount there on the first flip, together with the raised
    // tile's border, sticker and see-through body; warm those variants too, or the
    // first tunnel of every run links them all in one frame.
    const rgba = geometry.clone().setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(16).fill(1), 4));
    const ownedRaised = [
      new THREE.Mesh(geometry, isMobile ? new THREE.MeshStandardMaterial({ ...rubiksFinish(true).sticker, envMapIntensity: 0.3 })
        : new THREE.MeshPhysicalMaterial({ ...rubiksFinish(false).sticker, envMapIntensity: 0.3 })),
      new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ ...bodyMaterialProps('neon'), transparent: true, opacity: 0.16,
        depthWrite: false, side: THREE.DoubleSide })),
    ];
    // Module-level materials, never disposed here: borders, a flipped tile's ghost
    // worms and its flip-life bar, and the heal's seal and sparks, which a resting
    // tile no longer carries hidden (tileFrames.js), so the live scene lacks them.
    const sharedRaised = [...createTileBoundaryWarmupMeshes(), new THREE.Mesh(geometry, stickerWormBodyMaterial),
      new THREE.Mesh(rgba, stickerWormGlowMaterial), new THREE.Mesh(geometry, healthBarMaterial),
      new THREE.Mesh(geometry, healSealMaterial), new THREE.InstancedMesh(geometry, healParticleMaterial, 1)];
    const raised = [...ownedRaised, ...sharedRaised];
    const bored = [...shaderMeshes, ...flips, ...raised].map(source => {
      const mesh = source.clone();
      mesh.material = exteriorPortalWarmupMaterial(source.material);
      return mesh;
    });
    materials.push(...ownedRaised.map(mesh => mesh.material), ...bored.map(mesh => mesh.material));
    // The slice-warning rim mounts with each warning and unmounts after the turn;
    // holding its programs here keeps every warning after the first from relinking.
    const rims = [[false, false], [true, false], [true, true]].map(([lite, occluded]) => new THREE.ShaderMaterial({
      vertexShader: rimVertexShader, fragmentShader: rimFragmentShader(lite, occluded),
      side: occluded ? THREE.DoubleSide : THREE.FrontSide,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    materials.push(...rims);
    const meshes = [...pickupWarmupMeshes(pool.warm, geometry), ...flips, ...raised, ...bored,
      ...rims.map(material => new THREE.Mesh(geometry, material)), ...elementalWarmupObjects(geometry)];
    warm.add(...shaderMeshes, ...meshes);
    resources.current = warm; warmed.current = null;
    return () => {
      resources.current = null; warm.clear(); geometry.dispose(); rgba.dispose();
      lines.forEach(line => line.geometry.dispose());
      // Elemental and tile-border materials are module-owned; only their carriers go.
      meshes.forEach(mesh => { if (mesh.isInstancedMesh) mesh.dispose(); });
      materials.forEach(material => material.dispose());
    };
  }, [pool]);

  // Runs after the body's frame, when instance colours/skin defines exist.
  // Loading the environment or changing the quality tier changes program keys;
  // warm that variant too and retain earlier variants for a return to the tier.
  useFrame(() => {
    if (!resources.current || !body.current) return;
    const s = useGameStore.getState();
    const key = programKey(gl, scene, s, true);
    if (warmed.current === key) return;
    // The caution fall's key (below) is this one without the tier, so it can only
    // change when this one does.
    fallKey.current = programKey(gl, scene, s, false);
    // A fresh live Line starts without this define, including after a quality
    // change. Reset before each warm-up so that variant retains its first key.
    resources.current.traverse(object => {
      if (object.material?.isLineMaterial) delete object.material.defines.USE_LINE_COLOR_ALPHA;
    });
    gl.compile(resources.current, camera, scene);
    // three-stdlib LineMaterial adds USE_LINE_COLOR_ALPHA in onBeforeCompile,
    // after r159 computes its first cache key. Retain both the initial and
    // settled key so subsequent live Line mounts can reuse either program.
    gl.compile(resources.current, camera, scene);
    gl.compile(body.current, camera, scene);
    // An offering's first arrival used to link its whole dissolve set in one frame.
    // Best effort: the orb's sprites are canvas textures, and without a 2D canvas
    // the first spawn simply compiles them as it always did.
    try { warmOrbReveal(gl, camera, scene, ELEMENTAL_TYPES.flatMap(elementalOrbMaterials), prefersReducedMotion()); }
    catch { /* no 2D canvas */ }
    warmed.current = key;
    sceneWarmed.current = null;
  });

  // Pooled effects that already sit hidden in the scene (pad energy, burrows,
  // wormhole rings, combat rigs) compile on their first appearance otherwise.
  // Compile the live scene once per run and look, while the board is still
  // scrambling or behind a story briefing; never in the middle of play.
  useFrame(() => {
    if (warmed.current === null) return;
    const s = useGameStore.getState();
    const storyBriefing = s.wormStoryLevel && s.wormStoryReady && !s.wormStoryStarted;
    if (s.wormGamePhase !== 'scrambling' && !storyBriefing) return;
    const key = `${warmed.current}|${s.wormRunId}|${s.size}`;
    if (sceneWarmed.current === key) return;
    sceneWarmed.current = key;
    // One stand-in per program variant: the full walk was ~130 ms on a 15×15.
    compileDistinct(gl, scene, camera, scene);
    const styleKey = JSON.stringify([s.settings?.manifoldStyles, s.settings?.colorScheme, s.settings?.customColors]);
    if (styles.current.key !== styleKey) {
      styles.current.warmup?.dispose();
      styles.current = { key: styleKey, warmup: styleWarmup(s.settings) };
    }
    gl.compile(styles.current.warmup.warm, camera, scene);
    // Desktop draws the surface through the AO composer's render target, a
    // program variant of its own, so the interior and core revealed at a ride's
    // windup would otherwise link theirs there. The ride itself draws on screen.
    if (!isMobile) compileOffscreen(gl, scene, camera, scene);
  });

  // The caution fall dissolves every worm material (cautionDissolve.js); its
  // programs used to link in the frame the worm went over the edge. Warm them per
  // look before play starts (a look that changes mid-run waits for the next run),
  // only from a live crawling worm so a fall in progress is never patched.
  // A Story briefing and a demo lesson's intro sit in phase 'active' before play
  // starts, so they count as before play: skipping them left every Story run to
  // link these programs in the middle of its portal arrival. The key leaves out the
  // quality tier, which the worm's materials never read (a tier change during the
  // arrival re-warmed them), and the new copies compile while the old ones still
  // hold their programs, so a re-warm that changes nothing links nothing.
  useFrame(() => {
    if (warmed.current === null || !body.current || fall.current.key === fallKey.current) return;
    const s = useGameStore.getState();
    const beforePlay = s.wormGamePhase !== 'active' || (s.wormStoryLevel && s.wormStoryReady && !s.wormStoryStarted)
      || (wormDemoActive(s) && !s.demoWormStarted);
    if (!beforePlay || !s.wormAlive || s.wormPhase !== 'crawling') return;
    const previous = fall.current.dispose;
    fall.current.dispose = warmCautionDissolve(gl, camera, scene, body.current);
    previous?.();
    fall.current.key = fallKey.current;
  });
  return null;
}
