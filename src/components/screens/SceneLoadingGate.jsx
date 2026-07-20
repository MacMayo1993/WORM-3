// src/components/screens/SceneLoadingGate.jsx
/**
 * SceneLoadingGate — drives <LoadingScreen> from live Three.js asset progress.
 *
 * This is the reusable fix for "backgrounds loading in": the heavy pieces of a
 * mode entry are the environment map (a 20–26MB EXR) and any GLB/texture the
 * scene pulls. drei funnels every one of those through a global loading store
 * exposed by useProgress(), which is readable from ordinary DOM components — so
 * this gate can sit as a sibling of the <Canvas> and cover the scene until the
 * assets have actually decoded, then dissolve.
 *
 * It is deliberately *armed* by the parent (`active`) rather than watching
 * useProgress() unconditionally. A blanket watcher would flash the cover every
 * time a tiny texture streams in mid-game; arming it only during an intended
 * transition keeps it to the moments the player expects a loading beat.
 *
 * Contract:
 *   - Parent sets `active` true when a scene transition begins (mode entry, a
 *     background swap, returning to a heavy scene).
 *   - Parent sets `active` false when the transition's own timeline ends (e.g.
 *     the Mobi intro completes, or a "scene mounted" callback fires). The gate
 *     then guarantees a minimum on-screen time and fades out.
 *   - `onHidden` fires after the fade, once the cover is fully gone.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import LoadingScreen from './LoadingScreen.jsx';

export default function SceneLoadingGate({
  active,
  label = 'Loading',
  transparent = false,
  showTitle = true,
  minVisibleMs = 450,
  fadeMs = 450,
  onHidden
}) {
  const { progress, active: assetsLoading } = useProgress();
  const [rendered, setRendered] = useState(active);
  const [leaving, setLeaving] = useState(false);
  const shownAtRef = useRef(0);
  const timersRef = useRef([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    if (active) {
      // Arm: show immediately and cancel any in-flight fade-out.
      clearTimers();
      setLeaving(false);
      setRendered(true);
      shownAtRef.current = performance.now();
      return;
    }
    if (!rendered) return;
    // Disarm: honor the minimum visible window, then fade and unmount.
    const elapsed = performance.now() - shownAtRef.current;
    const wait = Math.max(0, minVisibleMs - elapsed);
    clearTimers();
    timersRef.current.push(
      setTimeout(() => {
        setLeaving(true);
        timersRef.current.push(
          setTimeout(() => {
            setRendered(false);
            setLeaving(false);
            onHidden?.();
          }, fadeMs)
        );
      }, wait)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, rendered, minVisibleMs, fadeMs]);

  useEffect(() => clearTimers, []);

  if (!rendered) return null;

  // While assets are still streaming, show live progress; once decoded, switch to
  // an indeterminate pulse so the bar never sticks at a number during the fade.
  const showProgress = assetsLoading && progress < 100;

  return (
    <LoadingScreen
      label={label}
      showTitle={showTitle}
      transparent={transparent}
      leaving={leaving}
      progress={showProgress ? progress : null}
    />
  );
}
