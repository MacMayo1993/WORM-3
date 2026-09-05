// Pure helpers for reading a Vite build manifest.
//
// Split out of check-bundle-size.mjs so the graph walk — the part that decides
// what counts as "the initial route" and therefore what the budget actually
// measures — is unit-testable without a build on disk.

/**
 * Chunk keys reachable from `key` through **static** imports only.
 * `dynamicImports` are deliberately not followed: those are the React.lazy
 * boundaries, and counting them would make the route budget meaningless.
 *
 * Tolerates missing keys and import cycles.
 */
export function staticChunkKeys(manifest, key, seen = new Set()) {
  if (seen.has(key)) return seen;
  seen.add(key);
  const chunk = manifest[key];
  if (!chunk) return seen;
  for (const imported of chunk.imports ?? []) staticChunkKeys(manifest, imported, seen);
  return seen;
}

/** Every entry chunk key in the manifest. */
export function entryKeys(manifest) {
  return Object.keys(manifest).filter((key) => manifest[key]?.isEntry);
}

/**
 * The initial route: chunk keys and the emitted files (JS + CSS) behind them.
 * Returns `{ chunkKeys, files }`, both Sets.
 */
export function collectRoute(manifest) {
  const chunkKeys = new Set();
  for (const entry of entryKeys(manifest)) {
    for (const key of staticChunkKeys(manifest, entry)) chunkKeys.add(key);
  }

  const files = new Set();
  for (const key of chunkKeys) {
    const chunk = manifest[key];
    if (!chunk) continue;
    if (chunk.file) files.add(chunk.file);
    for (const css of chunk.css ?? []) files.add(css);
  }

  return { chunkKeys, files };
}

/**
 * JS chunks the initial route does not pull in — i.e. what lazy loading actually
 * defers. Returns `[{ key, file }]` with route chunks removed.
 */
export function lazyChunks(manifest, routeChunkKeys) {
  const out = [];
  for (const [key, chunk] of Object.entries(manifest)) {
    if (routeChunkKeys.has(key)) continue;
    if (!chunk?.file?.endsWith('.js')) continue;
    out.push({ key, file: chunk.file });
  }
  return out;
}
