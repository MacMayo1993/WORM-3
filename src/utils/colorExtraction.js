// K-means color extraction shared by the setup wizards (Disparity, Freeplay, Worm).
export function extractColorsFromImage(img, count = 6) {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const brightness = r * 0.299 + g * 0.587 + b * 0.114;
    if (brightness > 20 && brightness < 240) pixels.push([r, g, b]);
  }
  if (pixels.length < count) {
    const fallback = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor((i / count) * data.length / 4) * 4;
      fallback.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
    return fallback.map(([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''));
  }
  const centroids = [];
  for (let i = 0; i < count; i++) {
    centroids.push([...pixels[Math.floor((i / count) * pixels.length)]]);
  }
  for (let iter = 0; iter < 10; iter++) {
    const clusters = Array.from({ length: count }, () => []);
    for (const px of pixels) {
      let minDist = Infinity, best = 0;
      for (let c = 0; c < count; c++) {
        const dr = px[0] - centroids[c][0], dg = px[1] - centroids[c][1], db = px[2] - centroids[c][2];
        if (dr * dr + dg * dg + db * db < minDist) { minDist = dr * dr + dg * dg + db * db; best = c; }
      }
      clusters[best].push(px);
    }
    for (let c = 0; c < count; c++) {
      if (!clusters[c].length) continue;
      const sum = [0, 0, 0];
      for (const px of clusters[c]) { sum[0] += px[0]; sum[1] += px[1]; sum[2] += px[2]; }
      centroids[c] = [Math.round(sum[0] / clusters[c].length), Math.round(sum[1] / clusters[c].length), Math.round(sum[2] / clusters[c].length)];
    }
  }
  centroids.sort((a, b) => {
    const hA = Math.atan2(Math.sqrt(3) * (a[1] - a[2]), 2 * a[0] - a[1] - a[2]);
    const hB = Math.atan2(Math.sqrt(3) * (b[1] - b[2]), 2 * b[0] - b[1] - b[2]);
    return hA - hB;
  });
  return centroids.map(([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join(''));
}
