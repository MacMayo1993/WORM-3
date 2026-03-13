// src/worm/SnakeWormMode.jsx
// Standalone self-contained snake worm game.
// Has its own Canvas and cube state — like PlatformerWormMode.
// Supports both surface mode (crawl on cube faces) and tunnel mode (travel through wormholes).

import React, { useState, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import SimpleCubeRenderer from './SimpleCubeRenderer.jsx';
import { WormModeStartScreen } from './WormModeGame.jsx';
import {
  useWormGame,
  useTunnelWormGame,
  WormMode3D,
  WormGameLoop,
  TunnelWormGameLoop,
} from './WormMode.jsx';
import WormHUD from './WormHUD.jsx';

const DEFAULT_SIZE = 3;

// ─── Surface mode inner component ────────────────────────────────────────────
// Separate component so useWormGame is only called when this mode is active.
function SurfaceGame({ size, cubies, setCubies, onQuit }) {
  const updateAfterRotationRef = useRef(null);

  const handleRotate = useCallback((axis, dir, sliceIndex) => {
    setCubies(prev => rotateSliceCubies(prev, axis, dir, sliceIndex, size));
    // Remap worm/orb positions to the rotated cube
    updateAfterRotationRef.current?.(axis, sliceIndex, dir);
  }, [size, setCubies]);

  const game = useWormGame(cubies, size, false, handleRotate);
  // Keep the ref in sync every render (no stale closure)
  updateAfterRotationRef.current = game.updateAfterRotation;

  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 14], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ powerPreference: 'high-performance', antialias: true }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} />
        <SimpleCubeRenderer cubies={cubies} size={size} />
        <WormMode3D
          worm={game.worm}
          orbs={game.orbs}
          size={size}
          explosionFactor={0}
          gameState={game.gameState}
          mode="surface"
          dangerSlice={game.dangerSlice || null}
          amputationEffects={game.amputationEffects || []}
          onAmputationEffectDone={(id) =>
            game.setAmputationEffects(prev => prev.filter(e => e.id !== id))
          }
        />
        <WormGameLoop cubies={cubies} size={size} animState={false} game={game} />
      </Canvas>
      <WormHUD
        score={game.score}
        length={game.worm.length}
        orbsRemaining={game.orbs.length}
        orbsTotal={game.orbsTotal}
        orbsCollected={game.orbsTotal - game.orbs.length}
        warps={game.warps}
        warpsLabel="WARPS"
        gameState={game.gameState}
        speed={game.speed}
        wormCameraEnabled={false}
        mode="surface"
        timeAlive={game.timeAlive || 0}
        dangerSlice={game.dangerSlice || null}
        autoRotateCountdown={game.autoRotateCountdown}
        onPause={() => game.setGameState('paused')}
        onResume={() => game.setGameState('playing')}
        onRestart={game.restart}
        onQuit={onQuit}
      />
    </>
  );
}

// ─── Tunnel mode inner component ──────────────────────────────────────────────
// Separate component so useTunnelWormGame is only called when this mode is active.
function TunnelGame({ size, cubies, setCubies, onQuit }) {
  const updateAfterRotationRef = useRef(null);

  const handleRotate = useCallback((axis, dir, sliceIndex) => {
    setCubies(prev => rotateSliceCubies(prev, axis, dir, sliceIndex, size));
    updateAfterRotationRef.current?.(axis, sliceIndex, dir);
  }, [size, setCubies]);

  const game = useTunnelWormGame(cubies, size, false, handleRotate);
  updateAfterRotationRef.current = game.updateAfterRotation;

  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 14], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ powerPreference: 'high-performance', antialias: true }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} />
        <SimpleCubeRenderer cubies={cubies} size={size} />
        <WormMode3D
          worm={game.worm}
          orbs={game.orbs}
          size={size}
          explosionFactor={0}
          gameState={game.gameState}
          mode="tunnel"
          targetTunnelId={game.targetTunnelId}
          tunnels={game.tunnels || []}
          inactiveTunnelSides={game.inactiveTunnelSides}
        />
        <TunnelWormGameLoop cubies={cubies} size={size} animState={false} game={game} />
      </Canvas>
      <WormHUD
        score={game.score}
        length={game.worm.length}
        orbsRemaining={game.orbs.length}
        orbsTotal={game.orbsTotal}
        orbsCollected={game.orbsTotal - game.orbs.length}
        warps={game.tunnelsTraversed || 0}
        warpsLabel="TUNNELS"
        gameState={game.gameState}
        speed={game.speed}
        wormCameraEnabled={false}
        mode="tunnel"
        timeAlive={game.timeAlive || 0}
        onPause={() => game.setGameState('paused')}
        onResume={() => game.setGameState('playing')}
        onRestart={game.restart}
        onQuit={onQuit}
      />
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
// Renders start screen → then the selected game mode with its own Canvas.
export default function SnakeWormMode({ onQuit }) {
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState('surface');
  const [cubies, setCubies] = useState(() => makeCubies(DEFAULT_SIZE));

  const handleStart = useCallback((selectedMode) => {
    setMode(selectedMode);
    // Reset cube to solved state for a fresh game
    setCubies(makeCubies(DEFAULT_SIZE));
    setStarted(true);
  }, []);

  if (!started) {
    return <WormModeStartScreen onStart={handleStart} onCancel={onQuit} />;
  }

  const commonProps = { size: DEFAULT_SIZE, cubies, setCubies, onQuit };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#0a0a14' }}>
      {mode === 'surface'
        ? <SurfaceGame {...commonProps} />
        : <TunnelGame {...commonProps} />}
    </div>
  );
}
