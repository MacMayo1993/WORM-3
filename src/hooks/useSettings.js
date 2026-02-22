/**
 * useSettings Hook
 *
 * Manages user settings and color schemes.
 */

import { useCallback, useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from './useGameStore.js';
import { resolveColors } from '../utils/colorSchemes.js';

/**
 * Hook for settings management
 */
export function useSettings() {
  const settings = useGameStore((state) => state.settings);
  const setSettings = useGameStore((state) => state.setSettings);
  const faceImages = useGameStore((state) => state.faceImages);
  const setFaceImages = useGameStore((state) => state.setFaceImages);
  const faceTextures = useGameStore((state) => state.faceTextures);
  const setFaceTextures = useGameStore((state) => state.setFaceTextures);

  // Resolve colors from settings
  const resolvedColors = useMemo(() => resolveColors(settings), [settings]);

  // Handle face image upload
  const handleFaceImage = useCallback((faceId, dataURL) => {
    if (dataURL) {
      setFaceImages((prev) => ({ ...prev, [faceId]: dataURL }));
    } else {
      setFaceImages((prev) => {
        const next = { ...prev };
        delete next[faceId];
        return next;
      });
    }
  }, [setFaceImages]);

  // Update a single setting
  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, [setSettings]);

  // Load textures when faceImages change
  const textureCleanupRef = useRef([]);
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const textures = {};
    const entries = Object.entries(faceImages);

    // Clean up old textures
    textureCleanupRef.current.forEach(t => t.dispose());
    textureCleanupRef.current = [];

    if (entries.length === 0) {
      setFaceTextures({});
      return;
    }

    let loaded = 0;
    for (const [faceId, url] of entries) {
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        textures[parseInt(faceId)] = tex;
        textureCleanupRef.current.push(tex);
        loaded++;
        if (loaded === entries.length) {
          setFaceTextures({ ...textures });
        }
      });
    }

    return () => {
      textureCleanupRef.current.forEach(t => t.dispose());
    };
  }, [faceImages, setFaceTextures]);

  return {
    // State
    settings,
    resolvedColors,
    faceImages,
    faceTextures,

    // Actions
    setSettings,
    updateSetting,
    handleFaceImage,
  };
}
