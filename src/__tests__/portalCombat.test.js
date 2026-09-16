import { describe, it, expect, vi } from 'vitest';
import { COMBAT, makeCombat, stepCombat, surfaceRoute, surfacePose, acquireTarget } from '../worm/combat/portalCombat.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { getNextSurfacePosition } from '../worm/wormLogic.js';
const tile = (x=2,y=2,dirKey='PZ',z=4) => ({x,y,z,dirKey});
const player = (head=tile()) => ({ head, heading:'right', position:surfacePose(head,head,0,5).position, protected:false, blocked:false, portalOpen:true, canFinish:true });
function arena() { const c=makeCombat(5,tile(2,4)); c.started=true; c.spawnTimer=999; return c; }
function enemy(c,t=tile(3,2)) { const e={id:++c.seq,tile:t,next:null,t:0,emerging:0,stun:0};c.enemies.push(e);return e; }
const ticks=(c,p,n)=>{for(let i=0;i<n;i++)stepCombat(c,0.05,p);};

describe('portal combat surface routing',()=>{
  it('connects all 150 surface tiles using production movement edges',()=>{
    const start=tile();
    for(const end of getAllSurfaceTiles(5)) {
      const path=surfaceRoute(start,end,5); expect(path).not.toBeNull();
      let prev=start;
      for(const next of path) {
        expect(['up','right','down','left'].some(d=>{const p=getNextSurfacePosition(prev,d,5);return p&&p.x===next.x&&p.y===next.y&&p.z===next.z&&p.dirKey===next.dirKey;})).toBe(true);
        prev=next;
      }
    }
  });
  it('never shortcuts through the cube to the opposite face',()=>{
    const other=tile(2,2,'NZ',0);
    expect(surfaceRoute(tile(),other,5).length).toBeGreaterThan(COMBAT.range);
    expect(surfaceRoute(tile(),other,5,COMBAT.range)).toBeNull();
  });
  it('keeps seam interpolation outside the cube on all directed face edges',()=>{
    for(const t of getAllSurfaceTiles(5))for(const d of ['up','right','down','left']) {
      const next=getNextSurfacePosition(t,d,5); if(!next||next.dirKey===t.dirKey)continue;
      for(const u of [0,.1,.25,.5,.75,.9,1]) {
        const p=surfacePose(t,next,u,5);
        expect(Math.max(...p.position.map(Math.abs))).toBeGreaterThan(2.5);
        expect(Math.hypot(...p.normal)).toBeCloseTo(1);
      }
    }
  });
});
describe('portal combat encounters',()=>{
  it('warns before emergence and caps the active crawlers at two',()=>{
    const c=makeCombat(5,tile());c.started=true;
    const p=player(tile(0,0));p.protected=true;
    ticks(c,p,49);expect(c.enemies).toHaveLength(0);
    ticks(c,p,3);expect(c.enemies).toHaveLength(1);expect(c.enemies[0].emerging).toBeGreaterThan(0);
    ticks(c,p,500);expect(c.enemies).toHaveLength(2);
  });
  it('assists a forward shot, defeats a crawler and leaves a collectible drop',()=>{
    const c=arena();enemy(c);const p=player();p.protected=true;
    expect(acquireTarget(c,p.head,p.heading,p.position)).toBe(c.enemies[0]);
    c.fireRequested=true;ticks(c,p,20);
    expect(c.kills).toBe(1);expect(c.shotsHit).toBe(1);expect(c.enemies).toHaveLength(0);expect(c.drops).toHaveLength(1);
    expect(c.ammo).toBe(2);
  });
  it('stops a forward shot at the face edge instead of seeking around the corner',()=>{
    const c=arena(), head=tile(4,2), target=getNextSurfacePosition(head,'right',5);
    enemy(c,target);const p=player(head);p.protected=true;c.fireRequested=true;ticks(c,p,25);
    expect(c.kills).toBe(0);expect(c.shots).toHaveLength(0);
  });
  it('does not lock on to an out-of-range enemy through the cube',()=>{
    const c=arena();enemy(c,tile(2,2,'NZ',0));expect(acquireTarget(c,tile(),'right')).toBeNull();
  });
  it('limits fire rate and recharges only the three-shot magazine',()=>{
    const c=arena(),p=player();
    c.fireRequested=true;stepCombat(c,.05,p);c.fireRequested=true;stepCombat(c,.05,p);
    expect(c.shotsFired).toBe(1);
    for(let i=0;i<50;i++){c.fireRequested=true;stepCombat(c,.05,p);expect(c.ammo).toBeGreaterThanOrEqual(0);}
    expect(c.shotsFired).toBeLessThanOrEqual(5);
    ticks(c,p,140);expect(c.ammo).toBe(3);expect(c.shots).toHaveLength(0);
  });
  it('freezes all combat clocks while held and discards buffered fire',()=>{
    const c=arena(),p=player();enemy(c);c.ammo=1;c.fireRequested=true;
    const snapshot=JSON.stringify({...c,fireRequested:false});
    ticks(c,{...p,blocked:true},100);expect(JSON.stringify(c)).toBe(snapshot);
  });
  it('requires three separated hits, with jump protection and a grace period',()=>{
    const c=arena(),p=player(),hit=vi.fn();enemy(c,p.head);
    stepCombat(c,.05,{...p,protected:true},hit);expect(c.health).toBe(3);
    stepCombat(c,.05,p,hit);expect(c.health).toBe(2);
    for(let i=0;i<20;i++)stepCombat(c,.05,p,hit);expect(c.health).toBe(2);
    for(let i=0;i<50;i++)stepCombat(c,.05,p,hit);expect(c.health).toBe(0);expect(hit).toHaveBeenCalledTimes(3);
  });
  it('collects drops once without exceeding the magazine',()=>{
    const c=arena(),p=player();c.ammo=1;c.drops=[{id:1,tile:p.head,life:14}];
    ticks(c,p,2);expect(c.ammo).toBe(2);expect(c.dropsCollected).toBe(1);expect(c.drops).toHaveLength(0);
  });
  it('sealing the portal cancels spawns and ends the encounter after tail clearance',()=>{
    const c=arena(),p=player();enemy(c);c.spawnTimer=0;
    ticks(c,{...p,portalOpen:false,canFinish:false},40);expect(c.enemies).toHaveLength(1);expect(c.won).toBe(false);
    stepCombat(c,.05,{...p,portalOpen:false});expect(c.won).toBe(true);expect(c.enemies).toHaveLength(0);
    const time=c.time;ticks(c,p,10);expect(c.time).toBe(time);
  });
  it('caps hitch advancement at the same 50 ms as the worm',()=>{
    const c=arena();stepCombat(c,10,player());expect(c.time).toBe(.05);
  });
});


it('shows a muzzle pulse only for an accepted shot and freezes/expires it with combat time', () => {
  const c = arena(), p = player();
  c.fireRequested = true; stepCombat(c, .05, { ...p, aimBlocked: true });
  expect(c.muzzle).toBeNull();
  c.fireRequested = true; stepCombat(c, .05, p);
  expect(c.muzzle.origin).toEqual(c.aim.origin);
  expect(c.muzzle.direction).toEqual(c.aim.direction);
  const flash = { ...c.muzzle };
  stepCombat(c, 1, { ...p, blocked: true });
  expect(c.muzzle).toEqual(flash);
  ticks(c, p, 3); expect(c.muzzle).toBeNull();
  c.ammo = 0; c.cooldown = 0; c.fireRequested = true;
  stepCombat(c, .05, p); expect(c.muzzle).toBeNull();
});
