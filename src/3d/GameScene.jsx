// src/3d/GameScene.jsx
/**
 * GameScene — all 3D content for the main game (lights, backgrounds, CubeAssembly, effects).
 * Lives permanently inside the single Canvas in App.jsx, rendered when showWelcome is false.
 * Reads most state directly from useGameStore to reduce prop drilling.
 */

import React, { Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Html } from '@react-three/drei';
import { useGameStore } from '../hooks/useGameStore.js';
import CubeAssembly from './CubeAssembly.jsx';
import BlackHoleEnvironment from './BlackHoleEnvironment.jsx';
import { getLevelBackground } from './LifeJourneyBackgrounds.jsx';
import { BACKGROUNDS, getBackgroundUrl } from '../utils/backgrounds.js';
import LayerHighlight from '../teach/LayerHighlight.jsx';
import AntipodalVisualization from './AntipodalVisualization.jsx';
import AntipodalModeEffects from './AntipodalModeEffects.jsx';
import WormholeWarpFX from './WormholeWarpFX.jsx';
import QuantumOverlay from './QuantumOverlay.jsx';
import SmokescreenFX from './SmokescreenFX.jsx';
import QuantumRealmBG from './QuantumRealmBG.jsx';

import { HealerWormMode3DWrapper } from '../worm/HealerWormMode.jsx';
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
}) {
  // ── State from store ──────────────────────────────────────────────────────
  const visualMode = useGameStore((s) => s.visualMode);
  const explosionT = useGameStore((s) => s.explosionT);
  const currentLevelData = useGameStore((s) => s.currentLevelData);
  const blackHolePulse = useGameStore((s) => s.blackHolePulse);
  const settings = useGameStore((s) => s.settings);
  const antipodalIntegrityMode = useGameStore((s) => s.antipodalIntegrityMode);
  const solveModeActive = useGameStore((s) => s.solveModeActive);
  const solveHighlights = useGameStore((s) => s.solveHighlights);
  const size = useGameStore((s) => s.size);
  const cubies = useGameStore((s) => s.cubies);
  const wormHealerMode = useGameStore((s) => s.wormHealerMode);
  const wormPhase = useGameStore((s) => s.wormPhase);
  const holonomyMode = useGameStore((s) => s.holonomyMode);

  const wormholePhaseActive = wormHealerMode && (
    wormPhase === 'entering' || wormPhase === 'tunnel' || wormPhase === 'exiting'
  );

  const smokePhase = useGameStore((s) => s.smokePhase);
  const quantumMode = useGameStore((s) => s.quantumMode);

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
        {/* Free play: Quantum Realm — fully procedural, no external files needed */}
        {!currentLevelData && settings.backgroundTheme === 'quantum_realm' && <QuantumRealmBG />}
        {/* Free play: interactive photo panoramas */}
        {!currentLevelData && settings.backgroundTheme !== 'quantum_realm' && (
          (() => {
            const bgConfig = BACKGROUNDS.find((b) => b.id === settings.backgroundTheme);
            if (bgConfig && bgConfig.file) {
              return (
                <ErrorBoundary3D>
                  <InteractivePhotoBackground files={getBackgroundUrl(bgConfig.file)} />
                </ErrorBoundary3D>
              );
            }
            if (PHOTO_PRESETS.has(settings.backgroundTheme)) {
              return (
                <ErrorBoundary3D>
                  <InteractivePhotoBackground preset={settings.backgroundTheme} />
                </ErrorBoundary3D>
              );
            }
            if (settings.backgroundTheme === 'blackhole' || !bgConfig) {
              return <BlackHoleEnvironment flipTrigger={blackHolePulse} />;
            }
            return null;
          })()
        )}
        {/* Default lighting env for levels without a custom background */}
        {currentLevelData && !currentLevelData.background && <Environment preset="city" />}

        <WormholeWarpFX
          enabled={wormholePhaseActive}
          wormPhase={wormPhase}
        />

        <CubeAssembly
          size={size}
          cubies={cubies}
          onMove={onMove}
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

        {/* Quantum Superposition overlay — ghost stickers for unobserved states */}
        {quantumMode && <QuantumOverlay />}

        {/* Smoke Screen — covers the cube during shuffle */}
        {smokePhase !== 'off' && <SmokescreenFX />}

        {wormHealerMode && (
          <ErrorBoundary3D>
            <HealerWormMode3DWrapper
              cubies={cubies} size={size} explosionFactor={explosionT} animState={animState} onRotate={onRotate} onHeal={onHeal}
            />
          </ErrorBoundary3D>
        )}

        {holonomyMode && (
          <Suspense fallback={null}>
            <HolonomyWrapper size={size} />
          </Suspense>
        )}
      </Suspense>
    </>
  );
}
