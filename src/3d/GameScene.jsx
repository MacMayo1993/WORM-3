// src/3d/GameScene.jsx
/**
 * GameScene — all 3D content for the main game (lights, backgrounds, CubeAssembly, effects).
 * Lives permanently inside the single Canvas in App.jsx, rendered when showWelcome is false.
 * Reads most state directly from useGameStore to reduce prop drilling.
 */

import React, { Suspense, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Html } from '@react-three/drei';
import { EffectComposer, N8AO } from '@react-three/postprocessing';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { isMobile } from '../utils/device.js';
import CubeAssembly from './CubeAssembly.jsx';
import BlackHoleEnvironment from './BlackHoleEnvironment.jsx';
import NebulaEnvironment from './NebulaEnvironment.jsx';
import { getLevelBackground } from './LifeJourneyBackgrounds.jsx';
import { BACKGROUNDS, getBackgroundUrl } from '../utils/backgrounds.js';
import LayerHighlight from '../teach/LayerHighlight.jsx';
import AntipodalModeEffects from './AntipodalModeEffects.jsx';
import AntipodalPairHighlight from './AntipodalPairHighlight.jsx';
import WormholeWarpFX from './WormholeWarpFX.jsx';
import AntipodalPiP from './AntipodalPiP.jsx';

const HealerWormMode3DWrapper = React.lazy(() =>
  import('../worm/HealerWormMode.jsx').then((mod) => ({ default: mod.HealerWormMode3DWrapper }))
);
const HolonomyWrapper = React.lazy(() => import('../holonomy/HolonomyWrapper.jsx'));

const PHOTO_PRESETS = new Set([
  'sunset', 'forest', 'city', 'dawn', 'night',
  'apartment', 'studio', 'park', 'warehouse', 'lobby',
]);

function InteractivePhotoBackground({ preset, files }) {
  useFrame((state, delta) => {
    if (state.scene.backgroundRotation) {
      state.scene.backgroundRotation.y += delta * 0.1;
    }
  });

  return (
    <Environment
      preset={files ? undefined : preset}
      files={files}
      background
      backgroundBlurriness={0}
      backgroundIntensity={1.2}
    />
  );
}

class ErrorBoundary3D extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('3D Component Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <group>
          <mesh>
            <boxGeometry args={[10, 10, 10]} />
            <meshBasicMaterial color="red" wireframe />
          </mesh>
          <Html position={[0, 0, -2]}>
            <div style={{ color: 'red', background: 'rgba(0,0,0,0.8)', padding: '10px' }}>
              Error Loading Background
              <br />
              {this.state.error?.message}
            </div>
          </Html>
        </group>
      );
    }
    return this.props.children;
  }
}

/**
 * GameScene renders all in-game 3D content.
 *
 * Props (ephemeral callbacks + computed hook data that isn't raw store state):
 *   onMove, onTapFlip, onAnimComplete, onCascadeComplete,
 *   onSelectTile, onClearTileSelection, onFlipWaveComplete, onFaceRotationMode
 *   animState        — from useAnimation hook (also in store, but kept as prop per plan)
 *   manifoldMap      — computed in useCubeState
 *   teachModeActive  — from useTeachMode
 *   layerHighlight   — from teachMode.layerHighlight
 */
