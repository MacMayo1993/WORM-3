import { describe, it, expect } from 'vitest';
import { normalizeBase } from '../../scripts/normalizeBase.mjs';

describe('normalizeBase', () => {
  it('leaves an already-normalised base alone', () => {
    expect(normalizeBase('/WORM-3/')).toBe('/WORM-3/');
    expect(normalizeBase('/')).toBe('/');
  });

  it('adds the trailing slash Vite adds for itself', () => {
    // The regression: `${BASE}index.html` was building `/previewindex.html`.
    expect(normalizeBase('/preview')).toBe('/preview/');
  });

  it('adds a leading slash', () => {
    expect(normalizeBase('preview')).toBe('/preview/');
    expect(normalizeBase('preview/')).toBe('/preview/');
  });

  it('handles a nested path base', () => {
    expect(normalizeBase('/builds/pr-42')).toBe('/builds/pr-42/');
  });

  it('keeps an absolute CDN base absolute', () => {
    expect(normalizeBase('https://cdn.example.com/app')).toBe('https://cdn.example.com/app/');
    expect(normalizeBase('https://cdn.example.com/app/')).toBe('https://cdn.example.com/app/');
    expect(normalizeBase('//cdn.example.com/app')).toBe('//cdn.example.com/app/');
  });

  it('treats blank, whitespace and missing values as the root base', () => {
    expect(normalizeBase('')).toBe('/');
    expect(normalizeBase('   ')).toBe('/');
    expect(normalizeBase(undefined)).toBe('/');
    expect(normalizeBase(null)).toBe('/');
  });

  it('trims surrounding whitespace from an env var', () => {
    expect(normalizeBase(' /preview ')).toBe('/preview/');
  });

  it('produces a base that concatenates correctly wherever the config reuses it', () => {
    // These are the three call sites the bug actually broke.
    const base = normalizeBase('/preview');
    expect(`${base}index.html`).toBe('/preview/index.html');
    expect(`${base}environments/night.hdr`).toBe('/preview/environments/night.hdr');
    expect(new RegExp(`${base}(environments|models)/`).test('/preview/models/x.glb')).toBe(true);
  });
});
