import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

// The settings panel is cream paper (the NIGHT_* tokens carry light values now), so
// text hard-coded as translucent white is invisible on it. The Modes tab shipped three
// such paragraphs; use var(--night-text) / var(--night-text-muted) for text colour.

const dir = join(process.cwd(), 'src/components/menus/settings');
const panels = readdirSync(dir).filter(name => name.endsWith('.jsx'));

describe('settings panels', () => {
  it.each(panels)('%s sets no text colour to white', name => {
    const source = readFileSync(join(dir, name), 'utf8');
    // `color:` only; white backgrounds, borders and shadows are legitimate.
    const whiteText = source.split('\n').filter(line => /(^|[^-\w])color:\s*['"`](#fff\b|#ffffff\b|white\b|rgba?\(\s*255\s*,\s*255\s*,\s*255)/i.test(line));
    expect(whiteText, `${name} hard-codes white text`).toEqual([]);
  });
});
