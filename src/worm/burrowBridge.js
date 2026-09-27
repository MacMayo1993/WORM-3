import { getManifoldGridId } from '../game/gridIds.js';
import { isLiveFlippedFace } from '../game/raisedCubie.js';

// One run owns this presentation bridge. No per-frame React/store updates.
export const burrowBridge = { current: null };
export const burrowEntryOpen = pair => !pair || pair.phase === 'open';
export const burrowPair = id => burrowBridge.current?.pairs.get(id);
export const burrowSticker = (sticker, size) => sticker?.origPos
    ? burrowBridge.current?.bySticker.get(getManifoldGridId(sticker, size)) : undefined;
export const burrowTileOpen = (sticker, size) => burrowEntryOpen(burrowSticker(sticker, size));
export function burrowCubieLift(cubie, size, cap) {
    let amount = 0;
    for (const sticker of Object.values(cubie.stickers)) {
        if (isLiveFlippedFace(sticker, cap)) amount = Math.max(amount, burrowSticker(sticker, size)?.openness ?? 1);
    }
    return amount;
}
