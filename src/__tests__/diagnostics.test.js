import { afterEach, describe, expect, it } from 'vitest';
import { clearRecordedErrors, formatDiagnostics, installErrorCapture, recordError, recordedErrors } from '../utils/diagnostics.js';

afterEach(clearRecordedErrors);

describe('error log', () => {
  it('keeps the last twenty errors, oldest dropped first', () => {
    for (let i = 0; i < 25; i++) recordError('test', new Error(`boom ${i}`), 1000 + i);
    const kept = recordedErrors();
    expect(kept).toHaveLength(20);
    expect(kept[0].message).toBe('boom 5');
    expect(kept.at(-1).message).toBe('boom 24');
  });

  it('records a message for things that are not Errors, and trims long stacks', () => {
    recordError('test', 'plain string');
    recordError('test', undefined);
    recordError('test', { message: 'object', stack: 'x'.repeat(5000) });
    const [a, b, c] = recordedErrors();
    expect(a.message).toBe('plain string');
    expect(b.message).toBe('(no message)');
    expect(c.stack.length).toBeLessThanOrEqual(700);
  });

  it('captures uncaught errors and rejected promises until uninstalled', () => {
    // Message-only events: vitest treats a window 'error' event that carries an Error as a real crash.
    const uninstall = installErrorCapture(window);
    window.dispatchEvent(Object.assign(new Event('error'), { message: 'uncaught' }));
    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new Error('rejected') }));
    uninstall();
    window.dispatchEvent(Object.assign(new Event('error'), { message: 'after' }));
    expect(recordedErrors().map(e => `${e.source}:${e.message}`)).toEqual(['error:uncaught', 'unhandledrejection:rejected']);
  });
});

describe('formatDiagnostics', () => {
  const fakeWindow = (search = '') => ({
    location: { origin: 'https://example.test', pathname: '/WORM-3/', search },
    innerWidth: 412, innerHeight: 915, devicePixelRatio: 2.625,
    matchMedia: () => ({ matches: true }),
    navigator: { userAgent: 'TestAgent/1.0', maxTouchPoints: 5, deviceMemory: 4, hardwareConcurrency: 8, onLine: false, serviceWorker: { controller: {} } }
  });

  it('describes the device and the recent errors', () => {
    recordError('render', new Error('mesh.dispose is not a function'), Date.UTC(2026, 9, 8));
    const out = formatDiagnostics({ win: fakeWindow(), now: Date.UTC(2026, 9, 8, 12), mode: 'production' });
    expect(out).toContain('time: 2026-10-08T12:00:00.000Z');
    expect(out).toContain('build: production');
    expect(out).toContain('browser: TestAgent/1.0');
    expect(out).toContain('screen: 412x915 @2.625x');
    expect(out).toContain('touch: yes');
    expect(out).toContain('memory/cores: 4 GB / 8');
    expect(out).toContain('online: false');
    expect(out).toContain('service worker: controlling');
    expect(out).toContain('reduced motion: true');
    expect(out).toContain('last 1 error:');
    expect(out).toContain('render: mesh.dispose is not a function');
  });

  it('never includes the query string or anything from storage', () => {
    localStorage.setItem('worm3_player', '{"secret":"save"}');
    const out = formatDiagnostics({ win: fakeWindow('?unlockall=1&token=abc') });
    expect(out).toContain('page: https://example.test/WORM-3/');
    expect(out).not.toContain('unlockall');
    expect(out).not.toContain('token');
    expect(out).not.toContain('secret');
    localStorage.removeItem('worm3_player');
  });

  it('lists a current error the log has not seen yet, once', () => {
    const error = new Error('fresh crash');
    const win = { location: {}, matchMedia: () => ({ matches: false }), navigator: {} };
    // One entry per error: a stack's first line repeats the message, so count entry lines.
    const count = out => out.split('\n').filter(line => line.startsWith('- [') && line.includes('fresh crash')).length;
    expect(count(formatDiagnostics({ win, error }))).toBe(1);
    recordError('render', error);
    expect(count(formatDiagnostics({ win, error }))).toBe(1);
  });

  it('survives a window with no navigator details', () => {
    expect(() => formatDiagnostics({ win: { location: {}, matchMedia: () => { throw new Error('no'); } } })).not.toThrow();
  });
});
