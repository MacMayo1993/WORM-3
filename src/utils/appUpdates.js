// A mobile PWA can stay alive for days without another navigation. Registration
// alone does not discover subsequent deploys, so also check on resume and online.
export const UPDATE_CHECK_MS = 5 * 60 * 1000;
const RESUME_CHECK_MS = 10000;

export function showUpdateToast(refreshGame, doc = document) {
  if (doc.getElementById('worm3-update-toast')) return;
  const toast = doc.createElement('div');
  toast.id = 'worm3-update-toast';
  toast.setAttribute('role', 'status');
  toast.style.cssText = [
    'position:fixed', 'left:50%', 'top:max(16px, env(safe-area-inset-top))', 'transform:translateX(-50%)',
    // Above the store (100000) and progression screen (100100).
    'z-index:100200', 'display:flex', 'align-items:center', 'gap:8px',
    'width:max-content', 'max-width:calc(100vw - 24px)', 'box-sizing:border-box',
    'padding:10px 12px', 'border-radius:12px',
    'background:var(--night-sheet,#18251d)', 'color:var(--night-text,#fffdf2)',
    'border:1px solid var(--night-border,#839780)', 'box-shadow:0 8px 28px #0007',
    'font:600 13px system-ui,sans-serif',
  ].join(';');
  const label = doc.createElement('span');
  label.textContent = 'A game update is ready.';
  label.style.cssText = 'flex:1;min-width:0;line-height:1.3';
  const refresh = doc.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'Refresh game';
  refresh.style.cssText = 'border:none;cursor:pointer;border-radius:8px;padding:6px 12px;min-height:48px;font:inherit;color:#fff;background:var(--ui-moss,#315c3a);flex-shrink:0';
  refresh.addEventListener('click', async () => {
    refresh.disabled = true;
    refresh.textContent = 'Refreshing…';
    try { await refreshGame(); } catch {
      label.textContent = 'Could not update. Try again.';
      refresh.textContent = 'Refresh game';
      refresh.disabled = false;
    }
  });
  const dismiss = doc.createElement('button');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Dismiss update');
  dismiss.textContent = '✕';
  dismiss.style.cssText = 'border:none;cursor:pointer;background:transparent;color:inherit;min-width:44px;min-height:48px;font:inherit;flex-shrink:0';
  dismiss.addEventListener('click', () => toast.remove());
  toast.append(label, refresh, dismiss);
  doc.body.appendChild(toast);
}

export function watchForAppUpdates(registration, notify, win = window, doc = document) {
  let stopped = false, checking = false, lastCheck = -Infinity;
  const check = async () => {
    if (stopped || doc.visibilityState === 'hidden') return;
    // A waiting build is already downloaded, even when the player is offline.
    if (registration.waiting) { notify(); return; }
    if (win.navigator.onLine === false || checking || Date.now() - lastCheck < RESUME_CHECK_MS) return;
    checking = true;
    lastCheck = Date.now();
    try {
      await registration.update();
      if (!stopped && doc.visibilityState !== 'hidden' && registration.waiting) notify();
    } catch { /* Offline or a deploy in flight: retry on the next check. */ }
    finally { checking = false; }
  };
  const timer = win.setInterval(check, UPDATE_CHECK_MS);
  win.addEventListener('focus', check);
  win.addEventListener('pageshow', check);
  win.addEventListener('online', check);
  doc.addEventListener('visibilitychange', check);
  check();
  return () => {
    stopped = true;
    win.clearInterval(timer);
    win.removeEventListener('focus', check);
    win.removeEventListener('pageshow', check);
    win.removeEventListener('online', check);
    doc.removeEventListener('visibilitychange', check);
  };
}

export function installAppUpdates(registerSW, win = window, doc = document) {
  let stopped = false, idleId, timerId, stopWatching;
  let refreshRequested = false, activated = false, reloading = false;
  let updateSW;
  const reloadOnce = () => {
    if (reloading || stopped) return;
    reloading = true;
    win.location.reload();
  };
  const notify = () => {
    if (stopped) return;
    showUpdateToast(async () => {
      refreshRequested = true;
      // Another tab may already have activated the new worker. The current run
      // still waits for this player's Refresh game click before reloading.
      if (activated) reloadOnce();
      else await updateSW(true);
    }, doc);
  };
  const register = () => {
    if (stopped) return;
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh: notify,
      onNeedReload() {
        activated = true;
        if (refreshRequested) reloadOnce();
        else notify();
      },
      onRegisteredSW(_url, registration) {
        if (!stopped && registration) stopWatching = watchForAppUpdates(registration, notify, win, doc);
      },
    });
  };
  const schedule = () => {
    // Busy animation frames must not postpone registration indefinitely.
    if (win.requestIdleCallback) idleId = win.requestIdleCallback(register, { timeout: 2000 });
    else timerId = win.setTimeout(register, 200);
  };
  if (doc.readyState === 'complete') schedule();
  else win.addEventListener('load', schedule, { once: true });
  return () => {
    stopped = true;
    win.removeEventListener('load', schedule);
    if (idleId !== undefined) win.cancelIdleCallback?.(idleId);
    if (timerId !== undefined) win.clearTimeout(timerId);
    stopWatching?.();
    doc.getElementById('worm3-update-toast')?.remove();
  };
}
