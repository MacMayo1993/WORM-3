export const ELEMENTS = ['water','fire','grass','ice','lightning'];
export function requiredPowerCycles(level) {
  const m=level.mechanics??{};
  // Budget repeated quantities too: one elemental pickup per offer, and at
  // most four quest catches supported by each magnet offer in offerStoryPower.
  return Math.max(2,2*((m.steamFusions??0)+(m.quenchFusions??0)),m.explodes??0,m.rockets??0,m.elementPickups??0,Math.ceil((m.magnetOrbs??0)/4));
}
export function assess(record, character='glow', scenario={}) {
  const level=record.config, stage=record.stages[character], powerPool=stage.powerCycle.filter(x=>!(scenario.disabledPowers??[]).includes(x));
  const initial=scenario.initialOrbs??stage.initialOrbs, recurring=scenario.recurring!==false;
  const limit=scenario.limit??level.limit, totalCap=scenario.totalCap??null;
  const distinct=powerPool.filter(x=>ELEMENTS.includes(x));
  const findings=[];
  const rows=record.objectives.map(o=>{
    let available='', detail='', state='checked';
    const fail=(message)=>{state='impossible';detail=message;};
    const key=o.key, target=o.target;
    if(key==='orbs') {
      available=recurring?'Recurring':String(initial);
      detail=initial+' initially staged; refill restores up to one orb per missing color every 1.5 active seconds.'+(target>initial?' This quest needs at least '+(target-initial)+' pickups beyond the opening inventory.':'');
      if(!recurring&&target>initial)fail('No refill: '+target+' required exceeds '+initial+' supplied.');
      if(totalCap!==null&&target>totalCap)fail('Lifetime allowance '+totalCap+' is below the '+target+' pickup target.');
    } else if(key==='colors') {
      available=String(stage.colorCount)+' colors';
      detail='All six sticker colors measured in the staged inventory and again after full depletion.';
      if(target>stage.colorCount||initial===0&&!recurring)fail('Required color coverage is not supplied.');
      if(totalCap!==null&&totalCap<target)fail('Lifetime allowance cannot include every required color.');
    } else if(['steamFusions','quenchFusions'].includes(key)) {
      available=powerPool.includes('water')&&powerPool.includes('fire')?'Ordered base + timed partner':'Missing element';
      detail='Collect '+(key==='steamFusions'?'Water → Fire':'Fire → Water')+' during one elemental window. Missed partners expire; the base can be offered again. Route execution needs a playtest.';
      state='playtest';
      if(!powerPool.includes('water')||!powerPool.includes('fire'))fail('Both water and fire are required for this fusion.');
    } else if(['elements','uniqueElements','elementPickups'].includes(key)) {
      available=distinct.length+' types · repeats';
      detail=key==='elements'?'Mastery requires actions: water momentum, fire trail, grass spring launch, ice jump/landing, lightning survival. Pickup alone earns no mastery credit.':key==='uniqueElements'?'Distinct types count once on pickup. Duplicate pickups do not advance variety.':'Any elemental pickup earns quantity credit; distinct types are not required by this objective.';
      if((key==='elementPickups'&&!distinct.length)||(key!=='elementPickups'&&distinct.length<target))fail('Required elemental supply is missing from the offered cycle.');
    } else if(['explodes','rockets','magnetOrbs'].includes(key)) {
      const type={explodes:'explode',rockets:'rocket',magnetOrbs:'magnet'}[key];
      available=powerPool.includes(type)?(key==='magnetOrbs'?stage.magnetReach+' in reach · repeats':'Recurring'):'0 offers';
      detail={explodes:'Credit is earned after the 12-second explosion closes and the worm is safe.',rockets:'Credit is earned after the rocket flight lands.',magnetOrbs:'Support is bounded at four outstanding remote catches, within the real two-step manifold reach.'}[key];
      if(!powerPool.includes(type))fail('The '+type+' power is absent from the required offer cycle.');
      else if(key==='magnetOrbs'&&stage.magnetReach===0)fail('No catchable food was measured around the magnet offer.');
    } else if(['healed','uniqueTunnels'].includes(key)) {
      available=stage.totalPairs+' pairs';
      detail=stage.activePairs+' open at launch; '+stage.pendingPairs+' reserved for staged replacement. Tail clearance and sealing conditions still apply.';
      if(target>stage.totalPairs)fail('Required tunnel pairs exceed the staged network.');
    } else if(key==='rotations') {
      available=level.rotateEvery?'Every '+level.rotateEvery+'s':'Disabled';
      detail='Nominal '+target+' × '+(level.rotateEvery??0)+' = '+target*(level.rotateEvery??0)+'s. Hazard holds and animation can add time.';
      if(!level.rotateEvery)fail('Required turns have no rotation schedule.');
      else if(target*level.rotateEvery>=limit){state='undersupplied';detail='Nominal rotation time consumes the time limit before routing and settling.';}
    } else {
      available={boosts:'Player control',doubleJumps:'Player control',bodyJumps:'Staged body route',signatures:'Character ability',ringHeals:'Staged tunnels',bombs:'Recurring bombs',kills:'Recurring enemy rifts'}[key]??'Unverified';
      detail={boosts:'Finish the boost; pressing the control is not completion.',doubleJumps:'Two jumps in one flight, then land.',bodyJumps:'Cross your own body while airborne, then land; empty jumps do not count.',signatures:'Successful ability activation earns credit; character-specific behavior needs a playtest.',ringHeals:'Cover the surrounding tiles to heal. Healing resources recur on all colors.',bombs:'Dedicated supply retries while disarms are outstanding; surround the bomb before its fuse ends.',kills:'Dedicated enemy rifts recur while kills are outstanding; aim, combat and survival need a playtest.'}[key]??'No supply rule has been mapped for this objective.';
      state='playtest';
      if(!record.completionContract.acceptsComplete)fail('The source completion predicate rejects the complete metric fixture.');
    }
    if(state==='impossible'||state==='undersupplied')findings.push({key,severity:state,message:detail});
    return {...o,available,detail,state};
  });
  const missedCycles=scenario.missedCycles??2, cycleLength=powerPool.length;
  const cycles=requiredPowerCycles(level);
  const powerBudget=cycleLength?record.timing.opening+missedCycles*cycleLength*(record.timing.lifetime+record.timing.cooldown)+cycles*cycleLength*(record.timing.elementDuration+4+record.timing.cooldown):0;
  if(cycleLength&&powerBudget>=limit)findings.push({key:'timing',severity:'undersupplied',message:'Conservative power-offer model uses '+powerBudget+'s of the '+limit+'s limit; routing, combat and tunnels are excluded.'});
  if(!stage.refillSixColors&&recurring)findings.push({key:'refill',severity:'impossible',message:'Runtime refill did not restore six colors after depletion.'});
  if(!record.completionContract.rejectsMissingGoals)findings.push({key:'completion',severity:'review',message:'A missing objective was accepted by the source completion predicate.'});
  const status=findings.some(f=>f.severity==='impossible')?'impossible':findings.some(f=>f.severity==='undersupplied')?'undersupplied':findings.length?'review':'checked';
  return {rows,findings,status,powerPool,distinct,initial,recurring,powerBudget,headroom:limit-powerBudget,limit,missedCycles,stage,totalCap};
}
export function filterRecords(records,filters,reviews={}) {
  const search=(filters.search??'').toLowerCase().trim();
  return records.filter(r=>{
    const l=r.config, a=assess(r,filters.character??'glow'), review=reviews[l.id];
    const text=[l.id,l.title,l.goal,l.kind,...r.objectives.map(o=>o.key),...a.powerPool].join(' ').toLowerCase();
    const goal=l.orbs??(l.kind==='orbs'?l.target:0);
    return (!filters.scope||(filters.scope==='generated'?l.id>40:l.id<=40))&&(!search||text.includes(search))&&(!filters.chapter||Math.ceil(l.id/10)===+filters.chapter)&&(!filters.size||l.cubeSize===+filters.size)&&
      (!filters.quest||(filters.quest==='refill'?goal>a.initial:r.objectives.some(o=>filters.quest==='elemental'?['elements','uniqueElements','elementPickups','steamFusions','quenchFusions'].includes(o.key):filters.quest==='explode'?o.key==='explodes':o.key===filters.quest)))&&
      (!filters.status||(filters.status==='flagged'?!!review?.flag:filters.status==='playtest'?a.rows.some(o=>o.state==='playtest'):a.status===filters.status));
  });
}
