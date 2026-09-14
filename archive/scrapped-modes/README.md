# Scrapped modes — excluded from this release

Hands, Holonomy, Merge, and Co-op are preserved here for reference or a future release. They have no launch buttons, shortcuts, active store actions, or scene/render hooks in the current game. They are also excluded from the proposed XP and level progression scope for this release.

## Browse the archive

| Mode | Preserved implementation | Preserved tests / assets |
| --- | --- | --- |
| Hands | [Input mapping](src/game/handsInput.js), [hook](src/hooks/useHandsMode.js), [HUD](src/components/overlays/HandsOverlay.jsx), [CSS](src/hands.css) | Original camera/control integration is in the source revision below. |
| Holonomy | [Mode, math, tracer and HUD](src/holonomy/) | [Swirl field tests](src/__tests__/swirlField.test.js) |
| Merge | [Region logic, picker and tile overlay](src/modes/merge/) | [Region tests](src/__tests__/mergeRegions.test.js), [asset manifest](public/merge-mode/), [design](docs/merge-mode-design.md), [readiness review](docs/merge-mode-implementation-readiness.md) |
| Co-op | [Platformer](src/worm/PlatformerWormMode.jsx), [HUD](src/worm/PlatformerHUD.jsx), [character](src/worm/CrawlerCharacter.jsx), [physics](src/worm/crawlerPhysics.js), [cube renderer](src/worm/SimpleCubeRenderer.jsx), [MOBI adapter](src/worm/MobiModel.jsx) | [Physics tests](src/__tests__/crawlerPhysics.test.js), [extended physics tests](src/__tests__/crawlerPhysicsFull.test.js) |

[MOBI introductions](src/mobiIntros.js) are preserved separately. Paths under this directory mirror their former repository locations; the CSS and intro files were extracted from shared release files. The legacy Merge overlay shim is retained under `src/coming-soon/3d/` as historical source.

## Archive boundary

This is a source snapshot, not a second playable build. Original relative imports and asset URLs are preserved for restoration, so these files cannot be run directly from this directory. Shared dependencies remain in the main game and are not duplicated here. Vite only builds the active application; archived assets are outside the root `public/` directory, the test runner includes only root `src/`, and lint ignores `archive/`.

The main Worm/Healer mode, all playable worm characters including MOBI, worm cosmetics and previews, Teach, Algorithm Codex, ordinary cube keyboard controls, Biome, and Möbius Cubelet remain in the release. `src/game/moveNotation.js` now owns the shared standard-notation conversion used by Teach and Algorithm Codex.

Existing wallet balances, owned cosmetics, campaign progress, and historical milestone/play records are retained. Retired Holonomy reward keys no longer award new points. The four mode flags were session-only; saved records do not reopen their scenes.

## Restoration reference

Last integrated source revision: `d64df91cc337c128474c761b83f5dfa642025df4`.

To inspect the complete runnable implementation without changing the release, create a separate worktree at that revision:

```sh
git worktree add ../WORM-3-scrapped-reference d64df91cc337c128474c761b83f5dfa642025df4
```

Any future restoration needs an explicit integration pass for App/UILayer routing, keyboard and camera ownership, mode state, tile rendering, rewards, asset caching, and tests. Do not import archived modules into the release to expose them again. Use the referenced revision for the original integration; fixes in the release since that revision must be retained when restoring a mode.
