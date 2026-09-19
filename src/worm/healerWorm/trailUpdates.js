// Persist instance transforms. Rotating tiles invalidate only the slots whose
// computed Float32 transform changed; unchanged paint needs no GPU upload.
export function writeTrailMatrix(mesh, index, matrix, range) {
  const array = mesh.instanceMatrix.array;
  const start = index * 16;
  for (let j = 0; j < 16; j++) {
    if (array[start + j] !== Math.fround(matrix.elements[j])) {
      mesh.setMatrixAt(index, matrix);
      range.start = Math.min(range.start, start);
      range.end = Math.max(range.end, start + 16);
      return;
    }
  }
}

export function uploadTrailRange(attribute, start, end) {
  if (!attribute || end <= start) return;
  // Merge pending work too: an off-camera mesh may not have uploaded yet.
  // Keep one bounded range rather than accumulating one entry per hidden frame.
  for (const range of attribute.updateRanges) {
    start = Math.min(start, range.start);
    end = Math.max(end, range.start + range.count);
  }
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(start, end - start);
  attribute.needsUpdate = true;
}
