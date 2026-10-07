import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STORY_WORLDS } from '../../../src/worm/story/worlds.js';
import { WORM_GENERATION_RECIPE, WORM_GENERATION_SOURCE } from '../../../src/worm/story/generated.js';
import { generateCampaign, integrationModule, normalizeSettings } from '../web/generator.js';
import { auditGeneratedLevel } from './generator-engine.mjs';

const args = process.argv.slice(2);
const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
const settingsPath = value('--settings'), packPath = value('--pack');
const settings = { ...WORM_GENERATION_RECIPE,
  ...(settingsPath ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {}),
  ...(value('--total') ? { total: Number(value('--total')) } : {}),
  ...(value('--seed') ? { seed: value('--seed') } : {}),
};
const imported = packPath ? JSON.parse(fs.readFileSync(packPath, 'utf8')) : null;
const pack = imported ? (imported.pack ?? imported) : generateCampaign(settings,
  Object.entries(STORY_WORLDS).filter(([id]) => Number(id) <= 40).map(([, world]) => world));
pack.settings = normalizeSettings(pack.settings);
if (pack.generatorVersion !== 1 || !Array.isArray(pack.levels) || pack.levels.length !== pack.settings.total - 40 ||
    pack.levels.some((level, i) => level.config?.id !== i + 41)) {
  throw Error('Campaign IDs must run consecutively from 41 through the requested total.');
}
if (!Array.isArray(pack.chapters) || pack.chapters.length !== Math.ceil(pack.settings.total / 10) - 4 ||
    pack.chapters.some((chapter, i) => chapter.id !== i + 5 || typeof chapter.title !== 'string' ||
      !chapter.title.trim() || typeof chapter.blurb !== 'string')) {
  throw Error('Chapter metadata must cover every generated level.');
}
const failed = pack.levels.map(auditGeneratedLevel).filter(result => result.status !== 'checked');
if (failed.length) throw Error('Campaign failed runtime supply checks:\n' + JSON.stringify(failed, null, 2));
const output = integrationModule(pack, WORM_GENERATION_SOURCE);
const destination = fileURLToPath(new URL('../../../src/worm/story/generated.js', import.meta.url));
if (args.includes('--check')) {
  if (fs.readFileSync(destination, 'utf8') !== output) throw Error('Generated campaign differs. Run npm run worm:generate and review the changes.');
} else {
  fs.writeFileSync(destination, output);
}
console.log(`${pack.levels.length} generated levels passed Standard and Classic runtime checks; campaign total ${pack.settings.total}.`);
