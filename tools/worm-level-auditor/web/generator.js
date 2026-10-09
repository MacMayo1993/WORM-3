import {ELEMENTS,requiredPowerCycles} from './audit.js';
export const GENERATOR_VERSION=1;
export const DEFAULT_SETTINGS={total:120,seed:'worm-100-plus',profile:'balanced',pace:'standard',sizes:[3,4,5,6,7,8,9,10],combat:true,mastery:true};
export const SUPPORTED_SIZES=[2,3,4,5,6,7,8,9,10,15];
const CYCLE=['magnet','explode','water','rocket','fire','grass','ice','lightning'];
const patterns=['harvest','tunnels','jumps','turns','healing','elemental','blast','variety','siege','finale'];
const adjectives=['Verdant','Prismatic','Tidal','Ember','Astral','Crystal','Neon','Lunar','Aurora','Copper','Velvet','Electric'];
const nouns=['Circuit','Frontier','Expedition','Garden','Crossing','Spiral','Crown','Archipelago','Relay','Odyssey','Horizon','Labyrinth'];
const labels={harvest:'Color Run',tunnels:'Tunnel Relay',jumps:'Tail Jumper',turns:'Turning Ground',healing:'Restore Routes',elemental:'Element Collector',blast:'Blast Flight',variety:'Element Spectrum',siege:'Rift Siege',finale:'Chapter Summit'};
const routes=['corners','gates','steps','diagonals','diamonds','channels','lanes','branches','bastions','orbit'];
export function seededRandom(seed){
 let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);
 return ()=>{h+=0x6d2b79f5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
export function requiredPowerCycle(level){
 const m=level.mechanics??{},types=new Set();
 if(m.steamFusions||m.quenchFusions){types.add('water');types.add('fire');}
 if(m.magnetOrbs)types.add('magnet');if(m.explodes)types.add('explode');if(m.rockets)types.add('rocket');
 for(const e of ELEMENTS.slice(0,Math.max(m.elementPickups??0,m.uniqueElements??0,m.elements??0)))types.add(e);
 return CYCLE.filter(x=>types.has(x));
}
export function modeledPowerBudget(level,misses=2){
 const n=requiredPowerCycle(level).length;
 return n?10+misses*n*23+requiredPowerCycles(level)*n*17:0;
}
export function levelGoal(level){
 const tasks=[],m=level.mechanics??{};
 if(level.kind==='orbs')tasks.push('Collect '+level.target+' orbs');
 if(level.kind==='tunnel')tasks.push('Cross '+level.target+' different tunnel pairs');
 if(level.kind==='jump')tasks.push('Land '+level.target+' jumps over your own body');
 if(level.kind==='rotation')tasks.push('Survive '+level.target+' layer turns');
 if(['collector','restore','mastery'].includes(level.kind))tasks.push('Heal '+level.target+' tunnel pairs');
 if(level.orbs)tasks.push('collect '+level.orbs+' orbs');
 if(level.colors)tasks.push('collect all '+level.colors+' colors');
 if(level.rotations)tasks.push('survive '+level.rotations+' layer turns');
 for(const [key,count] of Object.entries(m)){
  const phrase={steamFusions:'make '+count+' Steam fusions (Water → Fire)',quenchFusions:'make '+count+' Quench fusions (Fire → Water)',boosts:'finish '+count+' boosts',doubleJumps:'land '+count+' double jumps',rockets:'land '+count+' rocket flights',magnetOrbs:'catch '+count+' remote orbs with a magnet',explodes:'ride out '+count+' explosions',elementPickups:'collect '+count+' elemental orbs',uniqueElements:'collect '+count+' different elemental types ('+ELEMENTS.slice(0,count).join(', ')+')',elements:'master '+count+' elements ('+ELEMENTS.slice(0,count).join(', ')+')',ringHeals:'surround '+count+' tunnels',signatures:'use your ability '+count+' times',bombs:'disarm '+count+' bombs',kills:'defeat '+count+' enemies'}[key];
  if(phrase)tasks.push(phrase);
 }
 const finish=['tunnel','collector','restore','mastery'].includes(level.kind)?' Clear your tail to finish.':level.kind==='jump'?' Empty jumps do not count.':'';
 return tasks.join('; ')+'.'+finish+(m.ringHeals||m.signatures?' Surround and ability tasks must be completed before tunnel deposits seal.':'');
}
export function normalizeSettings(raw={}){
 const s={...DEFAULT_SETTINGS,...raw},total=Number(s.total);
 if(!Number.isInteger(total)||total<41||total>1000)throw Error('Choose a total campaign length from 41 to 1000.');
 if(!String(s.seed).trim()||String(s.seed).length>120)throw Error('Use a seed between 1 and 120 characters.');
 if(!['balanced','pickups','traversal'].includes(s.profile))throw Error('Unknown quest profile.');
 if(!['relaxed','standard','intense'].includes(s.pace))throw Error('Unknown pacing profile.');
 const sizes=[...new Set(s.sizes.map(Number))].filter(x=>SUPPORTED_SIZES.includes(x)).sort((a,b)=>a-b);
 if(!sizes.length)throw Error('Select at least one supported board size.');
 return {...s,total,seed:String(s.seed),sizes,combat:!!s.combat,mastery:!!s.mastery};
}
export function generateLevel(id,raw,worldTemplates,revision=0){
 const s=normalizeSettings(raw),rand=seededRandom(s.seed+':'+id+':'+revision),pick=a=>a[Math.floor(rand()*a.length)];
 const chapter=Math.ceil(id/10),slot=(id-1)%10,tier=Math.min(5,Math.floor((chapter-5)/2)),steps=Math.max(0,tier);
 let pattern=patterns[slot];
 if(s.profile==='pickups')pattern=['harvest','elemental','variety','turns','healing','elemental','blast','variety','siege','finale'][slot];
 if(s.profile==='traversal')pattern=['tunnels','healing','jumps','turns','healing','tunnels','blast','jumps','siege','finale'][slot];
 if(pattern==='siege'&&!s.combat)pattern='healing';
 let sizes=s.sizes;
 if(pattern==='jumps')sizes=sizes.filter(n=>n>=4);
 if(['elemental','variety','blast','siege','finale'].includes(pattern))sizes=sizes.filter(n=>n>=5);
 if(['tunnels','healing'].includes(pattern))sizes=sizes.filter(n=>n>=3);
 if(!sizes.length){pattern='harvest';sizes=s.sizes;}
 const size=pick(sizes),small=size<=3,food=Math.min(50,(small?10:18)+steps*3+Math.floor(rand()*5)),pairs=Math.min(6,2+Math.floor(steps/2)+(rand()>.5?1:0));
 const level={id,title:pick(adjectives)+' '+labels[pattern]+' '+id,subtitle:'Chapter '+chapter+' · '+labels[pattern],cubeSize:size,kind:'orbs',target:food,colors:6,speed:Number((small?1.35:size>=9?2.4:2.05+steps*.06).toFixed(2)),par:120,limit:210,points:Math.min(100,40+chapter*5)};
 if(small)level.orbsPerFace=2;
 if(pattern!=='harvest')delete level.colors;
 if(pattern==='tunnels'){level.kind='tunnel';level.target=pairs;}
 if(pattern==='jumps'){level.kind='jump';level.target=Math.min(6,3+Math.floor(steps/2));level.orbs=food;}
 if(pattern==='turns'){level.kind='rotation';level.target=5+steps;level.orbs=food;level.rotateEvery=small?12:Math.max(9,14-steps);}
 if(pattern==='healing'){level.kind='collector';level.target=pairs;level.colors=6;level.orbs=food;level.rotateEvery=Math.max(10,15-steps);}
 if(['elemental','variety','blast','siege','finale'].includes(pattern)){
  level.kind='mastery';level.target=pairs;level.orbs=food;level.rotateEvery=Math.max(10,15-steps);level.mechanics={};
  if(pattern==='elemental')level.mechanics.elementPickups=Math.min(5,2+Math.floor(steps/2)+(rand()>.5?1:0));
  if(pattern==='variety')level.mechanics.uniqueElements=Math.min(5,3+Math.floor(steps/2));
  if(pattern==='blast')level.mechanics={explodes:Math.min(3,1+Math.floor(steps/2)),rockets:1};
  if(pattern==='siege')level.mechanics={ringHeals:1,signatures:1+(steps>=3?1:0),bombs:1+(steps>=3?1:0),kills:Math.min(4,1+steps)};
  if(pattern==='finale'){
   level.target=Math.min(6,pairs+1);level.orbs=Math.min(50,food+6);level.rotations=5+steps;
   level.mechanics={uniqueElements:Math.min(5,3+Math.floor(steps/2)),explodes:Math.min(2,1+Math.floor(steps/3)),rockets:1,magnetOrbs:4,doubleJumps:2};
   if(s.mastery&&chapter%2===0){delete level.mechanics.uniqueElements;level.mechanics.elements=Math.min(5,3+Math.floor(steps/2));}
   if(s.combat&&steps>=2){level.mechanics.signatures=1;level.mechanics.kills=2;}
  }
 }
 const templates=worldTemplates.filter(w=>routes.includes(w.route));
 if(!templates.length)throw Error('No compatible source world templates are available.');
 const world=JSON.parse(JSON.stringify(pick(templates)));
 const style=Object.values(world.styles)[0];world.styles=Object.fromEntries([1,2,3,4,5,6].map(n=>[n,style]));
 world.name=level.title;world.route=pick(routes);
 // Per-level budgets grow with resources and workload, then retain routing slack.
 const power=modelledSafeBudget(level),rotation=(level.rotations??(level.kind==='rotation'?level.target:0))*(level.rotateEvery??0);
 const traversal=['tunnel','collector','mastery'].includes(level.kind)?level.target*25:0;
 const workload=food*3+traversal+(level.mechanics?.kills??0)*35+(level.mechanics?.bombs??0)*25+(level.mechanics?.elements??0)*14;
 const slack={relaxed:1.45,standard:1.2,intense:1}[s.pace];
 level.limit=Math.ceil(Math.max(150,Math.max(power,rotation)+workload*slack+70)/5)*5;
 level.par=Math.floor(level.limit*({relaxed:.72,standard:.7,intense:.66}[s.pace])/5)*5;
 if(s.pace==='relaxed')level.speed=Number((level.speed*.92).toFixed(2));
 if(s.pace==='intense')level.speed=Number(Math.min(2.65,level.speed*1.05).toFixed(2));
 level.goal=levelGoal(level);
 return {config:level,world,generation:{pattern,chapter,seed:s.seed,revision,tier:steps}};
}
const modelledSafeBudget=level=>modeledPowerBudget(level);
export function generateCampaign(raw,worldTemplates){
 const settings=normalizeSettings(raw);
 const levels=Array.from({length:settings.total-40},(_,i)=>generateLevel(i+41,settings,worldTemplates));
 const chapters=Array.from({length:Math.ceil(settings.total/10)-4},(_,i)=>{const id=i+5,r=seededRandom(settings.seed+':chapter:'+id),name=adjectives[Math.floor(r()*adjectives.length)]+' '+nouns[Math.floor(r()*nouns.length)];return {id,title:name,blurb:'Cross shifting routes, gather elemental powers and climb to the chapter summit.'};});
 return {schemaVersion:1,generatorVersion:GENERATOR_VERSION,settings,levels,chapters};
}
export function integrationModule(pack,sourceCommit){
 const levels=pack.levels.map(x=>x.config),worlds=Object.fromEntries(pack.levels.map(x=>[x.config.id,x.world]));
 return '// WORM³ generated campaign. Rebuild with npm run worm:generate.\n// Supply checked; full playthroughs are still required.\nexport const WORM_GENERATION_SOURCE = '+JSON.stringify(sourceCommit)+';\nexport const WORM_GENERATION_RECIPE = '+JSON.stringify(pack.settings,null,2)+';\n\nexport const WORM_GENERATED_LEVELS = '+JSON.stringify(levels,null,2)+';\n\nexport const WORM_GENERATED_WORLDS = '+JSON.stringify(worlds,null,2)+';\n\nexport const WORM_GENERATED_CHAPTERS = '+JSON.stringify(pack.chapters,null,2)+';\n';
}
