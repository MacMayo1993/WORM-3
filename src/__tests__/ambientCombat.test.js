import { expect, it, vi } from 'vitest';
import { cancelAmbientEncounter, AMBIENT, makeAmbientCombat, stepAmbientCombat } from '../worm/combat/ambientCombat.js';
import { surfacePose } from '../worm/combat/portalCombat.js';

const tile = (x=0,y=0) => ({x,y,z:4,dirKey:'PZ'});
const tunnels = [{tunnelKey:'a',tunnel:{pairId:'a',entry:tile(3,0),exit:{x:1,y:4,z:0,dirKey:'NZ'}}}];
const player = () => ({head:tile(),heading:'right',position:surfacePose(tile(),tile(),0,5).position,phase:'active',alive:true,healed:0,protected:true});
function ticks(c,p,n,list=tunnels,hit) {for(let i=0;i<n;i++)stepAmbientCombat(c,.05,p,list,hit);}
function encounter() {const c=makeAmbientCombat(5);c.quiet=0;ticks(c,player(),1);return c;}
function spawned() {const c=encounter();ticks(c,player(),81);expect(c.enemies).toHaveLength(1);return c;}

it('gives 45 seconds of active play before a four-second warning and one enemy',()=>{
  const c=makeAmbientCombat(5),p=player();ticks(c,p,899);
  expect(c.encounter).toBe(false);ticks(c,p,2);
  expect(c.warning).toBe(AMBIENT.warning);expect(c.enemies).toHaveLength(0);
  ticks(c,p,79);expect(c.enemies).toHaveLength(0);
  ticks(c,p,2);expect(c.enemies).toHaveLength(1);expect(c.enemies[0].type).toBe('crawler');
});
it('never exceeds one enemy or accumulates missed spawns over ten minutes',()=>{
  const c=makeAmbientCombat(5),p=player();let max=0,lastEnd=null,previous=false;
  for(let i=0;i<12000;i++) {
    stepAmbientCombat(c,.05,p,tunnels);
    max=Math.max(max,c.enemies.length);
    if(previous&&!c.encounter)lastEnd=c.age;
    if(!previous&&c.encounter&&lastEnd!==null)expect(c.age-lastEnd).toBeGreaterThanOrEqual(30-.001);
    previous=c.encounter;
  }
  expect(max).toBe(1);expect(c.encounters).toBeGreaterThan(1);expect(c.encounters).toBeLessThanOrEqual(12);
  expect(c.won).toBe(false);expect(c.wave).toBe(0);
});
it('does not spawn while a bomb or rotation warning owns the hazard window',()=>{
  const c=makeAmbientCombat(5);c.quiet=0;ticks(c,{...player(),hazardBusy:true},1000);
  expect(c.enemies).toHaveLength(0);expect(c.encounter).toBe(false);
  ticks(c,player(),1);expect(c.warning).toBe(4);
});
it('requires a real portal on the current face at a safe distance',()=>{
  const c=makeAmbientCombat(5);c.quiet=0;ticks(c,player(),100,[]);expect(c.encounter).toBe(false);
  ticks(c,player(),100,[{tunnel:{pairId:'near',entry:tile(),exit:tile(1,0)}}]);expect(c.encounter).toBe(false);
  ticks(c,player(),100,[{tunnel:{pairId:'hidden',entry:{...tile(),z:0,dirKey:'NZ'},exit:{...tile(),z:0,dirKey:'NZ'}}}]);expect(c.encounter).toBe(false);
});
it('cancels emergence if the player approaches the mouth during the warning',()=>{
  const c=encounter();ticks(c,{...player(),head:tile(3,0)},81);
  expect(c.enemies).toHaveLength(0);expect(c.encounter).toBe(false);expect(c.quiet).toBe(30);
});
it('holds grace and encounters during pauses and tunnel travel',()=>{
  const c=makeAmbientCombat(5);ticks(c,{...player(),blocked:true},1000);expect(c.quiet).toBe(45);
  c.quiet=0;ticks(c,player(),1);ticks(c,{...player(),blocked:true},1000);expect(c.warning).toBe(4);
});
it('retires enemies after twenty active seconds and clears held fire',()=>{
  const c=spawned();c.enemies[0].freeze=100;c.fireHeld=true;
  ticks(c,{...player(),heading:'left'},401);
  expect(c.encounter).toBe(false);expect(c.enemies).toHaveLength(0);expect(c.fireHeld).toBe(false);
  expect(c.won).toBe(false);expect(c.quiet).toBeGreaterThan(29);
});
it.each(['healed','rotation','finalHealing','death'])('ends an encounter for %s without an arena victory',reason=>{
  const c=spawned(),p=player();c.health=2;c.fireHeld=true;
  if(reason==='healed')p.healed=1;
  if(reason==='rotation'){p.rotating=true;p.blocked=true;}
  if(reason==='finalHealing')p.phase='finalHealing';
  if(reason==='death')p.alive=false;
  ticks(c,p,1,reason==='healed'?[]:tunnels);
  expect(c.encounter).toBe(false);expect(c.enemies).toHaveLength(0);expect(c.shots).toHaveLength(0);
  expect(c.won).toBe(false);expect(c.fireHeld).toBe(false);
  if(reason==='healed'){expect(c.health).toBe(3);ticks(c,p,10,[]);expect(c.health).toBe(3);}
});
it('allows only one contact per encounter and preserves lost shields between encounters',()=>{
  const c=spawned(),p={...player(),protected:false},hit=vi.fn();
  Object.assign(c.enemies[0],{tile:p.head,next:null,t:0,emerging:0});
  ticks(c,p,1,tunnels,hit);expect(hit).toHaveBeenCalledWith(2);expect(c.health).toBe(2);
  expect(c.encounter).toBe(false);ticks(c,p,500,tunnels,hit);expect(hit).toHaveBeenCalledTimes(1);
  expect(c.health).toBe(2);expect(c.bursts).toHaveLength(0);
});
it('uses normal elemental buffs for shots without adding combat drops',()=>{
  const c=spawned(),p={...player(),element:'lightning',elementT:5};
  c.enemies[0].freeze=10;c.fireHeld=true;ticks(c,p,20);
  expect(c.kills).toBe(1);expect(c.drops).toHaveLength(0);expect(c.encounter).toBe(false);
  expect(c.bursts.length).toBeGreaterThan(0);expect(c.won).toBe(false);
});
it('respects MOBI parity lock on either portal mouth',()=>{
  const c=makeAmbientCombat(5);c.quiet=0;
  ticks(c,{...player(),lockedTile:tunnels[0].tunnel.exit},100);expect(c.encounter).toBe(false);
  ticks(c,player(),1);expect(c.encounter).toBe(true);
  ticks(c,{...player(),lockedTile:tunnels[0].tunnel.entry},1);expect(c.encounter).toBe(false);
});

it('cancels on committed rotations even when no live animation ran',()=>{
  const c=spawned();cancelAmbientEncounter(c);
  expect(c.enemies).toHaveLength(0);expect(c.encounter).toBe(false);expect(c.quiet).toBe(30);
});
