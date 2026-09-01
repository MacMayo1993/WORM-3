import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// The synth writes to Web Audio, which jsdom has none of — feel() swallows that
// internally, so these assert the CONTRACT (every event resolves, nothing throws,
// haptics respect the setting) rather than the waveform.
import { feel, setFeelEnabled } from '../utils/feel.js';
import { coalescePopup } from '../components/overlays/ParityWallet.jsx';

const CUBE_EVENTS = ['cubeTurn', 'cubeShuffleTurn', 'cubeFlip', 'cubeRefuse', 'cubeSolved', 'cubeReset'];

describe('the cube has a voice', () => {
  let vibrated;
  beforeEach(() => {
    vibrated = [];
    vi.stubGlobal('navigator', { vibrate: (p) => { vibrated.push(p); return true; } });
    setFeelEnabled({ sfx: true, haptics: true });
  });

  it('fires every cube event without throwing where Web Audio is absent', () => {
    for (const e of CUBE_EVENTS) {
      expect(() => feel(e), e).not.toThrow();
    }
  });

  it('gives every cube event a haptic, so the cube is never silent to the hand', () => {
    for (const e of CUBE_EVENTS) {
      vibrated.length = 0;
      feel(e, { combo: 0, cap: 6 });
      // The shuffle turn is the one deliberate exception: a 25-move scramble
      // must not buzz 25 times.
      if (e === 'cubeShuffleTurn') expect(vibrated, e).toEqual([]);
      else expect(vibrated.length, e).toBe(1);
    }
  });

  it('escalates the flip haptic as a tile approaches its cap', () => {
    const kick = (flips, cap) => {
      vibrated.length = 0;
      feel('cubeFlip', { combo: flips, cap });
      const p = vibrated[0];
      return p[p.length - 1]; // the snap, the final pulse
    };
    expect(kick(0, 6)).toBeLessThan(kick(3, 6));
    expect(kick(3, 6)).toBeLessThan(kick(6, 6));
  });

  it('reads the flip cap in force, not a hardcoded one', () => {
    // Disparity runs a configurable cap (3/8/13/20). Three flips is nearly dead
    // on a cap of 3 and barely worn on a cap of 20; the kick must say so.
    const kick = (flips, cap) => {
      vibrated.length = 0;
      feel('cubeFlip', { combo: flips, cap });
      const p = vibrated[0];
      return p[p.length - 1];
    };
    expect(kick(3, 3)).toBeGreaterThan(kick(3, 20));
  });

  it('survives a missing or nonsensical cap rather than dividing by zero', () => {
    for (const cap of [undefined, 0, -1, NaN]) {
      vibrated.length = 0;
      expect(() => feel('cubeFlip', { combo: 2, cap })).not.toThrow();
      const p = vibrated[0];
      expect(p.every((n) => Number.isFinite(n)), `cap=${cap}`).toBe(true);
    }
  });

  it('respects the haptics setting — the old direct-vibrate call did not', () => {
    setFeelEnabled({ sfx: true, haptics: false });
    feel('cubeFlip', { combo: 2, cap: 6 });
    feel('cubeTurn');
    expect(vibrated).toEqual([]);
  });

  it('ignores an unknown event instead of throwing', () => {
    expect(() => feel('nonsenseEvent')).not.toThrow();
    expect(vibrated).toEqual([]);
  });
});

describe('no dead sound paths remain', () => {
  // The whole point of this change: the cube called play('/sounds/*.mp3')
  // against files that were never shipped. A reintroduced call would be silent
  // in exactly the way that took this long to notice.
  const FILES = [
    'src/hooks/useCubeState.js',
    'src/hooks/useAnimation.js',
    'src/hooks/useGameSession.js',
    'src/3d/StickerPlane.jsx',
    'src/components/intro/IntroScene.jsx',
    'src/worm/PlatformerWormMode.jsx',
    'src/coming-soon/worm/shared/useGameEvents.js',
  ];

  it('no source calls play() on a sound file that does not exist', () => {
    for (const f of FILES) {
      const src = readFileSync(f, 'utf8');
      const hits = src.match(/(?<!\/\/[^\n]*)\bplay\('\/sounds\//g);
      expect(hits, `${f} still calls play('/sounds/…')`).toBeNull();
    }
  });

  it('audio.js no longer exports the dead pool', async () => {
    const mod = await import('../utils/audio.js');
    expect(mod.play).toBeUndefined();
    expect(mod.preload).toBeUndefined();
    // vibrateFlip moved into feel()'s haptic table so one dispatch owns both
    // halves of the feedback — and so it obeys the player's haptics setting.
    expect(mod.vibrateFlip).toBeUndefined();
    expect(typeof mod.vibrate).toBe('function');
  });
});

describe('the wallet names the amount, and coalesces bursts', () => {
  it('shows a single earn as itself', () => {
    expect(coalescePopup(null, 15, 1)).toEqual({ amount: 15, seq: 1 });
  });

  it('sums a burst rather than stacking a column of small numbers', () => {
    // A worm run pays +1 every five seconds and +5 an orb; six overlapping
    // popups would be noise, one growing number is a reward.
    let p = coalescePopup(null, 5, 1);
    p = coalescePopup(p, 5, 2);
    p = coalescePopup(p, 1, 3);
    expect(p).toEqual({ amount: 11, seq: 3 });
  });

  it('advances seq every time so the animation actually replays', () => {
    const a = coalescePopup(null, 5, 1);
    const b = coalescePopup(a, 5, 2);
    expect(b.seq).not.toBe(a.seq);
  });

  it('lets a spend replace a live earn instead of netting against it', () => {
    // +50 showing, then a 150 purchase. Netting would render "−100", which
    // describes neither thing that happened.
    const earn = coalescePopup(null, 50, 1);
    expect(coalescePopup(earn, -150, 2)).toEqual({ amount: -150, seq: 2 });
  });

  it('sums consecutive spends', () => {
    let p = coalescePopup(null, -100, 1);
    p = coalescePopup(p, -50, 2);
    expect(p.amount).toBe(-150);
  });
});
