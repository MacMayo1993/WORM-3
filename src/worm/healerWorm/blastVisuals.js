// Visual beats only. Every affected tile ignites on the damage frame; the
// secondary shockwave and embers can travel without lying about hit timing.
export const BLAST_LIFE = 1.08;
export const BLAST_MAX_TILES = 84;
export const BLAST_MAX_ACTIVE = 6;
export const BLAST_EMBERS = 5;

const easeOut = p => 1 - (1 - p) ** 3;
const unit = p => Math.max(0, Math.min(1, p));

export function blastFrame(age, delay = 0, reduced = false) {
    const t = age - delay;
    if (t < 0 || t >= BLAST_LIFE) return null;
    const shock = unit(t / 0.38);
    const plume = unit(t / 0.26);
    const cooling = unit((t - 0.12) / 0.88);
    return {
        wave: reduced ? 0.76 : 0.38 + 0.68 * easeOut(shock),
        waveAlpha: (1 - shock) ** 2 * (reduced ? 0.55 : 0.92),
        plume: reduced ? 0.67 : 0.42 + 0.83 * easeOut(plume),
        heat: (1 - cooling) ** 2 * (reduced ? 0.58 : 0.95),
        flight: unit(t / 0.84),
        smoke: Math.sin(Math.PI * unit((t - 0.10) / 0.98)) * (reduced ? 0 : 0.44),
    };
}
