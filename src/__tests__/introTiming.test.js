import { describe, it, expect } from 'vitest';
import {
  BLUE_REVEAL_START, BLUE_REVEAL_END,
  HINT_TILT_START, HINT_TILT_END,
  GREEN_SHOW_START, GREEN_SHOW_END,
  FULL_FLIP_START, FULL_FLIP_END,
  TUNNEL_FORM_START,
  EXPLOSION_START, EXPLOSION_END,
  WORM_START,
  IMPLODE_START, IMPLODE_END,
} from '../components/intro/introTiming.js';

describe('introTiming constants', () => {
  it('exports all required timing constants as numbers', () => {
    const constants = [
      BLUE_REVEAL_START, BLUE_REVEAL_END,
      HINT_TILT_START, HINT_TILT_END,
      GREEN_SHOW_START, GREEN_SHOW_END,
      FULL_FLIP_START, FULL_FLIP_END,
      TUNNEL_FORM_START,
      EXPLOSION_START, EXPLOSION_END,
      WORM_START,
      IMPLODE_START, IMPLODE_END,
    ];
    constants.forEach(c => expect(typeof c).toBe('number'));
  });

  it('phases are in strictly ascending order', () => {
    expect(BLUE_REVEAL_START).toBeLessThan(BLUE_REVEAL_END);
    expect(BLUE_REVEAL_END).toBeLessThanOrEqual(HINT_TILT_START);
    expect(HINT_TILT_END).toBeLessThanOrEqual(GREEN_SHOW_START);
    expect(GREEN_SHOW_END).toBeLessThanOrEqual(FULL_FLIP_START);
    expect(FULL_FLIP_END).toBeLessThan(TUNNEL_FORM_START);
    expect(TUNNEL_FORM_START).toBeLessThan(EXPLOSION_START);
    expect(EXPLOSION_START).toBeLessThan(EXPLOSION_END);
    expect(EXPLOSION_END).toBeLessThan(WORM_START);
    expect(WORM_START).toBeLessThan(IMPLODE_START);
    expect(IMPLODE_START).toBeLessThan(IMPLODE_END);
  });

  it('all phases complete within a reasonable total duration', () => {
    expect(IMPLODE_END).toBeLessThanOrEqual(30);
  });
});
