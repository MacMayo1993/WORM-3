import { describe, expect, it } from 'vitest';
import { DIR_FORWARD } from '../worm/healerWorm/constants.js';
import { getNextSurfacePosition } from '../worm/wormLogic.js';
import { acquireTarget, makeCombat, makeEnemy, stepCombat, surfacePose } from '../worm/combat/portalCombat.js';

const tile = (x=2,y=2) => ({x,y,z:4,dirKey:'PZ'});
const arena = () => Object.assign(makeCombat(5,tile()),{started:true,spawnTimer:999});
const player = (head=tile(),heading='right') => ({head,heading,position:surfacePose(head,head,0,5).position,protected:true,portalOpen:true,canFinish:true});
function add(c,t) { const e=Object.assign(makeEnemy(c),{tile:t,emerging:0,freeze:100}); c.enemies.push(e); return e; }
const advance = (c,p,n) => { for(let i=0;i<n;i++)stepCombat(c,.05,p); };
const offset = (t,v,n) => ({...t,x:t.x+v[0]*n,y:t.y+v[1]*n,z:t.z+v[2]*n});

describe('forward aim assist',()=>{
  it.each(Object.entries(DIR_FORWARD).flatMap(([face,dirs])=>Object.keys(dirs).map(heading=>[face,heading])))('uses the local heading on %s / %s', (face,heading)=>{
    const head={x:2,y:2,z:2,dirKey:face};head[face[1].toLowerCase()]=face[0]==='P'?4:0;
    const c=arena(),forward=DIR_FORWARD[face][heading];
    const behind=add(c,offset(head,forward,-1)),ahead=add(c,offset(head,forward,1));
    expect(acquireTarget(c,head,heading)).toBe(ahead);
    c.enemies=[behind];expect(acquireTarget(c,head,heading)).toBeNull();
    c.fireRequested=true;const p=player(head,heading);stepCombat(c,.05,p);
    expect(c.shots[0].direction).toEqual(forward);
    advance(c,p,20);expect(c.kills).toBe(0);expect(c.shots).toHaveLength(0);
  });
  it('assists within 20 degrees on either side, but rejects outside the cone',()=>{
    for(const side of [-1,1]) {
      const c=arena(),e=add(c,tile(4,2));e.next=tile(4,2+side);e.t=.6;
      expect(acquireTarget(c,tile(),'right')).toBe(e);
      e.t=.8;expect(acquireTarget(c,tile(),'right')).toBeNull();
    }
  });
  it('prefers the enemy lined up with the heading, then the nearer aligned enemy',()=>{
    const c=arena(),p=player(tile(0,1));
    add(c,tile(3,2));const aligned=add(c,tile(4,1));
    expect(acquireTarget(c,p.head,p.heading)).toBe(aligned);
    const nearer=add(c,tile(2,1));expect(acquireTarget(c,p.head,p.heading)).toBe(nearer);
  });
  it('uses the visible head position when deciding which enemies are ahead',()=>{
    const c=arena(),e=add(c,tile(3,2)),p=player();
    expect(acquireTarget(c,p.head,p.heading,p.position)).toBe(e);
    p.position[0]+=1.5;
    expect(acquireTarget(c,p.head,p.heading,p.position)).toBeNull();
  });
  it('excludes emerging enemies and enemies crossing onto another face',()=>{
    const c=arena(),e=add(c,tile(4,2));
    e.emerging=.1;expect(acquireTarget(c,tile(),'right')).toBeNull();
    e.emerging=0;e.next=getNextSurfacePosition(e.tile,'right',5);
    expect(acquireTarget(c,tile(),'right')).toBeNull();
    e.tile=e.next;e.next=null;expect(acquireTarget(c,tile(),'right')).toBeNull();
  });
  it('shows a target before firing and clears it when turning away or pausing',()=>{
    const c=arena(),e=add(c,tile(3,2)),p=player();
    stepCombat(c,.05,p);expect(c.lockedId).toBe(e.id);expect(c.shotsFired).toBe(0);
    stepCombat(c,.05,{...p,heading:'left'});expect(c.lockedId).toBeNull();
    stepCombat(c,.05,p);expect(c.lockedId).toBe(e.id);
    stepCombat(c,.05,{...p,blocked:true});expect(c.lockedId).toBeNull();expect(c.aim).toBeNull();
  });
});

describe('fixed shot trajectories',()=>{
  it('fires a straight assisted diagonal and hits without taking a grid detour',()=>{
    const c=arena(),p=player(tile(0,1));add(c,tile(4,2));c.fireRequested=true;
    stepCombat(c,.05,p);
    const shot=c.shots[0];expect(shot.direction[1]/shot.direction[0]).toBeCloseTo(.25);
    expect((shot.position[1]-p.position[1])/(shot.position[0]-p.position[0])).toBeCloseTo(.25);
    advance(c,p,15);expect(c.kills).toBe(1);expect(c.shotsHit).toBe(1);
  });
  it('does not home or retarget after an enemy moves out of the shot path',()=>{
    const c=arena(),p=player(tile(0,2)),e=add(c,tile(3,2));c.fireRequested=true;
    stepCombat(c,.05,p);const shot=c.shots[0];e.tile=tile(3,4);
    advance(c,{...p,heading:'up'},5);
    expect(shot.direction).toEqual([1,0,0]);expect(shot.position[1]).toBe(p.position[1]);
    advance(c,p,20);expect(c.kills).toBe(0);expect(c.shotsHit).toBe(0);expect(c.shots).toHaveLength(0);
  });
  it('keeps lightning chains around a corner after a direct forward hit',()=>{
    const c=arena(),p=player(tile(3,2)),edge=tile(4,2);
    add(c,edge);add(c,getNextSurfacePosition(edge,'right',5));
    Object.assign(c,{element:'lightning',elementT:14,fireRequested:true});
    advance(c,p,3);
    expect(c.kills).toBe(2);expect(c.shotsHit).toBe(1);expect(c.arcs).toHaveLength(1);
    expect(c.arcs[0].tiles.map(t=>t.dirKey)).toEqual(['PZ','PX']);
  });
});
