import { Vector3 } from 'three';

// Only the shared frame and 24 tiny per-motif transforms change on the CPU.
// The individual curve points and group copies stay in immutable GPU buffers.
export function createMotifMotion(model) {
  const center = new Vector3(), axis = new Vector3(), tangent = new Vector3(), offset = new Vector3();
  const first = new Vector3(), second = new Vector3(), base = new Vector3(...model.center);
  const turns = Array.from({ length: 24 }, () => new Vector3(1, 0, 1));
  return {
    center, first, second, turns,
    update(time) {
      const s = model.recipe;
      center.copy(base);
      axis.set(Math.abs(base.z) < 0.9 ? 0 : 1, 0, Math.abs(base.z) < 0.9 ? 1 : 0).cross(base).normalize();
      tangent.crossVectors(base, axis);
      const x = s.drift * Math.sin(0.11 * model.d1 * time);
      const y = s.drift * Math.sin(0.07 * model.d2 * time + 1.3), r = Math.hypot(x, y);
      if (r > 1e-9) {
        offset.copy(axis).multiplyScalar(x / r).addScaledVector(tangent, y / r);
        center.multiplyScalar(Math.cos(r)).addScaledVector(offset, Math.sin(r));
      }
      axis.set(Math.abs(center.z) < 0.9 ? 0 : 1, 0, Math.abs(center.z) < 0.9 ? 1 : 0).cross(center).normalize();
      tangent.crossVectors(center, axis);
      const spin = 0.12 * s.spin * time * model.chir, cs = Math.cos(spin), sn = Math.sin(spin);
      first.copy(axis).multiplyScalar(cs).addScaledVector(tangent, sn);
      second.copy(axis).multiplyScalar(-sn).addScaledVector(tangent, cs);
      model.strokes.forEach((stroke, i) => {
        const a = s.wobble * stroke.wob * Math.sin(0.4 * time + stroke.phase);
        turns[i].set(Math.cos(a), Math.sin(a), 1 + 0.08 * s.wobble * Math.sin(0.5 * time + stroke.phase * 1.7));
      });
    },
  };
}
