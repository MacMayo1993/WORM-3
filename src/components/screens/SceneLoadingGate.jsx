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
 * a redundant cover. Once shown it holds until the decode settles (with a
 * min-show floor so it reads as intentional) or maxVisibleMs elapses — a hard
 * cap for ordinary transitions. An explicit `ready` latch also waits for the
 * caller's scene/portrait preparation; `onReveal` runs as the cover fades out.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import LoadingScreen from './LoadingScreen.jsx';

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
  // Long enough to see the cube through a full loop and read one of MOBI's tips.
  minVisibleMs = 2400,
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
  const sess = useRef({ token: undefined, poll: null, fade: null, armedAt: 0, shownAt: 0, shown: false });

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
    s.shownAt = 0;
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
      // Guaranteed cover: show at once and hold for at least minVisibleMs whether
      // or not a decode registers (used where the work — e.g. a demo step's cube
      // rebuild — isn't a clean asset load). It still extends until any decode
      // settles. An explicit readiness latch can extend beyond maxVisibleMs.
      s.shown = true;
      s.shownAt = s.armedAt;
      setVisible(true);
    } else {
      // If a decode is already in flight at arm time (the common case — the env
      // map started loading behind the wizard/Mobi dialogue), show immediately so
      // there's no one-frame gap between the dialogue closing and the cover.
      const { active, progress } = progRef.current;
      if (active && progress < 100) {
        s.shown = true;
        s.shownAt = s.armedAt;
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
          s.shownAt = now;
          setVisible(true);
        } else if (readyRef.current && now - s.armedAt >= probeMs) {
          end(); // nothing to wait for; never flash the cover
        }
        return;
      }
      const elapsed = now - s.shownAt;
      const settled = !active || progress >= 100;
      if (readyRef.current && ((settled && elapsed >= minVisibleMs) || now - s.armedAt >= maxVisibleMs)) end();
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
      label={label}
      showTitle={showTitle}
      transparent={transparent}
      leaving={!arming && leaving}
      progress={active && progress < 100 ? progress : null}
      style={style}
    />
  );
}
