import { Object3D, PerspectiveCamera, Vector3 } from 'three';
import { INTRO_SCALE, fitIntroFrame } from '../components/intro/introFraming.js';
import { sampleIntro, introCameraDistance, INTRO_END } from '../components/intro/introChoreography.js';
import { introEnergy } from '../components/intro/introEnergy.js';
import { describe, expect, it, vi } from 'vitest';
import { INTRO_STICKERS, INTRO_PRESENTATION, introStickerStage } from '../components/intro/introStickers.js';
import { FULL_FLIP_START, IMPLODE_START } from '../components/intro/introTiming.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { registerSticker, unregisterSticker, activateSticker, runActiveStickers, activeStickerCount } from '../3d/StickerAnimationManager.js';

describe('real gameplay stickers in the opening', () => {
  it('flips every pair once using gameplay data, then reverses without spending extra life', () => {
    const [original, flipped, restored] = INTRO_STICKERS;
    expect(original).toHaveLength(54);
    original.forEach((tile, i) => {
      expect(tile.flips).toBe(0);
      expect(flipped[i].curr).toBe(ANTIPODAL_COLOR[tile.curr]);
      expect(flipped[i].flips).toBe(1);
      expect(flipped[i].orig).toBe(tile.orig);
      expect(flipped[i].origPos).toEqual(tile.origPos);
      expect(restored[i].curr).toBe(tile.curr);
      expect(restored[i].flips).toBe(0);
    });
  });
  it('keeps the flipped metadata alive for the extended hold and stays unflipped in reduced motion', () => {
    expect(introStickerStage(FULL_FLIP_START - 0.01)).toBe(0);
    expect(introStickerStage(FULL_FLIP_START)).toBe(1);
    expect(introStickerStage(IMPLODE_START - 0.01)).toBe(1);
    expect(introStickerStage(IMPLODE_START)).toBe(2);
    expect(introStickerStage(5, true)).toBe(0);
    expect(INTRO_PRESENTATION.config.settings.colorScheme).toBe('standard');
    expect(Object.values(INTRO_PRESENTATION.config.settings.manifoldStyles).every(s => s === 'topographic')).toBe(true);
    expect(INTRO_PRESENTATION.config.wormHealerMode).toBe(true);
  });
  it('ticks only cinematic stickers and cleans up without dropping a live gameplay tick', () => {
    const gameplay = vi.fn(), intro = vi.fn();
    registerSticker('test-gameplay', gameplay); registerSticker('intro:test', intro);
    activateSticker('test-gameplay'); activateSticker('intro:test');
    try {
      runActiveStickers({}, 0.016, 'intro:');
      expect(intro).toHaveBeenCalledTimes(1);
      expect(gameplay).not.toHaveBeenCalled();
      unregisterSticker('intro:test', intro);
      runActiveStickers({}, 0.016);
      expect(gameplay).toHaveBeenCalledTimes(1);
    } finally {
      unregisterSticker('intro:test', intro); unregisterSticker('test-gameplay', gameplay);
    }
    expect(activeStickerCount()).toBe(0);
  });
});

it('keeps the 1.2x cube in frame across phone aspect ratios', () => {
  expect(INTRO_SCALE).toBe(1.2);
  for (const aspect of [320 / 900, 390 / 844, 844 / 390]) {
    const camera = new PerspectiveCamera(40, aspect, 0.1, 100);
    const root = new Object3D(); root.scale.setScalar(INTRO_SCALE);
    const corner = new Vector3();
    for (let time = 0; time <= INTRO_END; time += 0.25) {
      const pose = sampleIntro(time);
      const distance = introCameraDistance(pose.distance - introEnergy(time).push, aspect);
      camera.position.set(Math.sin(pose.orbit) * distance, distance * 0.32, Math.cos(pose.orbit) * distance);
      camera.lookAt(0, -0.55, 0);
      root.rotation.set(0.12 + 0.1 * pose.open, pose.turn, 0); root.position.y = 0.25;
      const extent = 1 + 1.5 * pose.open + 0.56;
      fitIntroFrame(camera, root, extent);
      for (const x of [-extent, extent]) for (const y of [-extent, extent]) for (const z of [-extent, extent]) {
        corner.set(x, y, z).applyMatrix4(root.matrixWorld).project(camera);
        expect(Math.max(Math.abs(corner.x), Math.abs(corner.y))).toBeLessThanOrEqual(0.971);
      }
    }
  }
});
