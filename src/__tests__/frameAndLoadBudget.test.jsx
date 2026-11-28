import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { uploadInstanceRange } from '../3d/instanceUploads.js';
import { registerPreviewRenderer, setPreviewHostRenderer, tickPreviewRenderers } from '../3d/previewHost.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { useGameSession } from '../hooks/useGameSession.js';

describe('uploadInstanceRange', () => {
  const attribute = () => new THREE.InstancedBufferAttribute(new Float32Array(16 * 10), 16);
  it('sends only the items a frame wrote', () => {
    const a = attribute();
    const version = a.version;
    uploadInstanceRange(a, 3, 5);
    expect(a.updateRanges).toEqual([{ start: 48, count: 32 }]);
    expect(a.version).toBe(version + 1);
  });
  it('merges with a span the renderer has not drawn yet, and skips an empty span', () => {
    const a = attribute();
    uploadInstanceRange(a, 6, 7);
    uploadInstanceRange(a, 1, 2);
    expect(a.updateRanges).toEqual([{ start: 16, count: 96 }]);
    const version = a.version;
    uploadInstanceRange(a, Infinity, 0);
    expect(a.version).toBe(version);
  });
});

describe('preview host', () => {
  it('hands a renderer that loads late the Canvas’s renderer, and ticks only renderers with previews on screen', () => {
    const gl = {};
    setPreviewHostRenderer(gl);
    const live = { setShared: vi.fn(), active: () => true, tick: vi.fn() };
    const idle = { setShared: vi.fn(), active: () => false, tick: vi.fn() };
    registerPreviewRenderer(live);
    registerPreviewRenderer(idle);
    expect(live.setShared).toHaveBeenCalledWith(gl);
    tickPreviewRenderers(0.016);
    expect(live.tick).toHaveBeenCalledWith(0.016);
    expect(idle.tick).not.toHaveBeenCalled();
  });
});

// The first load is the static import graph from main.jsx. Every tile style's
// shader source and the thumbnail renderers used to be on it, through App.jsx
// and the opening's flip portal: about 330 KB a player downloaded before the menu.
describe('first load', () => {
  const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const staticImports = file => {
    const text = fs.readFileSync(file, 'utf8');
    const out = [];
    for (const m of text.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+['"](\.[^'"]+)['"]/gm)) out.push(m[1]);
    for (const m of text.matchAll(/^\s*import\s+['"](\.[^'"]+)['"]/gm)) out.push(m[1]);
    return out.map(spec => path.resolve(path.dirname(file), spec)).filter(f => fs.existsSync(f) && /\.(m?js|jsx)$/.test(f));
  };
  const reached = new Set();
  const walk = file => {
    if (reached.has(file)) return;
    reached.add(file);
    for (const next of staticImports(file)) walk(next);
  };
  walk(path.join(src, 'main.jsx'));
  const rel = [...reached].map(f => path.relative(src, f));

  it('leaves the tile styles and the thumbnail renderers to the screens that use them', () => {
    expect(rel).toContain('App.jsx');
    expect(rel).toContain('3d/previewHost.js');
    expect(rel.filter(f => /PreviewRenderer\.js$/.test(f))).toEqual([]);
    expect(rel).not.toContain('3d/styles/TileStyleMaterials.jsx');
  });
});

describe('the game clock', () => {
  let root;
  afterEach(() => act(() => root?.unmount()));
  it('does not re-render the app root through useGameSession', () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    let renders = 0;
    function Root() { renders++; useGameSession(); return null; }
    root = createRoot(document.createElement('div'));
    act(() => root.render(<Root />));
    const before = renders;
    act(() => { for (let t = 1; t <= 5; t++) useGameStore.getState().setGameTime(t); });
    expect(renders).toBe(before);
  });
});
