export const ELEMENTS = ['water','fire','grass','ice','lightning','air'];
export const elementTypes = level => level.elementTypes ?? ELEMENTS;
// Playability guardrails, not geometric impossibility proofs. Keep recovery
// lanes and reaction time instead of scaling every task with chapter number.
export const SMALL_BOARD_BUDGETS = {
  2: { speed: 1.5, bodyLength: 55, starLength: 61, orbs: 24, rotateEvery: 14 },
  3: { speed: 1.75, bodyLength: 75, starLength: 84, orbs: 32, rotateEvery: 16 },
  4: { speed: 2.05, bodyLength: 100, starLength: 112, orbs: 36, rotateEvery: 14 },
};
export function difficultyFindings(level, powerBudget = 0) {
  const findings = [], m = level.mechanics ?? {}, budget = SMALL_BOARD_BUDGETS[level.cubeSize];
  const flag = (key, message) => findings.push({ key, severity: 'review', message });
  const food = Math.max(level.orbs ?? (level.kind === 'orbs' ? level.target : 0), Math.ceil(((m.bodyLength ?? 10) - 10) / 3));
  const pairs = ['tunnel', 'collector', 'restore', 'mastery'].includes(level.kind) ? level.target : 0;
  if (budget) {
    for (const key of ['speed', 'starLength']) if ((level[key] ?? 0) > budget[key]) flag(key, `${key} exceeds the ${level.cubeSize}×${level.cubeSize} comfort budget (${budget[key]}).`);
    if ((m.bodyLength ?? 0) > budget.bodyLength) flag('bodyLength', `Growth target exceeds the small-board budget of ${budget.bodyLength} segments.`);
    if (food > budget.orbs) flag('orbs', `Required food exceeds the small-board budget of ${budget.orbs} pickups.`);
    if (level.rotateEvery && level.rotateEvery < budget.rotateEvery) flag('rotations', `Allow at least ${budget.rotateEvery}s between small-board turns.`);
    if (level.cubeSize <= 3 && ((m.selfPasses ?? 0) > 1 || (m.multiHeals ?? 0) > 1)) flag('chains', 'Pocket decks should require at most one self-pass and one double heal.');
    if (level.cubeSize <= 3 && level.kind !== 'tunnel' && (m.selfPasses || m.multiHeals)) flag('chains', 'Use free-ride trials for pocket chaining; avoid stacking paid heals and chain tasks.');
  }
  if ((m.selfPasses || m.multiHeals) && pairs < 2) findings.push({ key: 'chains', severity: 'impossible', message: 'Chain tasks need at least two staged pairs for repeatable attempts.' });
  // Power and turn waits can overlap; leave additional time for food, routing,
  // ten-second tunnel rides and recovery. This is a conservative planning model.
  const actions = ['selfPasses', 'multiHeals', 'ringHeals', 'kills', 'bombs'].reduce((n, key) => n + (m[key] ?? 0), 0);
  const reserve = food * 2 + pairs * 20 + actions * 10 + 30;
  const rotations = (level.rotations ?? (level.kind === 'rotation' ? level.target : 0)) * (level.rotateEvery ?? 0);
  const workload = Math.max(powerBudget, rotations) + reserve;
  if (workload > level.limit) flag('workload', `Combined task budget needs ${workload}s including routing and recovery; limit is ${level.limit}s.`);
  return findings;
}
export function requiredPowerCycles(level) {
  const m=level.mechanics??{};
  // Budget repeated quantities too: one elemental pickup per offer, and at
  // most four quest catches supported by each magnet offer in offerStoryPower.
  return Math.max(2,2*((m.steamFusions??0)+(m.quenchFusions??0)),m.explodes??0,m.rockets??0,m.elementPickups??0,Math.ceil((m.magnetOrbs??0)/4),m.fusions??0,m.uniqueFusions??0);
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
      detail=initial+' initially staged; refill restores up to one orb per missing color every '+record.timing.refill+' active seconds.'+(target>initial?' This quest needs at least '+(target-initial)+' pickups beyond the opening inventory.':'');
      if(!recurring&&target>initial)fail('No refill: '+target+' required exceeds '+initial+' supplied.');
      if(totalCap!==null&&target>totalCap)fail('Lifetime allowance '+totalCap+' is below the '+target+' pickup target.');
    } else if(key==='colors') {
      available=String(stage.colorCount)+' colors';
      detail='All six sticker colors measured in the staged inventory and again after full depletion.';
      if(target>stage.colorCount||initial===0&&!recurring)fail('Required color coverage is not supplied.');
      if(totalCap!==null&&totalCap<target)fail('Lifetime allowance cannot include every required color.');
    } else if(['steamFusions','quenchFusions'].includes(key)) {
      available=powerPool.includes('water')&&powerPool.includes('fire')?'Ordered base + timed partner':'Missing element';
      detail='Collect '+(key==='steamFusions'?'Fire → Water':'Water → Fire')+' during one elemental window. Missed partners expire; the base can be offered again. Route execution needs a playtest.';
      state='playtest';
      if(!powerPool.includes('water')||!powerPool.includes('fire'))fail('Both water and fire are required for this fusion.');
    } else if(['fusions','uniqueFusions'].includes(key)) {
      available=distinct.length+' types · paired offers';
      detail='Two distinct elements are offered together; collecting both within one elemental window fuses them, and pickup order picks the recipe. Route execution needs a playtest.';
      state='playtest';
      if(distinct.length<2||(key==='uniqueFusions'&&target>distinct.length*(distinct.length-1)))fail('Not enough distinct elements are offered for these fusions.');
    } else if(key==='bodyLength') {
      available=recurring?'Recurring food':String(initial)+' orbs';
      detail='Peak body length counts. Each orb adds 3 segments; deposits shrink the worm afterwards without removing credit.';
      if(!recurring&&10+3*initial<target)fail('Opening food cannot grow the worm this long without refills.');
    } else if(['elements','uniqueElements','elementPickups'].includes(key)) {
      available=distinct.length+' types · repeats';
      detail=key==='elements'?'Mastery requires actions: water momentum, fire trail, earth spring launch, ice jump/landing, lightning survival, air jump/landing. Pickup alone earns no mastery credit.':key==='uniqueElements'?'Distinct types count once on pickup. Duplicate pickups do not advance variety.':'Any elemental pickup earns quantity credit; distinct types are not required by this objective.';
      if((key==='elementPickups'&&!distinct.length)||(key!=='elementPickups'&&elementTypes(level).slice(0,target).filter(type=>distinct.includes(type)).length<target))fail('Required elemental supply is missing from the offered cycle.');
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
      available={boosts:'Player control',doubleJumps:'Player control',bodyJumps:'Staged body route',signatures:'Character ability',ringHeals:'Staged tunnels',bombs:'Recurring bombs',kills:'Recurring enemy rifts',selfPasses:'Staged tunnels',multiHeals:'Staged tunnels'}[key]??'Unverified';
      detail={boosts:'Finish the boost; pressing the control is not completion.',doubleJumps:'Two jumps in one flight, then land.',bodyJumps:'Cross your own body while airborne, then land; empty jumps do not count.',signatures:'Successful ability activation earns credit; character-specific behavior needs a playtest.',ringHeals:'Cover the surrounding tiles to heal. Healing resources recur on all colors.',bombs:'Dedicated supply retries while disarms are outstanding; surround the bomb before its fuse ends.',kills:'Dedicated enemy rifts recur while kills are outstanding; aim, combat and survival need a playtest.',selfPasses:'Dive into a tunnel while the tail is still inside one; credit lands when the head resumes crawling. Needs a long body near two mouths.',multiHeals:'A pair seals while another heal on a different pair still rides in the body, or one surround seals two pairs.'}[key]??'No supply rule has been mapped for this objective.';
      state='playtest';
      if(!record.completionContract.acceptsComplete)fail('The source completion predicate rejects the complete metric fixture.');
    }
    if(state==='impossible'||state==='undersupplied')findings.push({key,severity:state,message:detail});
    return {...o,available,detail,state};
  });
  const missedCycles=scenario.missedCycles??2, cycleLength=powerPool.length;
  const cycles=requiredPowerCycles(level);
  const powerBudget=cycleLength?record.timing.opening+missedCycles*cycleLength*(record.timing.lifetime+record.timing.cooldown)+cycles*cycleLength*(record.timing.elementDuration+4+record.timing.cooldown):0;
  findings.push(...difficultyFindings({...level, limit}, powerBudget));
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
