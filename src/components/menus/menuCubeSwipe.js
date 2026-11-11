import { Quaternion, Vector3 } from 'three';

const DRAG_SLOP = 8;
const DAMPING = 5;
const MAX_SPEED = 6;
const STOP_SPEED = 0.025;

// One owner for touch-vs-tap arbitration. Rotations are in the camera's screen
// plane, so dragging right/up remains right/up after any number of turns.
export function createMenuCubeSwipe({ camera, span, canInteract, reducedMotion, onTap, onPress, onRelease }) {
  const offset = new Quaternion(), turn = new Quaternion(), axis = new Vector3();
  const velocity = new Vector3(), sample = new Vector3();
  let pointer = null, target = null, startX = 0, startY = 0, lastX = 0, lastY = 0;
  let lastAt = 0, movedAt = 0, dragging = false, suppressClick = false, radiansPerPixel = 0;
  let canvas = null, owner = null, lostFrame = null;
  const nativeCancel = event => { if (event.pointerId === pointer) cancel(); };
  // R3F 8 clears its capture map without forwarding these two native events.
  // A lost capture can precede pointerup, so allow that release to finish first.
  const nativeLost = event => {
    if (event.pointerId !== pointer || lostFrame !== null) return;
    lostFrame = owner?.requestAnimationFrame(() => { lostFrame = null; nativeCancel(event); });
  };
  const secondTouch = event => {
    if (event.pointerType === 'touch' && event.pointerId !== pointer) cancel();
  };
  const release = () => {
    const id = pointer, capture = target;
    pointer = null; target = null;
    canvas?.removeEventListener?.('pointercancel', nativeCancel);
    canvas?.removeEventListener?.('lostpointercapture', nativeLost);
    owner?.removeEventListener('pointerdown', secondTouch, true);
    if (lostFrame !== null) owner?.cancelAnimationFrame(lostFrame);
    lostFrame = null; canvas = null; owner = null;
    // A browser cancellation may already have released the native capture.
    try { if (id !== null) capture?.releasePointerCapture?.(id); } catch { /* already released */ }
  };
  const rotate = (vector, amount) => {
    if (amount <= 0) return;
    axis.copy(vector).normalize();
    offset.premultiply(turn.setFromAxisAngle(axis, amount)).normalize();
  };
  const cancel = () => {
    if (pointer !== null) suppressClick = true;
    release(); dragging = false; velocity.set(0, 0, 0); onRelease();
  };
  const move = event => {
    if (pointer === null || event.pointerId !== pointer) return;
    event.stopPropagation();
    if (!canInteract()) { cancel(); return; }
    const dx = event.clientX - startX, dy = event.clientY - startY;
    if (!dragging && Math.hypot(dx, dy) < DRAG_SLOP) return;
    if (!dragging) { dragging = true; suppressClick = true; onRelease(); }
    const x = event.clientX - lastX, y = event.clientY - lastY;
    if (x || y) {
      // Positive screen Y points down. Positive rotation around screen X
      // also carries the cube's near side down, so both signs follow the hand.
      sample.set(y, x, 0).applyQuaternion(camera().quaternion).multiplyScalar(radiansPerPixel);
      rotate(sample, sample.length());
      const dt = Math.max(8, event.timeStamp - lastAt) / 1000;
      sample.divideScalar(dt).clampLength(0, MAX_SPEED);
      if (velocity.dot(sample) < 0) velocity.set(0, 0, 0);
      velocity.lerp(sample, .65).clampLength(0, MAX_SPEED);
      movedAt = event.timeStamp;
    }
    lastX = event.clientX; lastY = event.clientY; lastAt = event.timeStamp;
  };
  return {
    offset,
    get active() { return pointer !== null || velocity.lengthSq() > STOP_SPEED * STOP_SPEED; },
    cancel,
    step(delta) {
      if (pointer !== null) return;
      if (reducedMotion()) { velocity.set(0, 0, 0); return; }
      const speed = velocity.length();
      if (speed <= STOP_SPEED) { velocity.set(0, 0, 0); return; }
      const decay = Math.exp(-DAMPING * Math.min(delta, .05));
      // Integrate the exponential exactly; momentum is the same at 30/60 Hz.
      rotate(velocity, speed * (1 - decay) / DAMPING);
      velocity.multiplyScalar(decay);
    },
    handlers: {
      onPointerDown(event) {
        if (pointer !== null) {
          if (event.pointerId !== pointer) cancel();
          return;
        }
        if (!canInteract() || event.isPrimary === false) return;
        event.stopPropagation();
        suppressClick = false;
        velocity.set(0, 0, 0);
        onPress();
        if (event.pointerType !== 'touch') return;
        pointer = event.pointerId; target = event.target;
        startX = lastX = event.clientX; startY = lastY = event.clientY;
        movedAt = lastAt = event.timeStamp; dragging = false;
        radiansPerPixel = Math.PI / Math.max(220, span());
        canvas = event.nativeEvent?.target ?? event.target;
        owner = canvas?.ownerDocument?.defaultView;
        canvas?.addEventListener?.('pointercancel', nativeCancel);
        canvas?.addEventListener?.('lostpointercapture', nativeLost);
        owner?.addEventListener('pointerdown', secondTouch, true);
        target.setPointerCapture?.(pointer);
      },
      onPointerMove: move,
      onPointerUp(event) {
        if (pointer === null) { onRelease(); return; }
        if (event.pointerId !== pointer) return;
        move(event); // also catch a fast swipe delivered only on release
        if (pointer === null) return;
        const tap = !dragging;
        if (tap || reducedMotion() || event.timeStamp - movedAt > 100) velocity.set(0, 0, 0);
        release(); dragging = false; suppressClick = true; onRelease();
        if (tap && canInteract()) onTap();
      },
      onPointerCancel(event) { if (event.pointerId === pointer) cancel(); },
      onLostPointerCapture(event) { if (event.pointerId === pointer) cancel(); },
      onPointerLeave() { if (pointer === null) onRelease(); },
      onClick(event) {
        event.stopPropagation();
        // Touch taps commit on release. Suppress their compatibility click,
        // and never let an out-and-back swipe become a tap at its origin.
        if (!suppressClick && canInteract()) onTap();
      },
    },
  };
}
