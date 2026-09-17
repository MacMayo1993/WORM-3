import { describe, it, expect } from 'vitest';
import { makeCombat, makeEnemy, stepCombat, surfacePose, surfaceRoute, COMBAT } from '../worm/combat/portalCombat.js';
import { WAVES, ELEMENT_ORDER, ELEMENT_DURATION } from '../worm/combat/combatDefs.js';
const tile=(x=2,y=2)=>({x,y,z:4,dirKey:'PZ'});
function arena(){const c=makeCombat(5,tile());c.started=true;c.spawnTimer=999;return c;}
const player=(head=tile())=>({head,position:surfacePose(head,head,0,5).position,heading:'right',portalOpen:true,canFinish:true,protected:true,blocked:false});
const advance=(c,p,n)=>{for(let i=0;i<n;i++)stepCombat(c,.05,p);};
function add(c,type='brute',t=tile()) {const e=makeEnemy(c,type);e.tile=t;e.emerging=0;c.enemies.push(e);return e;}
function shoot(c,p,element=null){c.element=element;c.elementT=14;c.cooldown=0;c.ammo=3;c.fireRequested=true;stepCombat(c,.05,p);}

describe('waves and enemy behavior',()=>{
  it('plays all three complete waves with held fire, then stops spawning permanently',()=>{
    const c=makeCombat(5,tile()),p=player();c.started=true;c.fireHeld=true;
    let maxEnemies=0;const types=new Set();
    for(let i=0;i<4000&&!c.won;i++){
      stepCombat(c,.05,p);maxEnemies=Math.max(maxEnemies,c.enemies.length);
      c.enemies.forEach(e=>types.add(e.type));
    }
    expect(c.won).toBe(true);expect(c.endReason).toBe('waves');expect(c.wavesCleared).toBe(3);
    expect(c.kills).toBe(WAVES.reduce((n,w)=>n+w.enemies.length,0));
    expect(types).toEqual(new Set(['crawler','scout','brute']));expect(maxEnemies).toBeLessThanOrEqual(COMBAT.maxEnemies);
    expect(c.enemies).toHaveLength(0);expect(c.fireHeld).toBe(false);
    const score=c.score;advance(c,p,100);expect(c.score).toBe(score);
  });
  it('refills ammo and repairs only one shield after an intermission',()=>{
    const c=arena(),p=player();c.waveSpawned=3;c.health=1;c.ammo=0;
    stepCombat(c,.05,p);expect(c.wavesCleared).toBe(1);expect(c.intermission).toBe(4);
    advance(c,p,40);expect(c.wave).toBe(0);expect(c.enemies).toHaveLength(0);expect(c.health).toBe(1);
    advance(c,p,41);expect(c.wave).toBe(1);expect(c.health).toBe(2);expect(c.ammo).toBe(3);
  });
  it('holds intermission and infusion timers during pause',()=>{
    const c=arena();c.intermission=4;c.element='fire';c.elementT=7;c.fireHeld=true;
    advance(c,{...player(),blocked:true},100);
    expect(c.intermission).toBe(4);expect(c.elementT).toBe(7);expect(c.fireHeld).toBe(false);
  });
  it('requires three ordinary impacts to defeat an armored crawler',()=>{
    const c=arena(),p=player(),e=add(c);
    shoot(c,p);expect(e.hp).toBe(2);expect(c.kills).toBe(0);
    shoot(c,p);expect(e.hp).toBe(1);shoot(c,p);expect(c.kills).toBe(1);expect(c.shotsHit).toBe(3);
  });
  it('telegraphs a dash before moving faster',()=>{
    const c=arena(),p=player(tile(4,2)),e=add(c,'scout',tile(0,2));
    advance(c,p,8);expect(e.t).toBe(0);
    advance(c,p,6);expect(e.t).toBeGreaterThan(.25);
  });
  it('keeps firing after an empty magazine recharges, then stops on release',()=>{
    const c=arena(),p=player();c.fireHeld=true;advance(c,p,100);expect(c.shotsFired).toBeGreaterThan(3);
    c.fireHeld=false;const count=c.shotsFired;advance(c,p,100);expect(c.shotsFired).toBe(count);
  });
  it('awards combo points for consecutive kills and resets the combo on damage',()=>{
    const c=arena(),p=player();add(c,'crawler');shoot(c,p);expect(c.score).toBe(100);
    add(c,'crawler');shoot(c,p);expect(c.score).toBe(300);expect(c.bestCombo).toBe(2);
    add(c,'brute');stepCombat(c,.05,{...p,protected:false});expect(c.combo).toBe(0);expect(c.damageTaken).toBe(1);
  });
});
describe('elemental ammunition',()=>{
  it.each(ELEMENT_ORDER)('collects %s as a timed shot infusion, separate from healing inventory',element=>{
    const c=arena();c.drops=[{id:1,tile:tile(3,2),life:20,element}];
    stepCombat(c,.05,{...player(),protected:false});expect(c.element).toBe(element);expect(c.elementT).toBe(ELEMENT_DURATION);
    advance(c,player(),281);expect(c.element).toBeNull();expect(c.elementT).toBe(0);
  });
  it('burns through the remaining armor after a fire impact',()=>{
    const c=arena(),p=player();add(c);shoot(c,p,'fire');expect(c.kills).toBe(0);
    advance(c,p,65);expect(c.kills).toBe(1);expect(c.shotsHit).toBe(1);
  });
  it('freezes movement and contact attacks until the ice wears off',()=>{
    const c=arena(),p=player(),e=add(c);shoot(c,p,'ice');const hp=c.health;
    advance(c,{...p,protected:false},30);expect(c.health).toBe(hp);expect(e.freeze).toBeGreaterThan(0);
    advance(c,{...p,protected:false},18);expect(c.health).toBe(hp-1);
  });
  it('roots an armored enemy while leaving its contact damage active',()=>{
    const c=arena(),p=player(),e=add(c);shoot(c,p,'grass');
    advance(c,player(tile(4,2)),20);expect(e.t).toBe(0);expect(e.root).toBeGreaterThan(0);
    stepCombat(c,.05,{...p,protected:false});expect(c.health).toBe(2);
  });
  it('pushes a surviving enemy one surface step away',()=>{
    const c=arena(),p=player(),e=add(c);shoot(c,p,'water');advance(c,p,4);
    expect(surfaceRoute(p.head,e.tile,5)).toHaveLength(1);expect(e.knockback).toBe(false);expect(e.stun).toBeGreaterThan(0);
  });
  it('chains to nearby enemies but never reaches through the cube',()=>{
    const c=arena(),p=player();add(c,'crawler');add(c,'crawler',tile(3,2));
    const far=add(c,'crawler',{x:2,y:2,z:0,dirKey:'NZ'});shoot(c,p,'lightning');
    expect(c.kills).toBe(2);expect(c.shotsHit).toBe(1);expect(c.enemies).toEqual([far]);
  });
  it('cycles guaranteed elemental drops through all five types',()=>{
    const c=arena(),p=player(),elements=[];
    for(let i=0;i<9;i++) {add(c,'crawler');shoot(c,p);const last=c.drops.at(-1);if(last.element)elements.push(last.element);}
    expect(elements).toEqual(ELEMENT_ORDER);
  });
});
