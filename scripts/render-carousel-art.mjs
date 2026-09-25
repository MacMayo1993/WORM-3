// Archived geometric artwork; exports separately from the current illustrated decals.
// Optional authoring dependency: npm install --no-save --package-lock=false playwright
// Then: npx playwright install chromium && node scripts/render-carousel-art.mjs
import { createServer } from 'vite';
import { writeFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await createServer({ server: { host: '127.0.0.1', port: 5197, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: JSON.parse(process.env.CHROMIUM_ARGS || '[]') });
  const page = await browser.newPage();
  page.on('pageerror', error => { throw error; });
  await page.goto(`http://127.0.0.1:5197${server.config.base}scripts/carousel-art/preview.html`);
  await page.waitForFunction(() => typeof window.renderArtwork === 'function');
  await mkdir('output/carousel-geometry', { recursive: true });
  for (const id of await page.evaluate(() => window.artworkIds)) {
    const data = await page.evaluate(id => window.renderArtwork(id), id);
    if (!data.startsWith('data:image/webp;base64,')) throw new Error('Browser did not produce WebP');
    await writeFile(`output/carousel-geometry/${id}.webp`, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`Rendered ${id}`);
  }
} finally { await browser?.close(); await server.close(); }
