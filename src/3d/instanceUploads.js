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

export function setInstanceCount(mesh, count) {
  if (!mesh) return;
  mesh.count = count;
  mesh.visible = count > 0;
}
