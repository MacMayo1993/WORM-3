// CPU-only audit. Does not estimate GPU frame time or phone FPS.
import { performance } from 'node:perf_hooks';
import { strict as assert } from 'node:assert';
import { WORM_STORY_LEVELS, storyLevel, storyChecklist, storyProgressText, storyOutcome } from '../src/worm/story/levels.js';
import { STORY_WORLDS } from '../src/worm/story/worlds.js';
import { stageStory } from '../src/worm/story/runtime.js';
import { makeWormSim, tileKey } from '../src/worm/healerWorm/wormSim.js';
import { getAllSurfaceTiles } from '../src/worm/healerWorm/surfaceTiles.js';
import { storySurfaceTile } from '../src/worm/story/mastery.js';
import { storyHudSnapshot } from '../src/worm/story/hudSnapshot.js';
import { makeCubies } from '../src/game/cubeState.js';

const median = values => values.sort((a,b) => a-b)[Math.floor(values.length/2)];
let sink = 0;
function measure(fn, n = 10000) {
  for (let i=0;i<1000;i++) fn();
  const times = [];
  for (let batch=0;batch<7;batch++) {
    const start = performance.now();
    for (let i=0;i<n;i++) sink += Number(!!fn());
    times.push((performance.now()-start)/n);
  }
  return median(times);
}
console.log('Level | Size | Surface tiles | Shell cubies | Orbs (non-Classic/Classic) | Stage median ms');
for (const level of WORM_STORY_LEVELS.filter(l => l.id > 10)) {
  const size = level.cubeSize, times = [], sim = makeWormSim(size);
  stageStory(sim,size,level,'glow');
  const orbs = sim.powerups.length;
  for (let i=0;i<11;i++) {
    const start = performance.now(); stageStory(sim,size,level,'classic'); times.push(performance.now()-start);
  }
  assert.ok(orbs >= (level.kind === 'orbs' ? level.target : level.orbs ?? 0));
  console.log(`${level.id} | ${size} | ${6*size*size} | ${size**3-(size-2)**3} | ${orbs}/${sim.powerups.length} | ${median(times).toFixed(3)}`);
}
const level = storyLevel(40), metrics = { elapsed: 1.5, alive: true, orbs: 1, tailClear: true };
let oldChecklist = {}, currentHud = null;
const oldHud = () => {
  const progress = storyProgressText(level,metrics);
  const checklist = { runId:1, levelId:level.id, goals:storyChecklist(level,metrics), seconds:Math.ceil(level.limit-metrics.elapsed), hint:'',
    settling:!storyOutcome(level,metrics) && storyChecklist(level,metrics).every(goal => goal.done) };
  const changed = JSON.stringify(checklist) !== JSON.stringify(oldChecklist);
  if (changed) oldChecklist=checklist;
  storyOutcome(level,metrics);
  return changed || progress.length;
};
const newHud = () => { currentHud=storyHudSnapshot(currentHud,level,metrics,1,storyOutcome(level,metrics)); return currentHud; };
console.log(`Level 40 idle HUD ms/call: before=${measure(oldHud).toFixed(5)}, after=${measure(newHud).toFixed(5)}`);
for (const size of [7,10,15]) {
  const cubies=makeCubies(size), tiles=getAllSurfaceTiles(size);
  const pos={x:Math.floor(size/2),y:Math.floor(size/2),z:0,dirKey:'NZ'};
  const occupied=new Set(tiles.map(tileKey)); // failed placement retries are the worst case
  const oldSearch=()=>tiles.find(tile=> {
    const sticker=cubies[tile.x][tile.y][tile.z].stickers[tile.dirKey];
    const distance=Math.hypot(tile.x-pos.x,tile.y-pos.y,tile.z-pos.z);
    return tile.dirKey===pos.dirKey && distance>=2 && distance<=3 && sticker.curr===sticker.orig && !occupied.has(tileKey(tile));
  });
  const newSearch=()=>storySurfaceTile({pos},size,cubies,occupied);
  assert.deepEqual(newSearch(),oldSearch());
  console.log(`${size}x${size} blocked power placement ms/call: before=${measure(oldSearch).toFixed(5)}, after=${measure(newSearch).toFixed(5)}`);
}
for (const id of [21,35]) {
  assert.ok(STORY_WORLDS[id].view.hollowMode);
  const n=storyLevel(id).cubeSize, shell=n**3-(n-2)**3;
  console.log(`Level ${id} hollow-frame meshes: ${shell*12} -> ${shell} (same ${shell*144} triangles)`);
}
assert.ok(Number.isFinite(sink));
