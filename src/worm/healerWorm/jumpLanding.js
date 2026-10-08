import { getNextSurfacePosition, getWormholeHealRing } from '../wormLogic.js';
import { SPRING_SPAN } from '../characterAbilities.js';

// Destination tile under the current steering input. Recomputed after steering;
// a rotating layer suppresses the visual until its contents are committed.
export function jumpLandingTile(pos, moveDir, size, interpT, jumpT, jumpSpan) {
    let tile = pos;
    let direction = moveDir;
    const steps = Math.max(0, Math.floor(interpT + (1 - jumpT) * jumpSpan));
    for (let i = 0; i < steps; i++) {
        const next = getNextSurfacePosition(tile, direction, size);
        if (!next) break;
        tile = next;
        direction = next.moveDir ?? direction;
    }
    return tile;
}

// Where Spring lands, and how long the leap must last to land there. The head is `interpT`
// of the way from the tile it left to `pos`, so the leap's end is a whole number of tiles
// ahead of `pos` and its span is chosen to arrive exactly on that tile's centre. The tile
// the player is shown and the landing validated against is then the tile they land on,
// however far into a step they launch. The span stays within about half a tile of
// SPRING_SPAN; the arc's duration is the only thing the phase changes. `path`, when given,
// is filled with the tiles from `pos` to the landing for the arc preview.
export function springLanding(pos, moveDir, size, interpT, path = null) {
    const steps = Math.max(1, Math.round(interpT + SPRING_SPAN) - 1);
    let tile = pos;
    let direction = moveDir;
    if (path) { path.length = 0; path.push(pos); }
    for (let i = 0; i < steps; i++) {
        const next = getNextSurfacePosition(tile, direction, size);
        if (!next) break;
        tile = next;
        direction = next.moveDir ?? direction;
        if (path) path.push(tile);
    }
    return { tile, steps, span: steps + 1 - interpT };
}

// What Spring's landing slams: the landing tile and the eight around it, folded across
// cube seams exactly like the heal ring around a wormhole. Bombs in it are defused and
// enemies in it are stunned. `out` is cleared and returned.
export function springSlamTiles(tile, size, out = new Set()) {
    getWormholeHealRing(tile, size, out);
    out.add(`${tile.x},${tile.y},${tile.z},${tile.dirKey}`);
    return out;
}
