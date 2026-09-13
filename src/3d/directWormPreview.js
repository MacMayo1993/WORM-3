// One focused hero can temporarily borrow the persistent WebGL canvas. Small
// thumbnails continue to use the shared renderer's offscreen targets.
let current = null;
const listeners = new Set();
const notify = () => { for (const listener of listeners) listener(); };
export const subscribeDirectWormPreview = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const getDirectWormPreview = () => current;
export function registerDirectWormPreview(element, opts) {
    const entry = { element, opts, age: 0 };
    current?.release?.();
    current = entry;
    notify();
    return entry;
}
export function updateDirectWormPreview(entry, opts) {
    if (!entry) return;
    if (entry.opts.characterId !== opts.characterId) entry.age = 0;
    entry.opts = opts;
}
export function unregisterDirectWormPreview(entry) {
    if (current !== entry) return;
    entry.release?.();
    current = null;
    notify();
}

// Restore DOM ownership before React removes the Canvas or preview host.
export function borrowPreviewCanvas(canvas, host) {
    const parent = canvas.parentNode;
    const next = canvas.nextSibling;
    const style = canvas.style.cssText;
    host.appendChild(canvas);
    canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
    return () => {
        if (parent) parent.insertBefore(canvas, next?.parentNode === parent ? next : null);
        canvas.style.cssText = style;
    };
}
