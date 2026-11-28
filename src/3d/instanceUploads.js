import { InstancedBufferAttribute } from 'three';

// Attribute ranges are in scalar elements, not bytes. Keep pending writes until
// the renderer consumes them: a culled/hidden mesh can miss several frames.
export function uploadInstancePrefix(attribute, count) {
  if (!attribute || count <= 0) return;
  let end = Math.min(attribute.array.length, count * attribute.itemSize);
  for (const range of attribute.updateRanges) end = Math.max(end, range.start + range.count);
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, end);
  attribute.needsUpdate = true;
}

// Upload only items [first, end) — the span a frame actually wrote — merged with
// any span still pending from frames the renderer has not drawn yet. A batch
// whose tiles mostly hold still (the worm presses a few, the rest rest) then
// sends those few, not the whole buffer.
export function uploadInstanceRange(attribute, first, end) {
  if (!attribute || end <= first) return;
  const size = attribute.itemSize;
  let start = first * size, stop = Math.min(attribute.array.length, end * size);
  for (const range of attribute.updateRanges) {
    start = Math.min(start, range.start);
    stop = Math.max(stop, range.start + range.count);
  }
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(start, stop - start);
  attribute.needsUpdate = true;
}

export function setInstanceCount(mesh, count) {
  if (!mesh) return;
  mesh.count = count;
  mesh.visible = count > 0;
}

// setColorAt creates the colour buffer on first use, and its arrival switches the
// material to another program (USE_INSTANCING_COLOR). A pooled effect that starts
// empty therefore compiled one variant at the run-start warm-up and linked the
// real one in the frame it first appeared. Allocate the buffer up front instead.
export function ensureInstanceColor(mesh) {
  if (mesh?.isInstancedMesh && !mesh.instanceColor) {
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 3), 3);
  }
}
