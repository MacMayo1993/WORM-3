import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSeamInteraction, isAntipodalPair, CITY_CONFIG, FACE_CITIES } from '../modes/CityBiomeMode.js';

// Resolve city key for a face from the face assignment map
function cityForFace(faceId, biomeFaceAssign) {
  const assign = biomeFaceAssign ?? FACE_CITIES;
  return assign[faceId] ?? FACE_CITIES[faceId];
}

/**
 * SeamPulse
 * Renders an emissive overlay on border tiles that pulses at the seam frequency.
 * One instance per face per active seam.
 *
 * Props:
 *   faceId         {number}    — which face this pulse instance belongs to
 *   neighborFaceId {number}    — the adjacent face it is reacting to
 *   borderTiles    {number[]}  — tileIndex values on the shared edge
 *   tilePositions  {Object}    — map of tileIndex → local position {x, y, z}
 *   tileScale      {number}    — tile size for overlay plane sizing
 *   isAdjacent     {boolean}   — true when faces are physically sharing an edge
 *   enabled        {boolean}
 *   biomeFaceAssign {Object}   — { [faceId]: cityKey }
 */
export function SeamPulse({ faceId, neighborFaceId, borderTiles, tilePositions, tileScale = 1, isAdjacent, enabled, biomeFaceAssign }) {
  const meshRefs = useRef([]);
  const timeRef = useRef(0);

  const interaction = useMemo(() => getSeamInteraction(faceId, neighborFaceId), [faceId, neighborFaceId]);

  const pulseColor = useMemo(() => {
    const cityKey = cityForFace(faceId, biomeFaceAssign);
    if (!cityKey) return '#ffffff';
    return CITY_CONFIG[cityKey]?.pulseColor ?? '#ffffff';
  }, [faceId, biomeFaceAssign]);

  const neighborColor = useMemo(() => {
    const cityKey = cityForFace(neighborFaceId, biomeFaceAssign);
    if (!cityKey) return '#ffffff';
    return CITY_CONFIG[cityKey]?.pulseColor ?? '#ffffff';
  }, [neighborFaceId, biomeFaceAssign]);

  const maxOpacity = isAdjacent ? 0.85 : (isAntipodalPair(faceId, neighborFaceId) ? 0.20 : 0);
  const freq = interaction.frequency;
  const shape = interaction.shape;

  // Create materials imperatively so we can mutate them in useFrame
  const materials = useMemo(() => {
    return (borderTiles || []).map(() => new THREE.MeshBasicMaterial({
      color: new THREE.Color(pulseColor),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
  }, [borderTiles, pulseColor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup materials on unmount or deps change
  const materialsRef = useRef(materials);
  materialsRef.current = materials;

  // Shared overlay geometry — one per tile
  const overlaySize = tileScale * 0.88;
  const geometry = useMemo(() => new THREE.PlaneGeometry(overlaySize, overlaySize), [overlaySize]);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  React.useEffect(() => {
    return () => {
      materialsRef.current.forEach(m => m.dispose());
      geometryRef.current.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (!enabled || maxOpacity === 0) {
      materials.forEach(m => { m.opacity = 0; });
      return;
    }

    timeRef.current += delta;
    const t = timeRef.current;
    const TWO_PI = Math.PI * 2;

    let opacity = 0;

    switch (shape) {
      case 'hard-alternate':
        // hard on/off square wave
        opacity = (t % (1 / freq)) < (0.5 / freq) ? maxOpacity : 0;
        break;

      case 'soft-breathe':
        opacity = maxOpacity * (0.5 + 0.5 * Math.sin(t * freq * TWO_PI));
        break;

      case 'chaotic-flicker':
        opacity = maxOpacity * Math.abs(Math.sin(t * freq * TWO_PI + Math.sin(t * 7.3)));
        break;

      case 'lead-follow': {
        // faceA leads, faceB follows with phase offset — here faceA is always this face
        const phase = faceId < neighborFaceId ? 0 : -Math.PI * 0.6;
        opacity = maxOpacity * (0.5 + 0.5 * Math.sin(t * freq * TWO_PI + phase));
        break;
      }

      case 'hot-overlap':
        // always somewhat bright, pulsing on top
        opacity = maxOpacity * (0.6 + 0.4 * Math.sin(t * freq * TWO_PI));
        break;

      case 'third-color': {
        // At peak, lerp material color toward mix of both city colors
        const base = 0.5 + 0.5 * Math.sin(t * freq * TWO_PI);
        opacity = maxOpacity * base;
        if (base > 0.8) {
          const c1 = new THREE.Color(pulseColor);
          const c2 = new THREE.Color(neighborColor);
          const blend = (base - 0.8) / 0.2;
          c1.lerp(c2, blend * 0.5);
          materials.forEach(m => m.color.copy(c1));
        } else {
          materials.forEach(m => m.color.set(pulseColor));
        }
        break;
      }

      case 'gold-violet': {
        // Sharp square wave + color shift between the two city colors each cycle
        const phase = (t * freq) % 1;
        opacity = phase < 0.5 ? maxOpacity : 0;
        if (phase < 0.5) {
          materials.forEach(m => m.color.set(phase < 0.25 ? pulseColor : neighborColor));
        }
        break;
      }

      case 'slow-build': {
        // Ramps 0→maxOpacity over 2s, resets, repeat
        const period = 2.0;
        const pos = (t % period) / period;
        opacity = maxOpacity * pos;
        if (pos > 0.95) {
          // Reset on next frame after reaching peak
          timeRef.current = 0;
          opacity = 0;
        }
        break;
      }

      case 'gentle-overlap':
        // soft breathe at lower intensity
        opacity = maxOpacity * 0.7 * (0.5 + 0.5 * Math.sin(t * freq * TWO_PI));
        break;

      case 'deep-interference': {
        // beat: sin(t*f1) * sin(t*f2), f2 = f1 * 1.07
        const f1 = freq;
        const f2 = freq * 1.07;
        opacity = maxOpacity * Math.abs(Math.sin(t * f1 * TWO_PI) * Math.sin(t * f2 * TWO_PI));
        break;
      }

      case 'warm-cool-inter': {
        // fast sine + color oscillates between warm and cool hex each cycle
        const cyclePos = (t * freq) % 1;
        opacity = maxOpacity * (0.5 + 0.5 * Math.sin(t * freq * TWO_PI));
        materials.forEach(m => m.color.set(cyclePos < 0.5 ? pulseColor : neighborColor));
        break;
      }

      default:
        opacity = maxOpacity * (0.5 + 0.5 * Math.sin(t * freq * TWO_PI));
    }

    materials.forEach(m => { m.opacity = Math.max(0, Math.min(1, opacity)); });
  });

  if (!enabled || maxOpacity === 0 || !borderTiles || borderTiles.length === 0 || !tilePositions) {
    return null;
  }

  return (
    <group>
      {borderTiles.map((tileIdx, i) => {
        const pos = tilePositions[tileIdx];
        if (!pos) return null;
        return (
          <mesh
            key={tileIdx}
            ref={el => { meshRefs.current[i] = el; }}
            geometry={geometry}
            material={materials[i]}
            position={[pos.x, pos.y, pos.z + 0.012]}
            castShadow={false}
            receiveShadow={false}
          />
        );
      })}
    </group>
  );
}

export default React.memo(SeamPulse);
