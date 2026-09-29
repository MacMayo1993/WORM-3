import { Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Matrix3, ShapeUtils, Vector2 } from 'three';

// Both tiers retain every group copy and every motif. Only curve tessellation
// changes. Screen-space capsules conceal joins at the lower sample count.
export const GPU_QUALITY = {
  normal: { size: 640, points: 64, fps: 60, triangles: 260000 },
  mobile: { size: 512, points: 48, fps: 60, triangles: 190000 },
  reduced: { size: 384, points: 32, fps: 30, triangles: 150000 },
};

export function createMotifGeometry(model, quality, useAtlas = false) {
  const data = { position: [], ends: [], curve: [], style: [], extra: [] }, indices = [];
  const motion = { position: [], center: [], pixel: [] };
  const register = (p, stroke, id) => {
    const index = motion.pixel.length / 2;
    for (let half = 0; half < 2; half++) {
      motion.position.push(...p, id); motion.center.push(stroke.cu, stroke.cv); motion.pixel.push(2 * index + half);
    }
    return [index, 0];
  };
  let vertices = 0;
  const recipe = model.recipe;
  const copies = model.groups.length * 2;
  const dots = model.strokes.filter(s => s.dots).reduce((n, s) => n + 2 * s.u.length, 0);
  const curveCost = model.strokes.filter(s => !s.dots).reduce((n, s) => n + (s.closed && recipe.fill > 0 ? 3 : 2), 0);
  const samples = Math.min(quality.points, Math.max(12, Math.floor((quality.triangles / copies - dots) / Math.max(1, curveCost))));
  function vertex(position, a, b, curve, style, extra) {
    data.position.push(...position); data.ends.push(...a, ...b);
    data.curve.push(...curve); data.style.push(...style); data.extra.push(...extra);
    return vertices++;
  }
  if (recipe.showMotif) model.strokes.forEach((stroke, id) => {
    // Preserve endpoints, closure, and every dot. Uniform sampling is in the
    // original curve parameter, so the seed and chirality are unchanged.
    const count = Math.min(stroke.u.length, stroke.dots ? 24 : samples);
    const points = Array.from({ length: count }, (_, i) => {
      const k = i * (stroke.u.length - (stroke.closed ? 0 : 1)) / (stroke.closed ? count : count - 1);
      const lo = Math.floor(k), hi = (lo + 1) % stroke.u.length, mix = k - lo;
      return [stroke.u[lo] * (1 - mix) + stroke.u[hi] * mix, stroke.v[lo] * (1 - mix) + stroke.v[hi] * mix];
    });
    const bound = Math.max(...points.map(p => Math.hypot(p[0] - stroke.cu, p[1] - stroke.cv))) * recipe.reach * (1 + 0.08 * recipe.wobble);
    const center = useAtlas ? register([stroke.cu, stroke.cv], stroke, id) : [stroke.cu, stroke.cv];
    const locations = useAtlas ? points.map(p => register(p, stroke, id)) : points;
    const curve = [...center, id, Math.sin(Math.min(Math.PI / 2, bound))];
    const extent = Math.sin(Math.min(Math.PI / 2, bound + Math.hypot(stroke.cu, stroke.cv) * recipe.reach));
    const width = stroke.w * 2 * recipe.weight * (stroke.dots ? 0.8 : 1);
    const style = [width, stroke.alpha * recipe.opacity, stroke.ci, 0];
    if (stroke.closed && recipe.fill > 0) {
      // Triangulate in the motif's own plane once, before the GPU exponential map.
      const faces = ShapeUtils.triangulateShape(points.map(p => new Vector2(...p)), []);
      const start = vertices;
      for (const p of locations) vertex([0, 0, 2], p, p, curve, [width, style[1] * recipe.fill, stroke.ci, 0], [0, 1, extent]);
      for (const face of faces) indices.push(...face.map(i => i + start));
    }
    let length = 0;
    for (let i = 0; i < (stroke.dots || stroke.closed ? count : count - 1); i++) {
      const a = points[i], b = stroke.dots ? a : points[(i + 1) % count];
      const segmentLength = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const st = [width, style[1], stroke.ci, length], extra = [segmentLength, stroke.dots ? 0.6 + 1.8 * i / count : 1, extent];
      const start = vertices;
      for (const [end, side] of [[0, -1], [1, -1], [1, 1], [0, 1]]) vertex([end, side, stroke.dots ? 1 : 0], locations[i], locations[stroke.dots ? i : (i + 1) % count], curve, st, extra);
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      length += segmentLength;
    }
  });
  const geometry = new InstancedBufferGeometry();
  for (const [key, size] of [['position', 3], ['ends', 4], ['curve', 4], ['style', 4], ['extra', 3]]) geometry.setAttribute(key, new Float32BufferAttribute(data[key], size));
  geometry.setIndex(indices);
  const columns = [[], [], []], view = new Matrix3().set(...recipe.V), transform = new Matrix3();
  const character = recipe.mode === 'parity' && model.characters.length ? model.characters[recipe.phi % model.characters.length] : null;
  model.groups.forEach((matrix, i) => {
    transform.set(...matrix).premultiply(view);
    const e = transform.elements;
    // Separate clipped representatives cover crossings of the RP² disk rim.
    for (const sheet of [1, -1]) {
      columns[0].push(e[0], e[1], e[2], character ? character[i] : (sheet < 0 ? 1 : 0));
      columns[1].push(e[3], e[4], e[5], sheet);
      columns[2].push(e[6], e[7], e[8]);
    }
  });
  for (let i = 0; i < 3; i++) geometry.setAttribute(`group${i}`, new InstancedBufferAttribute(new Float32Array(columns[i]), i === 2 ? 3 : 4));
  geometry.instanceCount = model.groups.length * 2;
  geometry.userData.triangles = indices.length / 3 * geometry.instanceCount;
  geometry.userData.motion = motion;
  return geometry;
}
