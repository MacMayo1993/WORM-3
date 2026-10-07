import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
fs.mkdirSync(root + '/dist', { recursive: true });
for (const name of fs.readdirSync(root + '/web')) fs.copyFileSync(root + '/web/' + name, root + '/dist/' + name);
await import('./generate-audit.mjs');
await build({ entryPoints: [root + '/scripts/generator-worker.mjs'], outfile: root + '/dist/generator-worker.js',
  bundle: true, minify: true, format: 'iife', platform: 'browser', target: 'es2022',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"DEV":false}' } });
console.log('Built local auditor and generator in tools/worm-level-auditor/dist.');
