// Bundle budgets.
//
// Per-file ceilings alone cannot see a regression that arrives as five new
// sub-threshold chunks on the initial route, and raw bytes are not what a player
// on mobile actually waits for. So this checks three things:
//
//   1. per-asset ceilings          — keeps any single chunk from ballooning
//   2. initial-route aggregate     — everything the browser must fetch, parse and
//                                    execute before the app can render, measured
//                                    both raw and Brotli-compressed
//   3. largest lazy chunk          — optional modes stay optional
//
// The initial route is the entry's *static* import graph walked from the Vite
// build manifest (build.manifest in vite.config.js). Dynamic imports are excluded
// on purpose: that is precisely the code React.lazy defers.
//
// Run `node scripts/check-bundle-size.mjs --report` to print the numbers without
// enforcing them — useful for recording a trend rather than a single ceiling.

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';
import { collectRoute, entryKeys, lazyChunks } from './bundleGraph.mjs';

const DIST_DIR = 'dist';
const ASSETS_DIR = join(DIST_DIR, 'assets');
const MANIFEST_PATH = join(DIST_DIR, '.vite', 'manifest.json');

const KB = 1024;

// Per-asset ceilings.
const JS_MAX_BYTES = 680 * KB; // keeps Three.js bounded
const CSS_MAX_BYTES = 80 * KB;

// Initial route: what must land before first render. Headroom over the current
// baseline is deliberate but small — the point is to notice drift, not to leave
// room for a whole extra mode to wander in.
const ROUTE_MAX_RAW_BYTES = 2300 * KB;
const ROUTE_MAX_BROTLI_BYTES = 640 * KB;
const ROUTE_MAX_REQUESTS = 10; // baseline is 7: entry + 5 vendor chunks + 1 css

// Any one lazily-loaded chunk. Cheaper than the entry budget because a mode that
// approaches it should be split rather than shipped as one download.
const LAZY_CHUNK_MAX_BYTES = 680 * KB;

const reportOnly = process.argv.includes('--report');

const brotli = (buf) =>
  brotliCompressSync(buf, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11, [zlibConstants.BROTLI_PARAM_SIZE_HINT]: buf.length }
  }).length;

const kb = (bytes) => `${(bytes / KB).toFixed(1)} KB`;

const failures = [];
const fail = (msg) => failures.push(msg);

// ── 1. Per-asset ceilings ────────────────────────────────────────────────────
if (!existsSync(ASSETS_DIR)) {
  console.error(`Bundle size check failed: ${ASSETS_DIR} not found. Run \`npm run build\` first.`);
  process.exit(1);
}

for (const file of readdirSync(ASSETS_DIR)) {
  if (!file.endsWith('.js') && !file.endsWith('.css')) continue;
  const size = statSync(join(ASSETS_DIR, file)).size;
  const limit = file.endsWith('.js') ? JS_MAX_BYTES : CSS_MAX_BYTES;
  if (size > limit) fail(`asset over ceiling: ${file} is ${kb(size)} (limit ${kb(limit)})`);
}

// ── 2 & 3. Route aggregate and lazy chunks ───────────────────────────────────
if (!existsSync(MANIFEST_PATH)) {
  console.error(
    `Bundle size check failed: ${MANIFEST_PATH} not found.\n` +
      'Set `build.manifest: true` in vite.config.js — the route budget needs the import graph.'
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

if (entryKeys(manifest).length === 0) {
  console.error('Bundle size check failed: manifest declares no entry chunk.');
  process.exit(1);
}

const { chunkKeys: routeChunkKeys, files: routeFiles } = collectRoute(manifest);

const sizeOf = (file) => {
  const path = join(DIST_DIR, file);
  return existsSync(path) ? readFileSync(path) : null;
};

let routeRaw = 0;
let routeBrotli = 0;
for (const file of routeFiles) {
  const buf = sizeOf(file);
  if (!buf) continue;
  routeRaw += buf.length;
  routeBrotli += brotli(buf);
}

if (routeRaw > ROUTE_MAX_RAW_BYTES)
  fail(`initial route raw: ${kb(routeRaw)} (limit ${kb(ROUTE_MAX_RAW_BYTES)})`);
if (routeBrotli > ROUTE_MAX_BROTLI_BYTES)
  fail(`initial route brotli: ${kb(routeBrotli)} (limit ${kb(ROUTE_MAX_BROTLI_BYTES)})`);
if (routeFiles.size > ROUTE_MAX_REQUESTS)
  fail(`initial route requests: ${routeFiles.size} files (limit ${ROUTE_MAX_REQUESTS})`);

// Lazy chunks: everything the manifest emits that the initial route does not pull in.
const lazy = [];
for (const { file } of lazyChunks(manifest, routeChunkKeys)) {
  const buf = sizeOf(file);
  if (!buf) continue;
  lazy.push({ file, size: buf.length });
}
lazy.sort((a, b) => b.size - a.size);

for (const { file, size } of lazy) {
  if (size > LAZY_CHUNK_MAX_BYTES)
    fail(`lazy chunk over ceiling: ${file} is ${kb(size)} (limit ${kb(LAZY_CHUNK_MAX_BYTES)})`);
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log('Bundle report');
console.log(`  initial route   ${routeFiles.size} files, ${kb(routeRaw)} raw, ${kb(routeBrotli)} brotli`);
console.log(`  budgets         ${ROUTE_MAX_REQUESTS} files, ${kb(ROUTE_MAX_RAW_BYTES)} raw, ${kb(ROUTE_MAX_BROTLI_BYTES)} brotli`);
console.log(`  lazy chunks     ${lazy.length}, largest ${lazy[0] ? `${lazy[0].file} at ${kb(lazy[0].size)}` : 'none'}`);

if (failures.length > 0 && !reportOnly) {
  console.error('\nBundle size check failed:');
  for (const line of failures) console.error(` - ${line}`);
  process.exit(1);
}

if (failures.length > 0) {
  console.warn('\nOver budget (report mode, not failing):');
  for (const line of failures) console.warn(` - ${line}`);
} else {
  console.log('\nBundle size check passed.');
}
