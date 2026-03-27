import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS_DIR = 'dist/assets';
const JS_MAX_BYTES = 680 * 1024; // 680 KB per JS asset (keeps Three.js bounded)
const CSS_MAX_BYTES = 80 * 1024; // 80 KB per CSS asset

const files = readdirSync(ASSETS_DIR);
const oversized = [];

for (const file of files) {
  if (!file.endsWith('.js') && !file.endsWith('.css')) continue;
  const full = join(ASSETS_DIR, file);
  const size = statSync(full).size;
  const limit = file.endsWith('.js') ? JS_MAX_BYTES : CSS_MAX_BYTES;
  if (size > limit) {
    oversized.push({ file, size, limit });
  }
}

if (oversized.length > 0) {
  console.error('Bundle size check failed. Oversized assets found:');
  for (const { file, size, limit } of oversized) {
    const sizeKb = (size / 1024).toFixed(1);
    const limitKb = (limit / 1024).toFixed(1);
    console.error(` - ${file}: ${sizeKb} KB (limit ${limitKb} KB)`);
  }
  process.exit(1);
}

console.log('Bundle size check passed.');
