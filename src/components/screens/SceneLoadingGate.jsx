// src/components/screens/SceneLoadingGate.jsx
/**
 * SceneLoadingGate — covers the scene with the loading cube while its Three.js
 * assets (the 20–26MB environment map, GLBs, textures) actually decode, then
 * dissolves. This is the fix for "backgrounds loading in" on a mode transition.
 *
 * drei funnels every texture/EXR/GLB load through a global store exposed by
 * useProgress(), which is readable from ordinary DOM components — so this gate
 * sits as a sibling of the <Canvas> and reads the decode progress directly.
 *
 * Arm it by bumping `armToken` when preparing a scene. On arm it PROBES briefly: it only
 * commits to showing if a decode is genuinely in flight (or starts within
 * probeMs). A transition whose assets are already cached therefore never flashes
 * a redundant cover. Eager covers always show. Once shown, the cover plays at
 * least three seconds of the animation and waits for the decode to settle (or
 * the asset timeout). An explicit `ready` latch also waits for the
 * caller's scene/portrait preparation; `onReveal` runs as the cover fades out.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import LoadingScreen from './LoadingScreen.jsx';

const MIN_ANIMATION_MS = 3000;

export default function SceneLoadingGate({
  armToken,
  label = 'Loading',
  transparent = false,
  showTitle = false,
  eager = false,
  // Optional readiness latch for work outside drei (lazy scene commit, rendered
  // frames, DOM image decode). It must release before even the timeout can exit.
  ready = true,
  onReveal,
  probeMs = 500,
  maxVisibleMs = 12000,
  fadeMs = 480,
  style
}) {
  const prog = useProgress();
  const progRef = useRef(prog);
  progRef.current = prog;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const revealRef = useRef(onReveal);
  revealRef.current = onReveal;

  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const sess = useRef({ token: undefined, poll: null, fade: null, armedAt: 0, shown: false });
  const animation = useRef(null);
  const onAnimationStart = useCallback(() => {
    animation.current = { token: armToken, startedAt: performance.now() };
  }, [armToken]);

  useEffect(() => {
    const s = sess.current;
    // Falsy token (0/null/undefined) means "not armed yet" — only a fresh,
    // truthy value starts a cover session.
    if (!armToken || armToken === s.token) return;
    s.token = armToken;
    if (s.poll) clearInterval(s.poll);
    if (s.fade) clearTimeout(s.fade);
    s.fade = null;
    s.armedAt = performance.now();
    s.shown = false;
    setLeaving(false);
    setVisible(false);

    const end = () => {
      if (s.poll) {
        clearInterval(s.poll);
        s.poll = null;
      }
      revealRef.current?.();
      if (!s.shown) return; // never showed → nothing to fade out
      setLeaving(true);
      s.fade = setTimeout(() => {
        setLeaving(false);
        setVisible(false);
      }, fadeMs);
    };

    if (eager) {
      // Guaranteed cover: show at once and hold for at least three seconds whether
      // or not a decode registers (used where the work — e.g. a demo step's cube
      // rebuild — isn't a clean asset load). It still extends until any decode
      // settles. An explicit readiness latch can extend beyond maxVisibleMs.
      s.shown = true;
      setVisible(true);
    } else {
      // If a decode is already in flight at arm time (the common case — the env
      // map started loading behind the wizard/Mobi dialogue), show immediately so
      // there's no one-frame gap between the dialogue closing and the cover.
      const { active, progress } = progRef.current;
      if (active && progress < 100) {
        s.shown = true;
        setVisible(true);
      }
    }

    // Poll drei's decode progress. Reading a ref avoids restarting the loop on
    // every progress tick while still seeing the latest values.
    s.poll = setInterval(() => {
      const { active, progress } = progRef.current;
      const now = performance.now();
      if (!s.shown) {
        if (active && progress < 100) {
          // A real decode is in flight — commit to covering it.
          s.shown = true;
          setVisible(true);
        } else if (readyRef.current && now - s.armedAt >= probeMs) {
          end(); // nothing to wait for; never flash the cover
        }
        return;
      }
      // Don't count the lazy scene's placeholder as animation time, and don't
      // let the asset timeout shorten a late-starting animation.
      const playback = animation.current;
      const playedMinimum = playback?.token === armToken && now - playback.startedAt >= MIN_ANIMATION_MS;
      const settled = !active || progress >= 100;
      if (playedMinimum && readyRef.current && (settled || now - s.armedAt >= maxVisibleMs)) end();
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armToken]);

  useEffect(
    () => () => {
      const s = sess.current;
      if (s.poll) clearInterval(s.poll);
      if (s.fade) clearTimeout(s.fade);
    },
    []
  );

  // Eager transitions cover the very first commit, before the effect arms its
  // polling session, so a cached/fast scene cannot flash ahead of the loader.
  const arming = eager && armToken && armToken !== sess.current.token;
  if (!visible && !arming) return null;
  const { active, progress } = prog;
  return (
    <LoadingScreen
      key={armToken}
      onAnimationStart={onAnimationStart}
      label={label}
      showTitle={showTitle}
      transparent={transparent}
      leaving={!arming && leaving}
      progress={active && progress < 100 ? progress : null}
      style={style}
    />
  );
}
