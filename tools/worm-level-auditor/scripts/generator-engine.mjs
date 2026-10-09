import {storyChecklist,storyOutcome} from '../../../src/worm/story/levels.js';
import {stageStory,replenishStoryOrbs,STORY_ORB_REFILL_INTERVAL} from '../../../src/worm/story/runtime.js';
import {offerStoryPower,nextStoryPower,STORY_POWER_OPENING_DELAY,STORY_POWER_COOLDOWN,STORY_POWER_LIFETIME} from '../../../src/worm/story/mastery.js';
import {makeWormSim,tileKey} from '../../../src/worm/healerWorm/wormSim.js';
import {getActiveTunnels,collectManifoldRing} from '../../../src/worm/wormLogic.js';
import {resetLiveRotation} from '../../../src/worm/liveRotation.js';
import {ELEMENTAL_DURATION,MAGNET_RADIUS} from '../../../src/worm/healerWorm/constants.js';
import {STORY_WORLDS,STORY_ORB_ROUTES} from '../../../src/worm/story/worlds.js';
import {assess} from '../web/audit.js';
import {requiredPowerCycle,SUPPORTED_SIZES} from '../web/generator.js';
const mechanicKeys=['steamFusions','quenchFusions','boosts','doubleJumps','rockets','magnetOrbs','explodes','elements','uniqueElements','elementPickups','ringHeals','signatures','bombs','kills'];
const worlds=Object.values(STORY_WORLDS),palettes=new Set(worlds.map(w=>w.palette)),backgrounds=new Set(worlds.map(w=>w.background)),styles=new Set(worlds.flatMap(w=>Object.values(w.styles)));
const positive=n=>Number.isInteger(n)&&n>0&&n<=200;
export function schemaErrors(candidate){
 const l=candidate?.config,w=candidate?.world,e=[];
 if(!l||!w)return ['A level definition and a world definition are required.'];
 if(!Number.isInteger(l.id)||l.id<41||l.id>1000)e.push('Generated IDs must be between 41 and 1000.');
 if(!SUPPORTED_SIZES.includes(l.cubeSize))e.push('Unsupported cube size.');
 if(!['orbs','tunnel','jump','rotation','collector','restore','mastery'].includes(l.kind))e.push('Unknown objective kind.');
 if(!positive(l.target))e.push('Primary target must be a positive integer.');
 if(['tunnel','collector','restore','mastery'].includes(l.kind)&&l.target>6)e.push('Current authored tunnel staging supports at most six pairs.');
 if(typeof l.title!=='string'||!l.title.trim()||l.title.length>120)e.push('Use a title between 1 and 120 characters.');
 if(!Number.isFinite(l.speed)||l.speed<.5||l.speed>4)e.push('Speed must be between 0.5 and 4.');
 if(!Number.isFinite(l.limit)||l.limit<30||l.limit>10000||!Number.isFinite(l.par)||l.par<=0||l.par>=l.limit)e.push('Par must be positive and below a limit between 30 and 10000 seconds.');
 for(const key of ['orbs','colors','rotations','orbsPerFace','rotateEvery'])if(l[key]!==undefined&&!positive(l[key]))e.push(key+' must be a positive integer.');
 if((l.colors??0)>6)e.push('There are only six food colors.');
 if(l.kind==='rotation'&&!l.rotateEvery||(l.rotations??0)>0&&!l.rotateEvery)e.push('Required rotations need a rotateEvery interval.');
 if(l.mechanics!==undefined){
  if(l.kind!=='mastery')e.push('Generated mechanic combinations use the mastery level kind.');
  if(!l.mechanics||typeof l.mechanics!=='object'||Array.isArray(l.mechanics))e.push('Mechanics must be an object.');
  else for(const [key,n] of Object.entries(l.mechanics)){
   if(!mechanicKeys.includes(key))e.push('Unsupported mechanic '+key+'.');
   if(!positive(n))e.push(key+' must be a positive integer.');
   if(['elements','uniqueElements'].includes(key)&&n>5)e.push('There are only five supported elemental types.');
   if(key==='ringHeals'&&n>l.target)e.push('Ring-heal target exceeds the staged tunnel pairs.');
  }
 }
 if(!STORY_ORB_ROUTES[w.route])e.push('Unknown food route.');
 if(!palettes.has(w.palette))e.push('Palette must come from the source world catalog.');
 if(!backgrounds.has(w.background))e.push('Background must come from the source world catalog.');
 const faceStyles=Object.values(w.styles??{});
 if(faceStyles.length!==6||[1,2,3,4,5,6].some(id=>!styles.has(w.styles?.[id]))||new Set(faceStyles).size!==1)e.push('Use one supported tile style on all six faces.');
 const views=w.view??{};
 if(views.visualMode&&!['classic','grid','sudokube','wireframe','glass','chrome','neon','gap','lego'].includes(views.visualMode))e.push('Unsupported cube view.');
 return e;
}
function invariant(pass,message){if(!pass)throw Error(message);}
export function auditGeneratedLevel(candidate){
 const errors=schemaErrors(candidate);
 if(errors.length)return {id:candidate?.config?.id,errors,record:null,status:'invalid'};
 const level=candidate.config,size=level.cubeSize,oldWorld=STORY_WORLDS[level.id];
 STORY_WORLDS[level.id]=candidate.world;
 try{
  const objectives=storyChecklist(level),stages={},expectedCycle=requiredPowerCycle(level);
  for(const character of ['glow','classic']){
   resetLiveRotation();const sim=makeWormSim(size);sim.rand=()=>.42;
   const p=stageStory(sim,size,level,character),initialOrbs=sim.powerups.length;
   const activePairs=getActiveTunnels(p.cubies,size).length;
   const totalPairs=['tunnel','collector','restore','mastery'].includes(level.kind)?level.target:0;
   invariant(new Set(sim.powerups.map(tileKey)).size===initialOrbs,'Staged food overlaps.');
   invariant(Object.keys(p.orbTargets).length===6,'Staged food does not cover all six colors.');
   invariant(activePairs+p.pendingMouths.length===totalPairs,'Staged tunnel supply differs from the target.');
   invariant(size>3||initialOrbs<=Math.floor(6*size*size*.6),'Small-board food exceeds the density allowance.');
   const offered=[];let magnetReach=0;
   for(let i=0;i<expectedCycle.length*3;i++){
    sim.specials=[];p.powerDelay=0;
    invariant(nextStoryPower(p,level)===expectedCycle[i%expectedCycle.length],'Power cycle does not match generated objectives.');
    invariant(offerStoryPower(sim,p,level,size,p.cubies),'A required power cannot be placed at launch.');
    const orb=sim.specials[0];offered.push(orb.type);
    if(orb.type==='magnet'){
     const reach=collectManifoldRing(orb.x,orb.y,orb.z,orb.dirKey,size,MAGNET_RADIUS);
     magnetReach=sim.powerups.filter(o=>reach.has(tileKey(o))&&tileKey(o)!==tileKey(orb)).length;
     invariant(magnetReach>=Math.min(4,level.mechanics.magnetOrbs),'Magnet support is below its outstanding catch allowance.');
    }
   }
   sim.specials=[];sim.powerups=[];p.orbRefillDelay=0;
   invariant(replenishStoryOrbs(sim,p,{cubies:p.cubies},size,.1),'No refill after depletion.');
   const refillColorCount=new Set(sim.powerups.map(o=>p.cubies[o.x][o.y][o.z].stickers[o.dirKey].orig)).size;
   invariant(refillColorCount===6,'Refill does not restore all six colors.');
   stages[character]={initialOrbs,orbTargets:p.orbTargets,colorCount:6,activePairs,pendingPairs:p.pendingMouths.length,totalPairs,powerCycle:expectedCycle,offered,magnetReach,refillColorCount,refillSixColors:true,pickupBudget:size<=3?Math.floor(6*size*size*.6):null};
  }
  const ideal={alive:true,elapsed:1,landed:true,tailClear:true,rotationSettled:true,remaining:0,cuts:0};
  for(const o of objectives)ideal[o.key]=o.target;
  const acceptsComplete=!!storyOutcome(level,ideal),rejectsMissingGoals=objectives.every(o=>!storyOutcome(level,{...ideal,[o.key]:o.target-1}));
  invariant(acceptsComplete&&rejectsMissingGoals,'Completion predicate and quest targets disagree.');
  const record={config:level,world:candidate.world,objectives,stages,source:{path:'Generated draft',raw:JSON.stringify(level,null,2)},completionContract:{acceptsComplete,rejectsMissingGoals,tests:objectives.length+1},timing:{opening:STORY_POWER_OPENING_DELAY,cooldown:STORY_POWER_COOLDOWN,lifetime:STORY_POWER_LIFETIME,elementDuration:ELEMENTAL_DURATION,refill:STORY_ORB_REFILL_INTERVAL}};
  const audits=['glow','classic'].map(c=>assess(record,c)),findings=audits.flatMap(a=>a.findings);
  return {id:level.id,errors:[],record,status:findings.length?'review':'checked',findings};
 }catch(error){return {id:level.id,errors:[error.message],record:null,status:'invalid'};}
 finally{if(oldWorld===undefined)delete STORY_WORLDS[level.id];else STORY_WORLDS[level.id]=oldWorld;resetLiveRotation();}
}
