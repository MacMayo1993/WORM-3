// src/3d/GameScene.jsx
/**
 * GameScene — all 3D content for the main game (lights, backgrounds, CubeAssembly, effects).
 * Lives permanently inside the single Canvas in App.jsx, rendered when showWelcome is false.
 * Reads most state directly from useGameStore to reduce prop drilling.
 */

import React, { Suspense, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import CubeAssembly from './CubeAssembly.jsx';
import BlackHoleEnvironment from './BlackHoleEnvironment.jsx';
import { getLevelBackground } from './LifeJourneyBackgrounds.jsx';
import { BACKGROUNDS, getBackgroundUrl } from '../utils/backgrounds.js';
import LayerHighlight from '../teach/LayerHighlight.jsx';
import AntipodalVisualization from './AntipodalVisualization.jsx';
import AntipodalModeEffects from './AntipodalModeEffects.jsx';
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
 *   antipodalData    — from useAntipodalIntegrity hook
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
  // computed / hook-derived data
  animState,
  manifoldMap,
  antipodalData,
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
    antipodalIntegrityMode,
    solveModeActive,
    solveHighlights,
    size,
    cubies,
    wormHealerMode,
    wormPhase,
    wormPaused,
    holonomyMode,
    wormHealedCount,
    wormCharacter,
  } = useGameStore(useShallow((s) => ({
    visualMode: s.visualMode,
    explosionT: s.explosionT,
    currentLevelData: s.currentLevelData,
    blackHolePulse: s.blackHolePulse,
    settings: s.settings,
    antipodalIntegrityMode: s.antipodalIntegrityMode,
    solveModeActive: s.solveModeActive,
    solveHighlights: s.solveHighlights,
    size: s.size,
    cubies: s.cubies,
    wormHealerMode: s.wormHealerMode,
    wormPhase: s.wormPhase,
    wormPaused: s.wormPaused ?? false,
    holonomyMode: s.holonomyMode,
    wormHealedCount: s.wormHealedCount ?? 0,
    wormCharacter: s.wormCharacter ?? 'classic',
  })));

  const isGlowWorm = wormHealerMode && wormCharacter === 'glow';

  const wormholePhaseActive = wormHealerMode && (
    wormPhase === 'entering' || wormPhase === 'tunnel' || wormPhase === 'exiting'
  );
  // In Healer WORM mode, always show antipodal PiP except during wormhole travel,
  // where the dedicated tunnel camera takes over.
  const shouldShowAntipodalPiP = (showAntipodalPiP || wormHealerMode) && !wormholePhaseActive;

  // Memoize the BACKGROUNDS array search — avoids re-iterating on every render.
  // Only recomputes when the user actually changes their background theme.
  const bgConfig = useMemo(
    () => BACKGROUNDS.find((b) => b.id === settings.backgroundTheme),
    [settings.backgroundTheme]
  );

  return (
    <>
      {/* Lights — intensity varies by visualMode */}
      <ambientLight intensity={visualMode === 'wireframe' ? 0.2 : visualMode === 'glass' ? 0.5 : 0.8} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={visualMode === 'wireframe' ? 0.3 : visualMode === 'glass' ? 1.6 : 1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
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
        {currentLevelData?.background && currentLevelData.background !== 'blackhole' &&
          getLevelBackground(currentLevelData.background, blackHolePulse)}
        {/* Free play: Black Hole */}
        {!currentLevelData && settings.backgroundTheme === 'blackhole' && <BlackHoleEnvironment flipTrigger={blackHolePulse} />}
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

        {antipodalIntegrityMode && antipodalData && (
          <AntipodalVisualization
            antipodalData={antipodalData}
            size={size}
            explosionFactor={explosionT}
          />
        )}
        <AntipodalModeEffects />

        {wormHealerMode && (
          <ErrorBoundary3D>
            <Suspense fallback={null}>
              <HealerWormMode3DWrapper
                cubies={cubies} size={size} explosionFactor={explosionT} animState={animState} onRotate={onRotate} onHeal={onHeal}
              />
            </Suspense>
          </ErrorBoundary3D>
        )}

        {holonomyMode && (
          <Suspense fallback={null}>
            <HolonomyWrapper size={size} />
          </Suspense>
        )}

        {/* Worm mode bloom — only affects the worm's bright emissive surfaces.
            Glow worm uses a higher threshold (0.82) so only the worm's HDR emissive
            blooms, not background tiles. Non-glow characters use a lower threshold
            (0.6) for orb glow. */}
        {wormHealerMode && (
          <EffectComposer>
            <Bloom
              intensity={isGlowWorm ? 0.35 : 0.45}
              luminanceThreshold={isGlowWorm ? 0.82 : 0.6}
              luminanceSmoothing={isGlowWorm ? 0.75 : 0.4}
              mipmapBlur
            />
          </EffectComposer>
        )}
      </Suspense>

      {/* Antipodal PiP — only mounted when active so R3F auto-render stays live when off */}
      {shouldShowAntipodalPiP && <AntipodalPiP />}
    </>
  );
}
