// Count lesson time only while its controls are available. Cancellation is
// explicit so exiting/retrying cannot leave an old callback behind.
export function demoTimer(callback, delay, blocked) {
  let remaining = delay, last = Date.now();
  const id = setInterval(() => {
    const now = Date.now(), elapsed = now - last;
    last = now;
    if (blocked()) return;
    remaining -= elapsed;
    if (remaining <= 0) { clearInterval(id); callback(); }
  }, 50);
  return { cancel: () => clearInterval(id) };
}
