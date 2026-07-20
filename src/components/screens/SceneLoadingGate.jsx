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
 * Arm it by bumping `armToken` to a new value at the moment the scene is
 * revealed (e.g. when a Mobi intro finishes). On arm it PROBES briefly: it only
 * commits to showing if a decode is genuinely in flight (or starts within
 * probeMs). A transition whose assets are already cached therefore never flashes
 * a redundant cover. Once shown it holds until the decode settles (with a
 * min-show floor so it reads as intentional) or maxVisibleMs elapses — a hard
 * cap so it can never get stuck on screen.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import LoadingScreen from './LoadingScreen.jsx';

export default function SceneLoadingGate({
  armToken,
  label = 'Loading',
  transparent = false,
  showTitle = true,
  minVisibleMs = 650,
  probeMs = 500,
  maxVisibleMs = 12000,
  fadeMs = 480,
  style
}) {
  const prog = useProgress();
  const progRef = useRef(prog);
  progRef.current = prog;

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
      if (!s.shown) return; // never showed → nothing to fade out
      setLeaving(true);
      s.fade = setTimeout(() => {
        setLeaving(false);
        setVisible(false);
      }, fadeMs);
    };

    // If a decode is already in flight at arm time (the common case — the env
    // map started loading behind the wizard/Mobi dialogue), show immediately so
    // there's no one-frame gap between the dialogue closing and the cover.
    {
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
        } else if (now - s.armedAt >= probeMs) {
          end(); // nothing to wait for; never flash the cover
        }
        return;
      }
      const elapsed = now - s.shownAt;
      const settled = !active || progress >= 100;
      if ((settled && elapsed >= minVisibleMs) || now - s.armedAt >= maxVisibleMs) end();
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

  if (!visible) return null;
  const { active, progress } = prog;
  return (
    <LoadingScreen
      label={label}
      showTitle={showTitle}
      transparent={transparent}
      leaving={leaving}
      progress={active && progress < 100 ? progress : null}
      style={style}
    />
  );
}
