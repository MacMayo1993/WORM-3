import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {WORM_STORY_LEVELS, storyChecklist, storyOutcome} from '../../../src/worm/story/levels.js';
import {stageStory,replenishStoryOrbs,STORY_ORB_REFILL_INTERVAL} from '../../../src/worm/story/runtime.js';
import {offerStoryPower,nextStoryPower,STORY_POWER_OPENING_DELAY,STORY_POWER_COOLDOWN,STORY_POWER_LIFETIME} from '../../../src/worm/story/mastery.js';
import {makeWormSim,tileKey} from '../../../src/worm/healerWorm/wormSim.js';
import {getActiveTunnels,collectManifoldRing} from '../../../src/worm/wormLogic.js';
import {resetLiveRotation} from '../../../src/worm/liveRotation.js';
import {ELEMENTAL_DURATION,MAGNET_RADIUS} from '../../../src/worm/healerWorm/constants.js';
import {STORY_WORLDS} from '../../../src/worm/story/worlds.js';
import {assess} from '../web/audit.js';
const repo='MacMayo1993/WORM-3';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const commit=git('rev-parse','HEAD'),branch=git('branch','--show-current'),commitDate=git('show','-s','--format=%cI','HEAD');
const read=path=>fs.readFileSync(root+path,'utf8');
const sourcePaths=['src/worm/story/levels.js','src/worm/story/generated.js','src/worm/story/runtime.js','src/worm/story/mastery.js','src/worm/story/worlds.js','src/worm/story/combat.js'];
const sources=Object.fromEntries(sourcePaths.map(path=>[path,{path,content:read(path),url:'https://github.com/'+repo+'/blob/'+commit+'/'+path}]));
// Relevant integration evidence, with exact original line numbers.
for(const [path,start,end] of [['src/worm/HealerWormMode.jsx',540,565],['src/worm/useWormCrawler.js',202,232],['src/worm/useWormCrawler.js',606,636],['src/worm/healerWorm/wormSim.js',1178,1212]]){
 const text=read(path).split('\n').slice(start-1,end).join('\n');
 sources[path+':'+start]={path,startLine:start,content:text,url:'https://github.com/'+repo+'/blob/'+commit+'/'+path+'#L'+start+'-L'+end};
}