export default function GameScene({
  // 8 ephemeral callbacks
  onMove,
  onTapFlip,
  onAnimComplete,
  onCascadeComplete,
  onSelectTile,
  onClearTileSelection,
  onFlipWaveComplete,
  onFaceRotationMode,
  onHeal,
  onRotate,
  onAnimatedShuffle,
  // computed / hook-derived data
  animState,
  manifoldMap,
  teachModeActive,
  layerHighlight,
  // PiP toggle
  showAntipodalPiP,
}) {
  // ── State from store ──────────────────────────────────────────────────────
  const {
    visualMode,
    explosionT,
    currentLevelData,
    blackHolePulse,
    settings,
    solveModeActive,
    solveHighlights,
    kociembaLayerHighlight,
    size,
    cubies,
    wormHealerMode,
    wormPhase,
    wormPaused,
    holonomyMode,
    wormHealedCount,
    perfReducedFX,
  } = useGameStore(useShallow((s) => ({
    visualMode: s.visualMode,
    explosionT: s.explosionT,
    currentLevelData: s.currentLevelData,
    blackHolePulse: s.blackHolePulse,
    settings: s.settings,
    solveModeActive: s.solveModeActive,
    solveHighlights: s.solveHighlights,
    kociembaLayerHighlight: s.kociembaLayerHighlight,
    size: s.size,
    cubies: s.cubies,
    wormHealerMode: s.wormHealerMode,
    wormPhase: s.wormPhase,
    wormPaused: s.wormPaused ?? false,
    holonomyMode: s.holonomyMode,
    wormHealedCount: s.wormHealedCount ?? 0,
    perfReducedFX: s.perfReducedFX ?? false,
  })));

  // Cube self-shadowing — the cubie bodies already declare cast/receiveShadow, so the
  // only thing needed is an enabled shadow-casting light (Canvas has `shadows`). The
  // shadow-map render pass is the cost, so we gate it off on mobile and whenever the
  // PerformanceMonitor has flagged a sustained frame-rate decline. Wireframe/glass modes
  // skip it too — their translucent bodies don't read shadows usefully.
  const shadowsOn = !isMobile && !perfReducedFX && visualMode !== 'wireframe' && visualMode !== 'glass';

  // Ambient occlusion shares the same capability gate as shadows (skip mobile,
  // sustained-low-FPS, and the translucent wireframe/glass modes that don't read
  // occlusion usefully).
  const aoEnabled = shadowsOn;

  const wormholePhaseActive = wormHealerMode && (
    wormPhase === 'entering' || wormPhase === 'tunnel' || wormPhase === 'exiting'
  );
  // Antipodal PiP is shown only when the player toggles it on (in any mode), and is
  // suppressed during wormhole travel where the dedicated tunnel camera takes over.
  // (Previously worm mode force-showed it, which made the HUD toggle a no-op there.)
  const shouldShowAntipodalPiP = showAntipodalPiP && !wormholePhaseActive;

  // Memoize the BACKGROUNDS array search — avoids re-iterating on every render.
  // Only recomputes when the user actually changes their background theme.
  const bgConfig = useMemo(
    () => BACKGROUNDS.find((b) => b.id === settings.backgroundTheme),
    [settings.backgroundTheme]
  );

  // Depth fog — only enabled over the dark black-hole space background. Photo-panorama
  // and HDRI preset backgrounds render as a sharp image behind the scene, so fogging the
  // cubies toward a flat color in front of them would look wrong; we gate it out for those.
  // The black-hole path is the default fallback (see background selection below), so we
  // mirror that condition: a level background that isn't a photo, or free-play with no
  // photo/preset background resolving to the black hole.
  const fogEnabled = useMemo(() => {
    if (currentLevelData) {
      // Level scenes: fog the dark cosmic backgrounds, not bright HDRI 'city' lighting envs.
      return !currentLevelData.background || currentLevelData.background === 'blackhole';
    }
    if (settings.backgroundTheme === 'blackhole') return true;
    if (bgConfig?.file) return false; // user-selected photo panorama
    if (PHOTO_PRESETS.has(settings.backgroundTheme)) return false; // HDRI preset
    return true; // falls through to the black-hole default
  }, [currentLevelData, settings.backgroundTheme, bgConfig]);

  return (
    <>
      {/* Exp² depth fog over the dark space background. Density is low so the assembled
          cube stays crisp, but reads clearly once cubies spread apart in the explosion
          and during worm-tunnel travel, adding atmospheric depth at zero pipeline cost. */}
      {fogEnabled && <fogExp2 attach="fog" args={['#05050f', 0.028]} />}
      {/* Lights — intensity varies by visualMode */}
      <ambientLight intensity={visualMode === 'wireframe' ? 0.2 : visualMode === 'glass' ? 0.5 : 0.8} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={visualMode === 'wireframe' ? 0.3 : visualMode === 'glass' ? 1.6 : 1.2}
        castShadow={shadowsOn}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        // Tight ortho frustum sized to the cube plus its explosion spread (cubies
        // expand to ~±6 units). A snug frustum keeps shadow-map texels dense for
        // crisp contact shadows in the inter-cubie crevices and rounded bevels.
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      <pointLight position={[10, 10, 10]} intensity={visualMode === 'wireframe' ? 0.3 : visualMode === 'glass' ? 1.0 : 0.8} />
      <pointLight position={[-10, -10, -10]} intensity={visualMode === 'wireframe' ? 0.2 : visualMode === 'glass' ? 0.5 : 0.6} />
      {visualMode === 'wireframe' && (
        <>
          <pointLight position={[0, 0, 0]} intensity={0.5} color="#fefae0" distance={15} decay={2} />
          <pointLight position={[5, 5, 5]} intensity={0.25} color="#dda15e" />
          <pointLight position={[-5, -5, -5]} intensity={0.2} color="#bc6c25" />
        </>
      )}
      {visualMode === 'glass' && (
        <>
          <pointLight position={[-8, 6, 8]} intensity={0.6} color="#ffffff" />
          <pointLight position={[8, -4, -6]} intensity={0.3} color="#e0e8ff" />
        </>
      )}

      <Suspense fallback={null}>
        {/* Level-specific backgrounds */}
        {currentLevelData?.background === 'blackhole' && <BlackHoleEnvironment flipTrigger={blackHolePulse} />}
        {currentLevelData?.background === 'nebula' && (
          <NebulaEnvironment variant="game" pulseTrigger={blackHolePulse} speed={0.5}
            density={isMobile ? 0.55 : 0.85} structure={1.0} performanceMode={isMobile} />
        )}
        {currentLevelData?.background && currentLevelData.background !== 'blackhole' && currentLevelData.background !== 'nebula' &&
          getLevelBackground(currentLevelData.background, blackHolePulse)}
        {/* Free play: Black Hole */}
        {!currentLevelData && settings.backgroundTheme === 'blackhole' && <BlackHoleEnvironment flipTrigger={blackHolePulse} />}
        {/* Free play: Nebula */}
        {!currentLevelData && settings.backgroundTheme === 'nebula' && (
          <NebulaEnvironment variant="game" pulseTrigger={blackHolePulse} speed={0.5}
            density={isMobile ? 0.55 : 0.85} structure={1.0} performanceMode={isMobile} />
        )}
        {/* Free play: interactive photo panoramas */}
        {!currentLevelData && bgConfig?.file && (
          <ErrorBoundary3D>
            <InteractivePhotoBackground files={getBackgroundUrl(bgConfig.file)} />
          </ErrorBoundary3D>
        )}
        {!currentLevelData && !bgConfig?.file && PHOTO_PRESETS.has(settings.backgroundTheme) && (
          <ErrorBoundary3D>
            <InteractivePhotoBackground preset={settings.backgroundTheme} />
          </ErrorBoundary3D>
        )}
        {!currentLevelData && !bgConfig?.file && !PHOTO_PRESETS.has(settings.backgroundTheme) &&
          (settings.backgroundTheme === 'blackhole' || !bgConfig) && (
          <BlackHoleEnvironment flipTrigger={blackHolePulse} />
        )}
        {/* Default lighting env for levels without a custom background */}
        {currentLevelData && !currentLevelData.background && <Environment preset="city" />}

        <WormholeWarpFX
          enabled={wormholePhaseActive}
          wormPhase={wormPhase}
          healMoment={wormHealedCount}
        />

        <CubeAssembly
          size={size}
          cubies={cubies}
          onMove={wormHealerMode && wormPaused ? null : onMove}
          onTapFlip={onTapFlip}
          animState={animState}
          onAnimComplete={onAnimComplete}
          onCascadeComplete={onCascadeComplete}
          manifoldMap={manifoldMap}
          onSelectTile={onSelectTile}
          onClearTileSelection={onClearTileSelection}
          onFlipWaveComplete={onFlipWaveComplete}
          solveHighlights={solveModeActive || teachModeActive ? solveHighlights : []}
          onFaceRotationMode={onFaceRotationMode}
        />

        {teachModeActive && layerHighlight && (
          <LayerHighlight
            axis={layerHighlight.axis}
            sliceIndex={layerHighlight.sliceIndex}
            dir={layerHighlight.dir}
            size={size}
          />
        )}

        {solveModeActive && kociembaLayerHighlight && (
          <LayerHighlight
            axis={kociembaLayerHighlight.axis}
            sliceIndex={kociembaLayerHighlight.sliceIndex}
            dir={kociembaLayerHighlight.dir}
            size={size}
          />
        )}

        <AntipodalModeEffects />
        <AntipodalPairHighlight />

        {wormHealerMode && (
          <ErrorBoundary3D>
            <Suspense fallback={null}>
              <HealerWormMode3DWrapper
                cubies={cubies} size={size} explosionFactor={explosionT} animState={animState} onRotate={onRotate} onHeal={onHeal} onAnimatedShuffle={onAnimatedShuffle}
              />
            </Suspense>
          </ErrorBoundary3D>
        )}

        {holonomyMode && (
          <Suspense fallback={null}>
            <HolonomyWrapper size={size} />
          </Suspense>
        )}

      </Suspense>

      {/* Antipodal PiP — only mounted when active so R3F auto-render stays live when off */}
      {shouldShowAntipodalPiP && <AntipodalPiP />}

      {/* Ambient occlusion — soft contact shadows in the inter-cubie seams and rounded
          bevels, the single biggest "machined-cube" upgrade for this geometry. Mounted
          only when the PiP is OFF: AntipodalPiP hand-drives the render loop (manual
          two-camera pass) which an EffectComposer cannot share, so AO and the PiP are
          mutually exclusive — toggling the PiP on gracefully drops AO for that view.
          Gated off on mobile / low-FPS / wireframe / glass via aoEnabled. */}
      {aoEnabled && !shouldShowAntipodalPiP && (
        <EffectComposer multisampling={4}>
          <N8AO aoRadius={0.55} distanceFalloff={1} intensity={2.2} quality="medium" halfRes />
        </EffectComposer>
      )}
    </>
  );
}
