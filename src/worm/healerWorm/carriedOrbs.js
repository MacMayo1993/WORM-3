import { ORB_SEGMENT_GROWTH } from './constants.js';

// Keep one entry per pickup, but record the actual material it contributed. A
// bonus pickup or recovered fragment is not necessarily a three-bead orb.
export function ensureOrbSegments(carried, capacity) {
    const counts = carried.orbPickupSegments ??= [];
    const legacy = counts.length < carried.orbPickupColors.length;
    for (let i = counts.length; i < carried.orbPickupColors.length; i++) counts.push(ORB_SEGMENT_GROWTH);
    counts.length = carried.orbPickupColors.length;
    // Only infer material for legacy/demo entries lacking counts. A tracked body
    // may have unrelated extra length; that must never mint spendable orb material.
    if (legacy && Number.isFinite(capacity)) {
        let excess = counts.reduce((sum, n) => sum + n, 0) - Math.max(0, capacity);
        for (let i = counts.length - 1; i >= 0 && excess > 0; i--) {
            const take = Math.min(counts[i], excess);
            counts[i] -= take;
            excess -= take;
        }
        if (excess < 0 && counts.length) counts[counts.length - 1] -= excess;
    }
    return counts;
}

function removeEmptyEntries(carried) {
    for (let i = carried.orbPickupSegments.length - 1; i >= 0; i--) {
        if (carried.orbPickupSegments[i] > 0) continue;
        carried.orbPickupSegments.splice(i, 1);
        carried.orbPickupColors.splice(i, 1);
        carried.orbPickupFaceIds.splice(i, 1);
    }
}

// Spend the same faces the economy charged, not whichever color was picked last.
export function spendCarriedOrbs(carried, inventory, nextInventory) {
    ensureOrbSegments(carried);
    const owed = {};
    for (const face of Object.keys(inventory ?? {})) {
        owed[face] = Math.max(0, inventory[face] - (nextInventory[face] ?? 0));
    }
    for (let i = 0; i < carried.orbPickupSegments.length; i++) {
        const face = carried.orbPickupFaceIds[i];
        const take = Math.min(carried.orbPickupSegments[i], owed[face] ?? 0);
        carried.orbPickupSegments[i] -= take;
        owed[face] -= take;
    }
    removeEmptyEntries(carried);
}

// Split a pickup when the cut crosses it. Both halves retain their own face and
// exact material, so collecting the dropped half cannot mint or lose inventory.
export function cutCarriedOrbs(carried, capacity) {
    ensureOrbSegments(carried);
    const lost = { faceIds: [], colors: [], segments: [] };
    let remaining = Math.max(0, capacity);
    for (let i = 0; i < carried.orbPickupSegments.length; i++) {
        const count = carried.orbPickupSegments[i];
        const keep = Math.min(count, remaining);
        remaining -= keep;
        if (count > keep) {
            lost.faceIds.push(carried.orbPickupFaceIds[i]);
            lost.colors.push(carried.orbPickupColors[i]);
            lost.segments.push(count - keep);
        }
        carried.orbPickupSegments[i] = keep;
    }
    removeEmptyEntries(carried);
    return lost;
}