const records=WORM_STORY_LEVELS.map(level=>{
 const objectives=storyChecklist(level);
 const stages={};
 for(const character of ['glow','classic']){
  resetLiveRotation();
  const sim=makeWormSim(level.cubeSize);sim.rand=()=>0.42;
  const p=stageStory(sim,level.cubeSize,level,character);
  const activePairs=getActiveTunnels(p.cubies,level.cubeSize).length;
  const initialOrbs=sim.powerups.length;
  assert.equal(new Set(sim.powerups.map(tileKey)).size,initialOrbs);
  const colorCount=Object.keys(p.orbTargets).length;assert.equal(colorCount,6);
  const offered=[];let magnetReach=null;
  for(let i=0;i<24;i++){
   sim.specials=[];p.powerDelay=0;
   const type=nextStoryPower(p,level);if(!type)break;
   assert.equal(offerStoryPower(sim,p,level,level.cubeSize,p.cubies),true,'Power placement failed level '+level.id);
   assert.equal(sim.specials[0].type,type);
   if(type==='magnet'){
    const orb=sim.specials[0], reach=collectManifoldRing(orb.x,orb.y,orb.z,orb.dirKey,level.cubeSize,MAGNET_RADIUS);
    magnetReach=sim.powerups.filter(o=>reach.has(tileKey(o))&&tileKey(o)!==tileKey(orb)).length;
   }
   offered.push(type);
  }
  const powerCycle=[...new Set(offered)];
  assert.deepEqual(offered,powerCycle.length?Array.from({length:24},(_,i)=>powerCycle[i%powerCycle.length]):[]);
  sim.specials=[];sim.powerups=[];p.orbRefillDelay=0;
  const added=replenishStoryOrbs(sim,p,{cubies:p.cubies},level.cubeSize,0.1);
  const refillColorCount=new Set(sim.powerups.map(o=>p.cubies[o.x][o.y][o.z].stickers[o.dirKey].orig)).size;
  assert.equal(added,true);assert.equal(refillColorCount,6);
  const expectedPairs=['tunnel','collector','restore','mastery'].includes(level.kind)?level.target:0;
  assert.equal(activePairs+p.pendingMouths.length,expectedPairs);
  stages[character]={initialOrbs,orbTargets:p.orbTargets,colorCount,activePairs,pendingPairs:p.pendingMouths.length,totalPairs:expectedPairs,powerCycle,offered,magnetReach,refillColorCount,refillSixColors:refillColorCount===6,pickupBudget:level.cubeSize<=3?Math.floor(6*level.cubeSize**2*0.6):null};
 }
 const ideal={alive:true,elapsed:1,landed:true,tailClear:true,rotationSettled:true,remaining:0,cuts:0};
 for(const o of objectives)ideal[o.key]=o.target;
 const acceptsComplete=!!storyOutcome(level,ideal);
 const rejectsMissingGoals=objectives.every(o=>!storyOutcome(level,{...ideal,[o.key]:o.target-1}));
 assert.equal(acceptsComplete,true);assert.equal(rejectsMissingGoals,true);
 const sourcePath=level.id>40?'src/worm/story/generated.js':'src/worm/story/levels.js';
 const levelLines=sources[sourcePath].content.split('\n');
 const start=level.id>40?levelLines.findIndex(line=>line===`    "id": ${level.id},`)-1:
   levelLines.findIndex(line=>new RegExp('^  \\{ id: '+level.id+'[, ]').test(line));
 let end=start+1;
 if(level.id>40){while(end<levelLines.length&&!/^  \},?$/.test(levelLines[end]))end++;end++;}
 else{
  while(end<levelLines.length&&!/^  \{ id: |^  \.\.\.|^\];/.test(levelLines[end]))end++;
  while(end>start+1&&(levelLines[end-1].trim()===''||levelLines[end-1].trim().startsWith('//')))end--;
 }
 assert(start>=0,'Missing exact source for level '+level.id);
 const record={config:level,world:STORY_WORLDS[level.id],objectives,stages,source:{path:sourcePath,startLine:start+1,endLine:end,raw:levelLines.slice(start,end).join('\n'),url:sources[sourcePath].url+'#L'+(start+1)+'-L'+end},completionContract:{acceptsComplete,rejectsMissingGoals,tests:objectives.length+1},timing:{opening:STORY_POWER_OPENING_DELAY,cooldown:STORY_POWER_COOLDOWN,lifetime:STORY_POWER_LIFETIME,elementDuration:ELEMENTAL_DURATION,refill:STORY_ORB_REFILL_INTERVAL}};
 for(const character of ['glow','classic'])assert.equal(assess(record,character).status,'checked','Baseline audit '+level.id);
 return record;
});
const checks={levels:records.length,stages:records.length*2,powerPlacementAttempts:records.reduce((n,r)=>n+r.stages.glow.offered.length+r.stages.classic.offered.length,0),completionAssertions:records.reduce((n,r)=>n+r.completionContract.tests,0),refillChecks:records.length*2};
const sourceHashes=Object.fromEntries(sourcePaths.map(path=>[path,crypto.createHash('sha256').update(sources[path].content).digest('hex')]));
const snapshotId=crypto.createHash('sha256').update(JSON.stringify(sourceHashes)).digest('hex');
const data={schemaVersion:1,repository:repo,branch,commit,commitDate,auditedAt:new Date().toISOString(),snapshot:true,snapshotId,dirty:!!git('status','--porcelain'),records,sources,checks,sourceHashes};
fs.writeFileSync(new URL('../dist/data.json',import.meta.url),JSON.stringify(data));
console.log(JSON.stringify({result:'passed',...checks,level30:records[29].stages.glow.powerCycle}));
