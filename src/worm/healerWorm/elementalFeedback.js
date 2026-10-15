import { fusionEffect } from './elementalFusion.js';

export function fusionFeedback(recipe, buffs) {
    const effect = fusionEffect(recipe);
    if (effect) return elementalFeedback(recipe.catalyst, buffs, effect);
    // Recipes without a special rule still combine two real mechanics. Name
    // both rather than quietly showing only the newest element's feedback.
    const effects = { air: 'Air updraft', water: 'Water momentum', fire: 'Fire trail', grass: 'Earth spring pads', ice: 'Ice sliding', lightning: 'Lightning strikes' };
    const fraction = [recipe.base, recipe.catalyst].includes('water') ? elementalFeedback('water', buffs).fraction : 0;
    return { text: `${effects[recipe.base]} + ${effects[recipe.catalyst]}`, fraction };
}

export function elementalFeedback(type, buffs, fusion = null) {
    const ability = buffs.elementalAbilities;
    const momentum = buffs.rocketActive ? 0 : Math.max(0, Math.min(1, buffs.waterMomentum || 0));
    // A fused pair's own rule leads the readout (elementalFusion.js).
    if (fusion === 'water-air') return { text: 'Keep momentum in flight · Airborne speed up to +40%', fraction: momentum };
    if (fusion === 'air-water') return { text: 'Land: refill momentum · Douse bombs in the 3×3', fraction: momentum };
    if (fusion === 'fire-air') return { text: 'Hot-tile takeoff: +1 tile · +1.2 lift', fraction: 0 };
    if (fusion === 'air-fire') return { text: 'Jump: rain 6-second fire trails beneath you', fraction: 0 };
    if (fusion === 'grass-air') return { text: 'Spring launch: stun enemies within 2 steps', fraction: buffs.springReady ? 1 : 0 };
    if (fusion === 'air-grass') return { text: 'Land: grow 3 buds + a charged spring', fraction: buffs.springReady ? 1 : 0 };
    if (fusion === 'ice-air') return { text: 'Jump: leave 7-second frost beneath you', fraction: 0 };
    if (fusion === 'air-ice') return { text: 'Free steering · Takeoff freezes a 2-tile cross', fraction: 0 };
    if (fusion === 'lightning-air') return { text: buffs.staticT > 0 ? 'GUST! · +35% speed · Harmless strikes' : 'Strikes become safe gusts and speed bursts', fraction: buffs.staticT > 0 ? 1 : 0 };
    if (fusion === 'air-lightning') return { text: 'Land: discharge a lethal cross · Dodge storm marks', fraction: 0 };
    if (fusion === 'slipstream') return { text: `Slipstream +${Math.round(momentum * 40)}% · Turns keep momentum`, fraction: momentum };
    if (fusion === 'quench') return { text: 'Dash lays Obsidian · Turns on it keep momentum', fraction: momentum };
    if (fusion === 'steam') return { text: 'Steam gathers burning orbs within 2 tiles · Puts out bombs', fraction: 0 };
    if (fusion === 'wildfire') return { text: buffs.springReady ? 'SPRING READY · Dash plants seeds; landings burn' : `${buffs.springCount || 0} springs · Dash plants seeds`, fraction: buffs.springReady ? 1 : 0 };
    if (fusion === 'thunderpad') return { text: buffs.springReady ? 'SPRING READY · A struck pad launches rocket-high' : 'Lightning charges your spring pads', fraction: buffs.springReady ? 1 : 0 };
    const springs = buffs.springReady ? 'SPRING READY' : `${buffs.springCount || 0} springs`;
    const pads = buffs.springReady ? 1 : 0;
    if (fusion === 'bloom') return { text: `${springs} · Rain grows a pad every 4 tiles`, fraction: pads };
    if (fusion === 'conductor') return { text: 'Strikes fork · Never aimed at your body', fraction: 0 };
    if (fusion === 'coldfire') return { text: 'Blue trail freezes enemies · Blocks blasts', fraction: 0 };
    if (fusion === 'plasma') return { text: 'Double storm · Struck tiles burn · Trail is safe', fraction: 0 };
    if (fusion === 'geyser') return { text: momentum >= 0.8 ? `${springs} · Full momentum: +1 tile leap` : `${springs} · Build momentum for a bigger leap`, fraction: momentum };
    if (fusion === 'emberseed') return { text: `${springs} · Unused pads burst into flame`, fraction: pads };
    if (fusion === 'ski-jump') return { text: 'Every jump is a spring leap', fraction: 0 };
    if (fusion === 'frozen-wake') return { text: 'Tiles you leave freeze · Bombs on them stop', fraction: 0 };
    if (fusion === 'meltdown') return { text: buffs.meltdownT > 0 ? 'DASH! · Slides melt bombs' : 'Slides end in a dash · Melt bombs', fraction: buffs.meltdownT > 0 ? 1 : 0 };
    if (fusion === 'frostbloom') return { text: `${springs} · Landings freeze the 3×3`, fraction: pads };
    if (fusion === 'static') return { text: buffs.staticT > 0 ? 'DISCHARGE! · +35% speed' : 'Finish a drift: chain-collect orbs', fraction: buffs.staticT > 0 ? 1 : 0 };
    if (fusion === 'current') return { text: momentum >= 0.8 ? 'CHARGED · Strikes on you arc away' : `Momentum ${Math.round(momentum * 100)}% · Reach 80% to conduct`, fraction: momentum };
    if (fusion === 'firestorm') return { text: 'Strikes ignite a cross of fire', fraction: 0 };
    if (fusion === 'cryostorm') return { text: 'Slow marks · Strikes freeze, never hurt you', fraction: 0 };
    if (fusion === 'grounded') return { text: 'Strikes grow charged pads · Body is safe', fraction: 0 };
    if (type === 'air') return { text: ability?.flying ? (ability.flightT >= 0.5 ? 'GALE READY · Land to sweep 2 tiles' : 'FLYING · Release Jump to land') : 'HOLD JUMP TO FLY · Land a flight for a gale', fraction: 0 };
    if (type === 'water') return { text: `Momentum +${Math.round(momentum * 25)}% · ${momentum >= 0.8 ? 'WAVE READY · Sweeps both sides' : 'Build momentum to sweep'} · Rides never wear`, fraction: momentum };
    if (type === 'grass') return { text: buffs.springReady ? 'SPRING READY · Land to plant · Cuts regrow' : `${buffs.springCount || 0} springs · ${ability?.gardenBudget ?? 0} buds · Cuts regrow`, fraction: buffs.springReady ? 1 : 0 };
    if (type === 'fire') return { text: `${ability?.fireReady ? 'FLAME DASH READY · Boost' : `Heat ${ability?.heat?.size ?? 0}/6`} · ${ability?.fireBonus ?? 0} double-growth pickups left · Smelter ${ability?.smeltBudget ?? 0} · Flames still hurt`, fraction: ability?.fireReady ? 1 : (ability?.heat?.size ?? 0) / 6 };
    if (type === 'ice') return { text: `${ability?.icePhaseT > 0 ? 'SHELL BROKEN · Passing through body' : ability?.iceShield ? 'ICE SHELL READY' : 'Shell spent'} · Slice clock at half speed`, fraction: ability?.iceShield ? 1 : 0 };
    return { text: `CHAIN ${ability?.lightningT > 0 ? `${ability.lightningT.toFixed(1)}s` : 'READY'} · Charges a tunnel within 3 · ${ability?.overcharged ?? 0} charged`, fraction: 1 - (ability?.lightningT ?? 0) / 4 };
}
export const patchOpacity = ttl => Math.min(1, Math.max(0, ttl / 0.6));
export const springStretch = (ttl, reducedMotion) => reducedMotion ? 1 : 0.88 + 0.12 * Math.sin((8 - ttl) * 5);
/** The shader's look for a patch: see shieldFragment / springFragment. */
export function patchVariant(patch, steam) {
    if (patch.type === 'grass') return patch.ember ? 1 : patch.iced ? 2 : 0;
    if (patch.type === 'frost') return 4;
    if (patch.obsidian) return 1;
    if (patch.cold) return 3;
    return steam ? 2 : 0;
}
