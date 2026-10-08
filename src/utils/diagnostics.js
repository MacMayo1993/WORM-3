// A small, local record of what went wrong, for the "copy details" button on the
// crash screen. Nothing here is sent anywhere: the player decides whether to paste
// it into the feedback form. It holds the last few errors and a handful of facts
// about the device that explain most "it's blank on my phone" reports, and
// deliberately nothing else — no save data, no query string, no identifiers.

const MAX_ERRORS = 20;
const MAX_STACK = 700;
const errors = [];

const text = value => String(value ?? '').replace(/\s+\n/g, '\n').trim();

export function recordError(source, error, now = Date.now()) {
  const message = text(error?.message ?? error) || '(no message)';
  const stack = error?.stack ? text(error.stack).slice(0, MAX_STACK) : '';
  errors.push({ at: now, source, message, stack });
  if (errors.length > MAX_ERRORS) errors.shift();
}

export const recordedErrors = () => errors.slice();
export const clearRecordedErrors = () => { errors.length = 0; };

/** Capture uncaught errors and rejected promises. Returns an uninstall function. */
export function installErrorCapture(win = window) {
  const onError = event => recordError('error', event.error ?? event.message);
  const onRejection = event => recordError('unhandledrejection', event.reason);
  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onRejection);
  return () => {
    win.removeEventListener('error', onError);
    win.removeEventListener('unhandledrejection', onRejection);
  };
}

const safe = fn => { try { return fn(); } catch { return undefined; } };

/** The text the player can paste into a bug report. */
export function formatDiagnostics({ win = window, now = Date.now(), mode = import.meta.env?.MODE, error } = {}) {
  const nav = win.navigator || {};
  const lines = [
    'WORM³ diagnostics',
    `time: ${new Date(now).toISOString()}`,
    `build: ${mode ?? 'unknown'}`,
    // The path only: a query string can carry test flags or share links.
    `page: ${safe(() => win.location.origin + win.location.pathname)}`,
    `browser: ${nav.userAgent}`,
    `screen: ${win.innerWidth}x${win.innerHeight} @${win.devicePixelRatio || 1}x`,
    `touch: ${nav.maxTouchPoints > 0 ? 'yes' : 'no'}`,
    `memory/cores: ${nav.deviceMemory ?? '?'} GB / ${nav.hardwareConcurrency ?? '?'}`,
    `online: ${nav.onLine}`,
    `service worker: ${nav.serviceWorker?.controller ? 'controlling' : 'none'}`,
    `reduced motion: ${safe(() => win.matchMedia('(prefers-reduced-motion: reduce)').matches)}`,
  ];
  // A boundary renders before it has recorded the error that tripped it, so it
  // hands that error in; it is listed once, not twice, once the log has it.
  const shown = errors.slice();
  if (error && shown.at(-1)?.message !== (text(error?.message ?? error) || '(no message)')) {
    shown.push({ at: now, source: 'render', message: text(error?.message ?? error) || '(no message)', stack: error?.stack ? text(error.stack).slice(0, MAX_STACK) : '' });
  }
  if (shown.length) {
    lines.push('', `last ${shown.length} error${shown.length === 1 ? '' : 's'}:`);
    for (const e of shown) {
      lines.push(`- [${new Date(e.at).toISOString()}] ${e.source}: ${e.message}`);
      if (e.stack) lines.push(...e.stack.split('\n').slice(0, 6).map(line => `    ${line.trim()}`));
    }
  }
  return lines.join('\n');
}
