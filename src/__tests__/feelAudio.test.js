import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { feel, setFeelEnabled, stopFeel, resumeFeel } from '../utils/feel.js';
import { createWormFeedback } from '../worm/wormFeedback.js';

const sources = [];
const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: param(), frequency: param(), Q: param() });
let context;
class AudioContext {
  constructor() { this.state = 'running'; this.currentTime = 10; this.sampleRate = 8000; this.destination = {}; context = this; }
  createGain() { return node(); }
  createBiquadFilter() { return node(); }
  createBuffer(channels, size) { return { getChannelData: () => new Float32Array(size) }; }
  createBufferSource() { const source = { ...node(), kind: 'noise', start: vi.fn(), stop: vi.fn() }; sources.push(source); return source; }
  createOscillator() { const source = this.createBufferSource(); source.kind = 'tone'; return source; }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
beforeEach(() => {
  vi.useFakeTimers();
  stopFeel(); sources.length = 0;
  vi.stubGlobal('AudioContext', AudioContext);
  vi.stubGlobal('navigator', { vibrate: vi.fn() });
  setFeelEnabled({ sfx: true, haptics: true });
  if (context) context.state = 'running';
});
afterEach(() => { stopFeel(); vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function suspendedInput(event, afterSound = () => {}) {
  resumeFeel(); context.state = 'suspended';
  let settle;
  vi.spyOn(context, 'resume').mockImplementation(() => new Promise((resolve, reject) => {
    settle = (success = true) => {
      if (success) { context.state = 'running'; resolve(); }
      else reject(new Error('Audio locked'));
    };
  }));
  const button = document.createElement('button');
  document.body.append(button);
  button.addEventListener(event, () => { feel('cubeTurn'); afterSound(); });
  button.dispatchEvent(new Event(event, { bubbles: true }));
  button.remove();
  return settle;
}

describe('audio and motor lifecycle', () => {
  it.each(['pointerdown', 'keydown', 'touchstart'])('plays tone and noise from the first %s after async unlock', async event => {
    const settle = suspendedInput(event);
    expect(context.resume).toHaveBeenCalledOnce();
    expect(sources).toHaveLength(0);
    expect(navigator.vibrate).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(20);
    settle();
    await vi.advanceTimersByTimeAsync(0);
    expect(sources.map(source => source.kind)).toEqual(['noise', 'tone']);
    expect(navigator.vibrate).toHaveBeenCalledOnce();
  });
  it.each(['pause', 'mute', 'rejection', 'late'])('discards a pending first-input sound on %s', async reason => {
    const settle = suspendedInput('pointerdown');
    if (reason === 'pause') stopFeel();
    if (reason === 'mute') { setFeelEnabled({ sfx: false }); setFeelEnabled({ sfx: true }); }
    await vi.advanceTimersByTimeAsync(reason === 'late' ? 201 : 20);
    settle(reason !== 'rejection');
    await vi.advanceTimersByTimeAsync(0);
    expect(sources).toHaveLength(0);
  });
  it('cancels a pending sound even before the bubbling unlock listener runs', async () => {
    const settle = suspendedInput('keydown', () => stopFeel());
    settle();
    await vi.advanceTimersByTimeAsync(0);
    expect(sources).toHaveLength(0);
  });
  it('also preserves effects handled after the window unlock listener', async () => {
    const listener = () => feel('jump');
    resumeFeel();
    window.addEventListener('pointerdown', listener, { once: true });
    const settle = suspendedInput('pointerdown');
    await vi.advanceTimersByTimeAsync(20);
    settle();
    await vi.advanceTimersByTimeAsync(0);
    expect(sources.map(source => source.kind)).toEqual(['noise', 'tone', 'tone']);
  });
  it('creates finite voices and releases their graph when playback ends', () => {
    const feedback = createWormFeedback(); feedback.emit('orb', { combo: 3 });
    expect(sources).toHaveLength(3);
    for (const source of sources) {
      expect(source.start.mock.calls[0][0]).toBeGreaterThanOrEqual(10);
      expect(source.stop.mock.calls[0][0]).toBeGreaterThan(source.start.mock.calls[0][0]);
      source.onended(); expect(source.disconnect).toHaveBeenCalledOnce();
      source.onended(); expect(source.disconnect).toHaveBeenCalledOnce();
    }
  });
  it('stops live and scheduled sounds plus vibration immediately on pause', () => {
    const feedback = createWormFeedback(); feedback.emit('orb');
    feedback.hold(true);
    expect(navigator.vibrate).toHaveBeenLastCalledWith(0);
    for (const source of sources) expect(source.stop).toHaveBeenLastCalledWith();
    const count = sources.length;
    feedback.emit('shot'); expect(sources).toHaveLength(count);
  });
  it('gates sound and vibration independently and cancels each active channel on disable', () => {
    const feedback = createWormFeedback(); feedback.emit('dive');
    setFeelEnabled({ sfx: false });
    for (const source of sources) expect(source.stop).toHaveBeenLastCalledWith();
    expect(navigator.vibrate.mock.lastCall[0]).not.toBe(0);
    setFeelEnabled({ haptics: false }); expect(navigator.vibrate).toHaveBeenLastCalledWith(0);
    sources.length = 0; navigator.vibrate.mockClear();
    feedback.emit('shot'); expect(sources).toHaveLength(0); expect(navigator.vibrate).not.toHaveBeenCalled();
    setFeelEnabled({ sfx: true }); feedback.emit('enemyDown');
    expect(sources.length).toBeGreaterThan(0); expect(navigator.vibrate).not.toHaveBeenCalled();
  });
  it('keeps a quiet UI tap from truncating a stronger impact', () => {
    createWormFeedback().emit('heal');
    const count = navigator.vibrate.mock.calls.length;
    feel('uiKey'); expect(navigator.vibrate).toHaveBeenCalledTimes(count);
  });
  it('does not queue stale effects while browser audio is suspended', async () => {
    resumeFeel(); context.state = 'suspended';
    createWormFeedback().emit('shot'); expect(sources).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    resumeFeel(); expect(context.state).toBe('running');
    await vi.advanceTimersByTimeAsync(0);
    expect(sources).toHaveLength(0);
    createWormFeedback().emit('shot'); expect(sources).toHaveLength(3);
  });
});
