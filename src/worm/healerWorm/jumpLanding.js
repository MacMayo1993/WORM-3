import { getNextSurfacePosition } from '../wormLogic.js';

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
