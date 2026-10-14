import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Every lit program's key includes the renderer's tone mapping, whether it draws
// into a render target, and how many lights cast shadows. GameScene used to
// unmount the AO composer for each tunnel ride (which flips tone mapping and the
// render target) and drop the key light's castShadow whenever adaptive quality
// declined, so a ride relinked the whole scene going in and again coming out:
// a freeze of over a second on the first ride. These stay fixed for a session.
const source = readFileSync('src/3d/GameScene.jsx', 'utf8');
const assignment = name => source.match(new RegExp(`const ${name} = ([^;]+);`))?.[1] ?? '';

describe('a tunnel ride keeps every program key', () => {
  it('casts shadows by device and look only, never by quality tier or ride', () => {
    expect(source).toContain('castShadow={shadowsAvailable}');
    expect(assignment('shadowsAvailable')).not.toMatch(/perfReducedFX|wormPhase|wormholePhaseActive/);
  });

  it('switches the AO composer off for a ride instead of unmounting it', () => {
    const mount = source.match(/\{shadowsAvailable && \(\s*<Suspense fallback=\{null\}>\s*<SceneEffects kind="game" enabled=\{([^}]+)\}/);
    expect(mount).not.toBeNull();
    expect(mount[1]).toContain('aoEnabled');
    expect(assignment('aoEnabled')).toContain('wormholePhaseActive');
  });
});
