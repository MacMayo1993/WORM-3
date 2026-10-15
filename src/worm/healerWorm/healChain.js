// Story double-heal quests accept consecutive repairs as well as overlapping
// paid tunnel rides. Only active surface time spends this routing window.
export const STORY_DOUBLE_HEAL_WINDOW = 20;

export function tickHealChain(sim, delta) {
    if (sim.phase === 'crawling' && sim.healChain) {
        sim.healChain.remaining = Math.max(0, sim.healChain.remaining - delta);
    }
}

export function recordCompletedHeal(sim, ctx, key, overlapping = false, forwardOverlap = false) {
    const window = ctx.getDoubleHealWindow?.() ?? 0;
    const previous = sim.healChain;
    const chained = window > 0 && key && previous?.key && previous.key !== key && previous.remaining > 0 && !previous.creditedForward;
    // One seal earns at most one credit, even when both conditions apply.
    if (overlapping || chained) ctx.onStoryMechanic?.('multiHeals');
    sim.healChain = window > 0 ? { key, remaining: window, creditedForward: forwardOverlap } : null;
}
