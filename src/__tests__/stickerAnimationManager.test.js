import { describe, it, expect } from 'vitest';
import {
  registerSticker,
  unregisterSticker,
  activateSticker,
  runActiveStickers,
} from '../3d/StickerAnimationManager.js';

describe('StickerAnimationManager registration lifecycle', () => {
  it('does not let a stale size-transition cleanup unregister the replacement tile', () => {
    const key = 'M1-001';
    let oldTicks = 0;
    let replacementTicks = 0;
    const oldTick = () => { oldTicks++; };
    const replacementTick = () => { replacementTicks++; };

    registerSticker(key, oldTick);
    activateSticker(key);
    registerSticker(key, replacementTick);

    // React effect cleanup from the old cube can arrive after the replacement
    // sticker has registered under the same physical manifold-grid ID.
    unregisterSticker(key, oldTick);
    runActiveStickers({ clock: { elapsedTime: 0 } }, 1 / 60);

    expect(oldTicks).toBe(0);
    expect(replacementTicks).toBe(1);
    unregisterSticker(key, replacementTick);
  });
});
