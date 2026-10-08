import { describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { closeSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import { CC_BY_4, ENVIRONMENT_CREDITS, MODEL_CREDITS, UNVERIFIED_ASSETS } from '../utils/credits.js';

// Third-party art is only usable on its licence's terms. The nine biome models are
// CC BY 4.0, which makes credit, a licence link and a note of changes a condition.
// This keeps the credits honest against the files themselves, and stops a new asset
// arriving in public/ without anyone deciding who made it.

const PUBLIC = join(process.cwd(), 'public');
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const files = dir => walk(join(PUBLIC, dir)).map(path => relative(PUBLIC, path));
const sizeOf = file => statSync(join(PUBLIC, file)).size;
// Zero- and one-byte placeholders are not assets (they cannot even be parsed).
const real = file => sizeOf(file) >= 64;

// A GLB is a 12-byte header, then a JSON chunk (length, type) that starts with the asset block.
function glbAsset(file) {
  const fd = openSync(join(PUBLIC, file), 'r');
  try {
    const head = Buffer.alloc(20);
    readSync(fd, head, 0, 20, 0);
    const json = Buffer.alloc(head.readUInt32LE(12));
    readSync(fd, json, 0, json.length, 20);
    return JSON.parse(json.toString('utf8')).asset ?? {};
  } finally { closeSync(fd); }
}
const squash = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const splitAuthor = author => { const [, name, url] = /^(.*?)\s*\((https?:[^)]+)\)\s*$/.exec(author ?? '') ?? []; return { name, url }; };

describe('3D model credits', () => {
  const models = files('models').filter(f => f.endsWith('.glb') && real(f));

  it.each(MODEL_CREDITS)('credits $title exactly as the file records it', credit => {
    const { extras = {} } = glbAsset(credit.file);
    const { name, url } = splitAuthor(extras.author);
    expect(squash(credit.title)).toBe(squash(extras.title));
    expect(credit.author).toBe(name);
    expect(credit.authorUrl.toLowerCase()).toBe(url.toLowerCase());
    expect(credit.source).toBe(extras.source);
    expect(extras.license).toContain('CC-BY-4.0');      // the licence these credits and the in-app text assume
  });

  it('has an entry for every model, or says plainly that its source is unverified', () => {
    const credited = new Set(MODEL_CREDITS.map(c => c.file));
    const unverified = new Set(UNVERIFIED_ASSETS);
    expect(models.filter(file => !credited.has(file) && !unverified.has(file)), 'models with no credit and no verdict').toEqual([]);
    expect(MODEL_CREDITS.filter(c => !models.includes(c.file)), 'credits for models that are not in public/').toEqual([]);
  });

  it('links the licence and does not credit one file twice', () => {
    expect(CC_BY_4.url).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(new Set(MODEL_CREDITS.map(c => c.file)).size).toBe(MODEL_CREDITS.length);
  });

  it('would notice if an "unverified" model gained embedded provenance and so should be credited instead', () => {
    for (const file of UNVERIFIED_ASSETS.filter(f => f.endsWith('.glb'))) {
      const { extras = {} } = glbAsset(file);
      expect(extras.author ?? extras.license ?? extras.source, `${file} now says where it came from: credit it`).toBeUndefined();
    }
  });
});

describe('environment map credits', () => {
  const maps = files('environments').filter(f => /\.(hdr|exr)$/i.test(f) && real(f));

  it.each(ENVIRONMENT_CREDITS)('confirms $title is from Poly Haven by its own header', credit => {
    const fd = openSync(join(PUBLIC, credit.file), 'r');
    const head = Buffer.alloc(2048);
    readSync(fd, head, 0, head.length, 0);
    closeSync(fd);
    const text = head.toString('latin1');
    expect(text).toContain('Poly Haven');
    expect(text).toContain(credit.slug);
  });

  it('has a verdict for every environment map', () => {
    const known = new Set([...ENVIRONMENT_CREDITS.map(c => c.file), ...UNVERIFIED_ASSETS]);
    expect(maps.filter(file => !known.has(file)), 'environment maps with no credit and no verdict').toEqual([]);
    expect([...known].filter(f => f.startsWith('environments/') && !maps.includes(f)), 'listed maps that are not in public/').toEqual([]);
  });
});

describe('docs/ASSET_CREDITS.md', () => {
  const doc = readFileSync(join(process.cwd(), 'docs/ASSET_CREDITS.md'), 'utf8');

  it('names every model and environment map that ships', () => {
    const shipped = [...files('models'), ...files('environments')].filter(f => /\.(glb|hdr|exr)$/i.test(f));
    expect(shipped.filter(file => !doc.includes(file.split('/').pop())), 'assets missing from the inventory').toEqual([]);
  });
});
