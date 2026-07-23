// Shared HDRI/photo panorama background with a deliberately subtle drift.
//
// three r159 (the version this project ships) has no `scene.backgroundRotation`
// — that landed upstream in r163 — so the built-in equirect background painted
// by drei's <Environment background> simply cannot be spun: mutating a
// non-existent scene property is a no-op and the panorama sat perfectly still
// on the main menu and mode-select screens.
//
// Instead we paint the same equirectangular texture onto the inside of a large
// sphere and rotate that mesh. The sphere is re-centred on the camera every
// frame so it reads as an infinitely distant skybox (no parallax), and a
// background-less <SafeEnvironment> still supplies the image-based reflections
// the cube relies on. This keeps the drift working on the three version we ship
// without touching the rest of the render pipeline.
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, RepeatWrapping } from 'three';
import { useEnvironment } from '@react-three/drei';
import SafeEnvironment from './SafeEnvironment.jsx';

// Contain a failed texture load to the background alone (mirrors SafeEnvironment)
// so a blocked/slow HDR fetch never blanks the whole scene.
class SkyBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn('[InteractivePhotoBackground] panorama failed to load; continuing without a photo backdrop.', err?.message ?? err);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function PanoramaSky({ preset, files, rotationSpeed, intensity }) {
  const texture = useEnvironment(files ? { files } : { preset });
  const meshRef = useRef();

  // Viewed from the inside (BackSide) an equirectangular texture is mirrored, so
  // flip U on a clone. Cloning keeps the shared environment map (used for
  // reflections) untouched — mutating the cached texture would skew those too.
  const skyTexture = useMemo(() => {
    const clone = texture.clone();
    clone.wrapS = RepeatWrapping;
    clone.repeat.x = -1;
    clone.offset.x = 1;
    clone.needsUpdate = true;
    return clone;
  }, [texture]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // Follow the camera so the panorama behaves like a distant skybox, then
    // drift around Y. Negative speeds counter-rotate against the menu cube.
    mesh.position.copy(state.camera.position);
    mesh.rotation.y += delta * rotationSpeed;
  });

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[100, 64, 40]} />
      {/* meshBasicMaterial = map.rgb * color, so a scalar colour reproduces the
          drei background's `backgroundIntensity` multiply. depthWrite off keeps
          the skybox from ever occluding the scene. */}
      <meshBasicMaterial map={skyTexture} side={BackSide} depthWrite={false} color={[intensity, intensity, intensity]} />
    </mesh>
  );
}

// rotationSpeed defaults to 0 (static): only the main menu / mode-select scene
// opts into the drift by passing a speed. In-game photo panoramas stay still.
export default function InteractivePhotoBackground({ preset, files, rotationSpeed = 0, intensity = 1.2, blurriness = 0 }) {
  return (
    <>
      {/* Reflections / ambient IBL only (no `background`) so the rotating sphere
          below is the visible panorama. blurriness only affects the reflection
          probe here; all current callers pass 0. */}
      <SafeEnvironment preset={files ? undefined : preset} files={files} backgroundBlurriness={blurriness} />
      <SkyBoundary>
        <React.Suspense fallback={null}>
          <PanoramaSky preset={preset} files={files} rotationSpeed={rotationSpeed} intensity={intensity} />
        </React.Suspense>
      </SkyBoundary>
    </>
  );
}
