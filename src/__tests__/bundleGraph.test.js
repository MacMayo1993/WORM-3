import { describe, it, expect } from 'vitest';
import { staticChunkKeys, entryKeys, collectRoute, lazyChunks } from '../../scripts/bundleGraph.mjs';

// A miniature stand-in for dist/.vite/manifest.json: one entry pulling two vendor
// chunks statically, and a lazily-imported mode that itself pulls a shared chunk.
const manifest = {
  'index.html': {
    file: 'assets/index-aaa.js',
    isEntry: true,
    css: ['assets/index-aaa.css'],
    imports: ['_vendor-react-bbb.js', '_vendor-three-ccc.js'],
    dynamicImports: ['src/modes/HealerWormMode.jsx']
  },
  '_vendor-react-bbb.js': { file: 'assets/vendor-react-bbb.js' },
  '_vendor-three-ccc.js': { file: 'assets/vendor-three-ccc.js', imports: ['_shared-ddd.js'] },
  '_shared-ddd.js': { file: 'assets/shared-ddd.js' },
  'src/modes/HealerWormMode.jsx': {
    file: 'assets/HealerWormMode-eee.js',
    imports: ['_mode-only-fff.js']
  },
  '_mode-only-fff.js': { file: 'assets/mode-only-fff.js' }
};

describe('entryKeys', () => {
  it('finds the html entry and nothing else', () => {
    expect(entryKeys(manifest)).toEqual(['index.html']);
  });

  it('returns empty for a manifest with no entry', () => {
    expect(entryKeys({ a: { file: 'a.js' } })).toEqual([]);
  });
});

describe('staticChunkKeys', () => {
  it('walks static imports transitively', () => {
    const keys = staticChunkKeys(manifest, 'index.html');
    expect(keys).toContain('_shared-ddd.js');
  });

  it('does NOT follow dynamic imports — that is the whole point of lazy loading', () => {
    const keys = staticChunkKeys(manifest, 'index.html');
    expect(keys.has('src/modes/HealerWormMode.jsx')).toBe(false);
    expect(keys.has('_mode-only-fff.js')).toBe(false);
  });

  it('terminates on an import cycle', () => {
    const cyclic = {
      a: { file: 'a.js', isEntry: true, imports: ['b'] },
      b: { file: 'b.js', imports: ['a'] }
    };
    expect([...staticChunkKeys(cyclic, 'a')].sort()).toEqual(['a', 'b']);
  });

  it('tolerates an import naming a key the manifest does not have', () => {
    const dangling = { a: { file: 'a.js', isEntry: true, imports: ['missing'] } };
    expect(() => staticChunkKeys(dangling, 'a')).not.toThrow();
  });
});

describe('collectRoute', () => {
  it('collects the entry JS, its CSS, and every statically imported chunk', () => {
    const { files } = collectRoute(manifest);
    expect([...files].sort()).toEqual([
      'assets/index-aaa.css',
      'assets/index-aaa.js',
      'assets/shared-ddd.js',
      'assets/vendor-react-bbb.js',
      'assets/vendor-three-ccc.js'
    ]);
  });

  it('leaves lazily-imported mode code out of the route', () => {
    const { files } = collectRoute(manifest);
    expect(files.has('assets/HealerWormMode-eee.js')).toBe(false);
  });

  it('counts a chunk reached by two paths once', () => {
    const diamond = {
      'index.html': { file: 'e.js', isEntry: true, imports: ['l', 'r'] },
      l: { file: 'l.js', imports: ['shared'] },
      r: { file: 'r.js', imports: ['shared'] },
      shared: { file: 'shared.js' }
    };
    expect(collectRoute(diamond).files.size).toBe(4);
  });
});

describe('lazyChunks', () => {
  it('reports exactly the JS the initial route does not pull in', () => {
    const { chunkKeys } = collectRoute(manifest);
    const files = lazyChunks(manifest, chunkKeys).map((c) => c.file).sort();
    expect(files).toEqual(['assets/HealerWormMode-eee.js', 'assets/mode-only-fff.js']);
  });

  it('ignores non-JS emissions', () => {
    const withAsset = {
      'index.html': { file: 'e.js', isEntry: true },
      'logo.png': { file: 'assets/logo.png' }
    };
    const { chunkKeys } = collectRoute(withAsset);
    expect(lazyChunks(withAsset, chunkKeys)).toEqual([]);
  });
});
