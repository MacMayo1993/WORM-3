import {assess,filterRecords,ELEMENTS} from './audit.js';
const app=document.getElementById('app');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=s=>s?s[0].toUpperCase()+s.slice(1):'';
const color={magnet:'#b8a0ff',explode:'#ffc27b',water:'#7bcfff',rocket:'#fff59b',fire:'#ff8c78',grass:'#b5f775',ice:'#a3eee9',lightning:'#eac3ff'};
const colorIds={1:['#fd705e','Red'],2:['#67d6a0','Green'],3:['#faf4d0','White'],4:['#f7a154','Orange'],5:['#77aaff','Blue'],6:['#edc758','Yellow']};
const statusText={checked:'Supply checked',impossible:'Impossible',undersupplied:'Under-supplied',review:'Review needed',playtest:'Gameplay check'};
let data,selected=30,tab='audit',sourceKey='src/worm/story/mastery.js',scenario={},storageOkay=true,reviews={};
const filters={search:'',chapter:'',size:'',quest:'',status:'',character:'glow'};
let storageKey;
try{data=await fetch('./data.json').then(r=>{if(!r.ok)throw Error('Audit data unavailable');return r.json();});}
catch(error){app.innerHTML='<div class="loading">Audit could not load<span>'+esc(error.message)+'. Reload this page to retry.</span></div>';throw error;}
storageKey='worm-auditor-reviews-v1:'+(data.snapshotId??data.commit);
try{reviews=JSON.parse(localStorage.getItem(storageKey)||'{}');if(!reviews||typeof reviews!=='object'||Array.isArray(reviews))reviews={};}catch{reviews={};storageOkay=false;}
const match=location.hash.match(/^#level-(\d+)$/);if(match&&data.records.some(r=>r.config.id===+match[1]))selected=+match[1];
const record=()=>data.records.find(r=>r.config.id===selected);
function badge(state){return '<span class="badge '+state+'">'+statusText[state]+'</span>';}
function summary(){
 const results=data.records.map(r=>assess(r,filters.character));
 return {blockers:results.filter(r=>['impossible','undersupplied'].includes(r.status)).length,power:data.records.filter(r=>r.stages.glow.powerCycle.length).length,flagged:Object.values(reviews).filter(r=>r.flag).length};
}
function render(){
 const sum=summary();
 app.innerHTML=`<header class="topbar"><div class="brand"><img src="icon.svg" alt=""><strong>WORM<sup>3</sup></strong><span class="divider"></span><small>Level Auditor</small></div><div style="display:flex;align-items:center;gap:15px"><a href="generator.html" style="font-size:12px">Level generator ↗</a><span class="private">LOCAL · LOOPBACK ONLY</span></div></header>
 <section class="hero"><div><div class="eyebrow">Worm Mode / Campaign diagnostics</div><h1>Every quest. Enough supply?</h1><p>Inspect the campaign, trace the rules, and find the levels that need attention.</p></div><div class="snapshot"><div class="muted">LOCAL SOURCE SNAPSHOT</div><a class="commit mono" href="https://github.com/${data.repository}/commit/${data.commit}" target="_blank" rel="noopener">${esc(data.branch)} / ${data.commit.slice(0,8)} ↗</a><div class="snapdate muted">${new Date(data.auditedAt).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}</div></div></section>
 <div class="metrics"><div class="metric"><div class="number">${data.records.length}<span>/ ${data.records.length}</span></div><div class="label">Campaign levels audited</div></div><div class="metric"><div class="number">${sum.power}</div><div class="label">Levels with required power pickups</div></div><div class="metric"><div class="number ${sum.blockers?'orange':'green'}">${sum.blockers}</div><div class="label">Detected supply blockers</div></div><div class="metric"><div class="number ${sum.flagged?'orange':''}">${sum.flagged}</div><div class="label">Your flagged levels</div></div></div>
 <main class="workspace"><aside class="sidebar" aria-label="Level filters and selection"><div class="filterbox"><div class="eyebrow">Level index</div><label class="sr-only" for="search">Search levels or objectives</label><input id="search" type="search" placeholder="Search level, orb, or objective…" value="${esc(filters.search)}"><div class="filtergrid">
 ${selectFilter('chapter','All chapters',data.records.filter(r=>r.config.id%10===1).map(r=>[Math.ceil(r.config.id/10),'Ch. '+Math.ceil(r.config.id/10)]))}
 ${selectFilter('size','All sizes',[...new Set(data.records.map(r=>r.config.cubeSize))].sort((a,b)=>a-b).map(x=>[x,x+' × '+x]))}
 ${selectFilter('quest','All quests',[['elemental','Elemental'],['explode','Explode'],['orbs','Food orbs'],['magnetOrbs','Magnet'],['rockets','Rocket'],['kills','Combat'],['rotations','Rotations'],['healed','Healing']])}
 ${selectFilter('status','All statuses',[['checked','Supply checked'],['impossible','Impossible'],['undersupplied','Under-supplied'],['playtest','Gameplay check'],['flagged','Your flags']])}
 </div><div class="resultcount"><span id="resultcount"></span><button id="resetfilters" class="textbutton">Clear filters</button></div></div><nav class="level-list" id="level-list" aria-label="Levels"></nav><div class="sidebar-foot">Checkout snapshot; rebuild to refresh.<br>Review flags stay in this browser. Export to keep a copy.</div></aside><article class="detail" id="detail" aria-label="Selected level"></article></main>
 <footer class="footer"><div>${data.repository} · ${data.commit.slice(0,8)} · LOCAL CHECKOUT${data.dirty?' · UNCOMMITTED CHANGES':''}</div><div>Supply and completion rules checked. Full playthrough feasibility remains to be tested.</div></footer>`;
 document.getElementById('search').addEventListener('input',e=>{filters.search=e.target.value;renderList();});
 for(const key of ['chapter','size','quest','status'])document.getElementById('filter-'+key).addEventListener('change',e=>{filters[key]=e.target.value;renderList();});
 document.getElementById('resetfilters').onclick=()=>{for(const k of ['search','chapter','size','quest','status'])filters[k]='';render();};
 renderList();renderDetail();
}
function selectFilter(key,label,options){return `<label class="sr-only" for="filter-${key}">${title(key)} filter</label><select id="filter-${key}"><option value="">${label}</option>${options.map(([v,t])=>'<option value="'+v+'"'+(String(v)===filters[key]?' selected':'')+'>'+t+'</option>').join('')}</select>`;}
function renderList(){
 const visible=filterRecords(data.records,filters,reviews);let chapter=0;
 document.getElementById('resultcount').textContent=visible.length+' / '+data.records.length+' levels';
 document.getElementById('level-list').innerHTML=visible.length?visible.map(r=>{
 const l=r.config,c=Math.ceil(l.id/10);let heading='';
 if(c!==chapter){chapter=c;heading='<div class="chapter-label">'+['','01 / Hatchling','02 / Every Size','03 / Strange Views','04 / Grand Crawl'][c]+'</div>';}
 return heading+`<button class="level-item ${selected===l.id?'selected':''}" data-level="${l.id}" aria-current="${selected===l.id?'true':'false'}"><span class="level-num">${String(l.id).padStart(2,'0')}</span><span><span class="level-name">${esc(l.title)}</span><span class="level-meta">${l.cubeSize}×${l.cubeSize} · ${l.limit}s · ${r.objectives.length} objectives</span></span><i class="dot ${reviews[l.id]?.flag?'flag':''}" aria-label="${reviews[l.id]?.flag?'Flagged':'Supply checked'}"></i></button>`;
 }).join(''):'<div class="empty">No levels match these filters.<br>Try clearing a filter or searching for an orb type.</div>';
 for(const button of document.querySelectorAll('[data-level]'))button.onclick=()=>{selected=+button.dataset.level;scenario={};history.replaceState(null,'','#level-'+selected);renderList();renderDetail();};
}
function renderDetail(){
 const r=record(),l=r.config,a=assess(r,filters.character);
 document.getElementById('detail').innerHTML=`<div class="levelhead"><div><div class="eyebrow">Chapter ${Math.ceil(l.id/10)} / Level ${String(l.id).padStart(2,'0')} / ${l.cubeSize} × ${l.cubeSize}</div><h2>${esc(l.title)}</h2><p>${esc(l.goal)}</p></div><div class="headside">${badge(a.status)}<span class="muted mono small">PAR ${l.par}s / LIMIT ${l.limit}s</span><label class="sr-only" for="character">Character food density</label><select id="character"><option value="glow" ${filters.character==='glow'?'selected':''}>Standard food density</option><option value="classic" ${filters.character==='classic'?'selected':''}>Classic · 1.5× food</option></select></div></div>
 <div class="tabs" role="tablist" aria-label="Level views">${[['audit','Objectives & supply'],['config','Configuration'],['review','Review & export'],['method','Method']].map(([k,name])=>'<button class="tab '+(tab===k?'active':'')+'" role="tab" aria-selected="'+(tab===k)+'" data-tab="'+k+'">'+name+'</button>').join('')}</div>
 <div class="content" role="tabpanel">${tab==='audit'?auditView(r,a):tab==='config'?configView(r):tab==='review'?reviewView(r):methodView()}</div>`;
 document.getElementById('character').onchange=e=>{filters.character=e.target.value;scenario={};render();};
 for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{tab=b.dataset.tab;renderDetail();};
 if(tab==='audit')bindSandbox();
 if(tab==='config')document.getElementById('source-select').onchange=e=>{sourceKey=e.target.value;renderDetail();};
 if(tab==='review')bindReview(r);
}
function auditView(r,a){
 const l=r.config,power=a.powerPool,needsTail=['tunnel','collector','restore','mastery'].includes(l.kind);
 const gates=['Alive; within '+l.limit+'s',...(needsTail?['Tail clear']:[]),...(['collector','restore','mastery'].includes(l.kind)?['No tunnels remaining','Rotation settled']:[]),...(l.kind==='rotation'?['Rotation settled']:[]),...(l.kind==='jump'||l.mechanics?['Landed']:[])];
 return `<div class="section-title"><h3>Required power cycle</h3><small>ONE SPECIAL ON BOARD AT A TIME</small></div>
 <div class="cycle">${power.length?power.map((type,i)=>(i?'<span class="cycle-arrow" aria-hidden="true">→</span>':'')+'<div class="power" style="--power:'+color[type]+'"><span>'+String(i+1).padStart(2,'0')+'</span><i></i>'+title(type)+'</div>').join(''):'<span class="muted small">No special power pickups required for this level.</span>'}${power.length?'<span class="cycle-arrow mono small">↻ repeat unfinished goals</span>':''}</div>
 <div class="callout">${l.id===30?'<strong>Level 30 uses pickup variety.</strong> Water, Fire and Grass each count once on collection. Explode is the second required offer, even when Magnet was missed.':power.length?'<strong>Missed offers do not hold up the cycle.</strong> Successfully placed powers advance the cursor; completed goals are skipped. Every required power repeats until its task is done.':'<strong>Ordinary orbs keep returning.</strong> Initial supply is a simultaneous board inventory, not a lifetime pickup allowance.'}</div>
 <div class="section-title"><h3>Objective supply ledger</h3><small>${r.objectives.length} COMPLETION REQUIREMENTS</small></div>
 <div class="tablewrap"><table class="questtable"><thead><tr><th>Objective / completion rule</th><th>Required</th><th>Available supply</th><th>Audit result</th></tr></thead><tbody>${a.rows.map(o=>'<tr><td>'+esc(o.label)+'<span class="explain">'+esc(o.detail)+'</span></td><td>'+o.target+'</td><td>'+esc(o.available)+'</td><td>'+badge(o.state)+'</td></tr>').join('')}</tbody></table></div>
 <p class="table-note">“Supply checked” confirms the mapped resource is offered. “Gameplay check” requires a successful action or playthrough. Neither guarantees a full run can be completed.</p>
 <div class="two-col"><section class="subcard"><h3>Initial parity-orb inventory <span class="muted mono">· ${a.initial}</span></h3><div class="colors">${Object.entries(a.stage.orbTargets).map(([id,count])=>'<div><div class="colorbar" style="--color:'+colorIds[id][0]+'"><div style="height:'+Math.max(15,count/Math.max(...Object.values(a.stage.orbTargets))*100)+'%"></div></div><div class="colorcount">'+count+'</div><div class="colortext">'+colorIds[id][1]+'</div></div>').join('')}</div><p class="table-note" style="margin-bottom:0">Counts use sticker color, so they follow layer turns. Runtime depletion test restored all six colors.</p></section>
 <section class="subcard"><h3>Pickup allowances</h3><div class="fact"><span>Lifetime food pickups</span><strong>No configured cap</strong></div><div class="fact"><span>Staged food density ceiling</span><strong>${a.stage.pickupBudget!==null?a.stage.pickupBudget+' · 60% of surface':'No explicit ceiling'}</strong></div><div class="fact"><span>Concurrent special powers</span><strong>1</strong></div><div class="fact"><span>Required power lifetime</span><strong>20 active seconds</strong></div><div class="fact"><span>Food refill / recovery</span><strong>1.5s / 3s</strong></div></section></div>
 ${power.length?`<section class="subcard"><div class="section-title"><h3>Conservative power-supply budget</h3><small>ROUTING & COMBAT EXCLUDED</small></div><div class="budget ${a.powerBudget>=l.limit?'warn':''}"><div style="width:${Math.min(100,a.powerBudget/l.limit*100)}%"></div></div><div class="budgetlabels"><span>${a.powerBudget}s modeled supply time</span><span class="green">${a.headroom}s remaining / ${l.limit}s limit</span></div><div class="budgetformula">10s opening + 2 missed cycles × ${power.length} powers × (20s + 3s)<br>+ ${Math.max(2,l.mechanics?.explodes??0,l.mechanics?.rockets??0)} successful cycles × ${power.length} powers × (10s + 4s + 3s)</div><p class="table-note" style="margin-bottom:0">This stress model budgets repeated offers and effect recovery. Crowded placement, travel, hazard holds, combat and tunnel clearance can add time. Headroom is not a completion-time prediction.</p></section>`:''}
 <div class="section-title" style="margin-top:23px"><h3>Finish-state gates</h3><small>SOURCE COMPLETION PREDICATE</small></div><div class="gates">${gates.map(g=>'<span class="gate">'+g+'</span>').join('')}</div>
 <details class="disclosure" id="sandbox"><summary>Supply stress test <span class="muted mono small">LOCAL WHAT-IF</span></summary><div class="sandbox"><p>Change supply assumptions to expose impossible or under-supplied quests. The source snapshot stays unchanged; results apply only to this scenario.</p>
 <div class="sandbox-fields"><div class="field"><label for="scenario-orbs">Initial food orbs</label><input id="scenario-orbs" type="number" min="0" max="10000" value="${scenario.initialOrbs??a.initial}"></div><div class="field"><label for="scenario-limit">Time limit (seconds)</label><input id="scenario-limit" type="number" min="1" max="10000" value="${scenario.limit??l.limit}"></div><div class="field"><label for="scenario-misses">Missed full power cycles</label><input id="scenario-misses" type="number" min="0" max="20" value="${scenario.missedCycles??2}"></div><div class="field"><label for="scenario-cap">Hypothetical lifetime food cap</label><input id="scenario-cap" type="number" min="0" max="10000" placeholder="No cap" value="${scenario.totalCap??''}"></div></div>
 <label class="checkrow"><input id="scenario-refill" type="checkbox" ${scenario.recurring!==false?'checked':''}>Keep recurring food refill enabled</label>
 ${power.length?'<div class="eyebrow">Enabled required powers</div><div class="powerchecks">'+power.map(p=>'<label><input type="checkbox" data-power="'+p+'" '+(!(scenario.disabledPowers??[]).includes(p)?'checked':'')+'>'+title(p)+'</label>').join('')+'</div>':''}
 <div class="sandbox-results" id="scenario-results" aria-live="polite"></div><button id="scenario-reset" class="sandbox-reset">Reset to source assumptions</button></div></details>
 <p class="scope-note">Validated using the actual project modules: staged board, repeated power placement, depleted-food refill and completion-rule fixtures. Placement was tested at launch with a fixed random seed. No full gameplay solver or manual playthrough is included.</p>`;
}
function configView(r){
 const s=data.sources[sourceKey];
 return `<div class="section-title"><h3>Authored level definition</h3><small>IMMUTABLE SOURCE SNAPSHOT</small></div><div class="sourcebar"><span>${esc(r.source.path)} · lines ${r.source.startLine}–${r.source.endLine}</span><a href="${r.source.url}" target="_blank" rel="noopener">Open on GitHub ↗</a></div><pre class="code">${esc(r.source.raw)}</pre>
 <div class="config-grid"><section><div class="section-title"><h3>Resolved quest targets</h3></div><pre class="code">${esc(JSON.stringify(Object.fromEntries(r.objectives.map(o=>[o.key,o.target])),null,2))}</pre></section><section><div class="section-title"><h3>World & route configuration</h3></div><pre class="code">${esc(JSON.stringify(r.world,null,2))}</pre></section></div>
 <div class="section-title"><h3>Inspect supply & completion logic</h3></div><label class="sr-only" for="source-select">Source file to inspect</label><select class="select-source" id="source-select">${Object.keys(data.sources).map(k=>'<option value="'+esc(k)+'"'+(k===sourceKey?' selected':'')+'>'+esc(k)+'</option>').join('')}</select><div class="sourcebar"><span>${esc(s.path)}${s.startLine?' · excerpt from line '+s.startLine:''}</span><a href="${s.url}" target="_blank" rel="noopener">Open source ↗</a></div><pre class="code">${esc(s.content)}</pre><p class="scope-note">Configuration is read-only. These definitions were fetched from commit ${data.commit.slice(0,8)}. New GitHub commits are not automatically incorporated into this audit.</p>`;
}
function reviewView(r){
 const note=reviews[r.config.id]??{};
 return `<div class="section-title"><h3>Your review</h3><small>LEVEL ${r.config.id}</small></div><p class="reviewintro">Flag a level for follow-up and record what happened in play. Your flags are separate from the automated supply checks and never write to GitHub.</p>
 <div class="review-grid"><div class="field"><label for="review-flag">Flag</label><select id="review-flag">${[['','No flag'],['impossible','Impossible quest'],['undersupplied','Under-supplied'],['playtest','Needs playtest'],['verified','Verified in play']].map(([v,t])=>'<option value="'+v+'"'+(note.flag===v?' selected':'')+'>'+t+'</option>').join('')}</select></div><div class="field"><label for="review-state">Review state</label><select id="review-state">${[['unreviewed','Unreviewed'],['inprogress','Investigating'],['done','Reviewed']].map(([v,t])=>'<option value="'+v+'"'+((note.state??'unreviewed')===v?' selected':'')+'>'+t+'</option>').join('')}</select></div></div>
 <div class="field"><label for="review-notes">Evidence / reproduction notes</label><textarea id="review-notes" placeholder="e.g. Character, route, missing offer, time remaining, and what the quest counter showed.">${esc(note.notes??'')}</textarea></div><div id="save-note" class="save-note" role="status">${storageOkay?'Saved automatically in this browser.':'Browser storage is unavailable. Export your review to keep it.'}</div>
 <div class="export-row"><button id="export-level">Export this level · JSON</button><button id="export-all">Export full audit · JSON</button><button id="export-csv">Export level summary · CSV</button><button id="import-review">Import reviews</button><input class="hide" type="file" id="import-file" accept=".json,application/json"></div>
 <div class="callout" style="margin-top:24px"><strong>Review portability.</strong> Flags and notes are tied to this GitHub commit and this browser. Export the full audit to back them up or move them to another device. Import accepts reviews for the same source snapshot.</div>`;
}
function methodView(){
 return `<div class="eyebrow">Verified against real project data</div><div class="method"><h3>What was executed</h3><p>All ${data.checks.levels} authored levels were staged with Standard and Classic food density: ${data.checks.stages} stage checks. The auditor measured initial inventories and six-color coverage, checked tunnel pairs, and placed ${data.checks.powerPlacementAttempts} required power offers using the real scheduler without awarding quest credit. All ${data.checks.refillChecks} depleted-food checks restored six colors.</p>
 <h3>Completion-rule validation</h3><p>${data.checks.completionAssertions} assertions used the actual <span class="mono">storyOutcome</span> predicate. Complete metric fixtures were accepted; fixtures missing each individual objective were rejected. These are rule checks, not simulated winning runs.</p>
 <h3>What “available” means</h3><ul><li>Food inventory is the actual staged count. Refill targets preserve each sticker-color budget throughout the run.</li><li>Special powers are recurring offers with one active slot. Offers advance on successful placement, including missed pickups, and skip fulfilled goals.</li><li>Element quantity, distinct pickups and mastery are separate metrics. Mastery requires each element’s action.</li><li>Tunnels include open pairs and reserved future pairs. Boosts, jumps, abilities, bomb disarms and combat require player actions.</li><li>Small-board 60% food limits apply to staged density. They are not lifetime pickup caps; specials do not enter food inventory.</li></ul>
 <h3>How flags are calculated</h3><p>“Impossible” identifies a mapped supply contradiction: a required power is absent, required variety exceeds supplied types, food exceeds a finite allowance, tunnel targets exceed staged pairs, or turns have no schedule. “Under-supplied” identifies a time-budget concern under the displayed assumptions. Local what-if flags never change the baseline findings.</p>
 <h3>Limits of the first version</h3><p>No full path search, manual playthrough, GPU check or per-character ability simulation is included. Dynamic crowding can delay placement. Hazard holds, travel, combat, tunnel clearance and player skill can consume the remaining clock. Runtime supply tests use the initial layout and a fixed random seed. A supply pass supports a playtest; it does not prove every combined objective is achievable.</p>
 <h3>Source provenance</h3><p><a href="https://github.com/${data.repository}/commit/${data.commit}" target="_blank" rel="noopener">${data.repository} · main · ${data.commit.slice(0,8)} ↗</a><br>GitHub commit: ${new Date(data.commitDate).toLocaleString()}<br>Audit generated: ${new Date(data.auditedAt).toLocaleString()}<br>Owner-only hosting. The auditor does not send flags to GitHub or alter game files.</p></div>`;
}
function bindSandbox(){
 const update=()=>{
  const number=(id,fallback)=>{const input=document.getElementById(id),v=Number(input.value);return input.value!==''&&Number.isFinite(v)?Math.max(Number(input.min),Math.min(Number(input.max),v)):fallback;};
  scenario={initialOrbs:number('scenario-orbs',record().stages[filters.character].initialOrbs),limit:number('scenario-limit',record().config.limit),missedCycles:number('scenario-misses',2),totalCap:number('scenario-cap',null),recurring:document.getElementById('scenario-refill').checked,disabledPowers:[...document.querySelectorAll('[data-power]')].filter(e=>!e.checked).map(e=>e.dataset.power)};
  const a=assess(record(),filters.character,scenario);
  document.getElementById('scenario-results').innerHTML=badge(a.status)+' <span class="muted">Scenario only</span>'+ (a.findings.length?'<ul>'+a.findings.map(f=>'<li>'+esc(f.message)+'</li>').join('')+'</ul>':'<div style="margin-top:8px">No mapped supply contradiction under these assumptions. Full gameplay feasibility is still unverified.</div>')+(a.powerPool.length?'<div class="muted mono small" style="margin-top:8px">'+a.powerBudget+'s power budget / '+a.limit+'s limit / '+a.headroom+'s headroom</div>':'');
 };
 for(const e of document.querySelectorAll('.sandbox input'))e.addEventListener('input',update);
 document.getElementById('scenario-reset').onclick=()=>{scenario={};renderDetail();document.getElementById('sandbox').open=true;};
 update();
}
function saveReviews(){
 try{localStorage.setItem(storageKey,JSON.stringify(reviews));storageOkay=true;}catch{storageOkay=false;}
 renderList();const label=document.getElementById('save-note');if(label)label.textContent=storageOkay?'Saved in this browser · '+new Date().toLocaleTimeString():'Storage unavailable. Export to keep your review.';
 const metric=document.querySelector('.metrics .metric:last-child .number');if(metric){metric.textContent=summary().flagged;metric.classList.toggle('orange',summary().flagged>0);}
}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function report(records){return {schemaVersion:1,repository:data.repository,commit:data.commit,exportedAt:new Date().toISOString(),character:filters.character,checks:data.checks,reviews,levels:records.map(r=>({level:r.config.id,config:r.config,audit:assess(r,filters.character),review:reviews[r.config.id]??null,source:r.source})),scenario:{level:selected,assumptions:scenario,result:assess(record(),filters.character,scenario)}};}
function bindReview(r){
 const save=()=>{reviews[r.config.id]={flag:document.getElementById('review-flag').value,state:document.getElementById('review-state').value,notes:document.getElementById('review-notes').value,updatedAt:new Date().toISOString()};saveReviews();};
 for(const id of ['review-flag','review-state','review-notes'])document.getElementById(id).addEventListener('input',save);
 document.getElementById('export-level').onclick=()=>download('worm-level-'+r.config.id+'-'+data.commit.slice(0,8)+'.json',JSON.stringify(report([r]),null,2),'application/json');
 document.getElementById('export-all').onclick=()=>download('worm-audit-'+data.commit.slice(0,8)+'.json',JSON.stringify(report(data.records),null,2),'application/json');
 document.getElementById('export-csv').onclick=()=>{
  const quote=v=>{let text=String(v??'');if(/^[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
  const csv=[['Level','Title','Board','Status','Initial food','Element types','Power cycle','Time limit','Power budget','Flag','Review state','Notes','Commit'],...data.records.map(r=>{const a=assess(r,filters.character),rev=reviews[r.config.id]??{};return [r.config.id,r.config.title,r.config.cubeSize+'x'+r.config.cubeSize,statusText[a.status],a.initial,a.distinct.length,a.powerPool.join(' > '),a.limit,a.powerBudget,rev.flag,rev.state,rev.notes,data.commit];})].map(row=>row.map(quote).join(',')).join('\r\n');
  download('worm-audit-'+data.commit.slice(0,8)+'.csv',csv,'text/csv;charset=utf-8');
 };
 document.getElementById('import-review').onclick=()=>document.getElementById('import-file').click();
 document.getElementById('import-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
   const incoming=JSON.parse(await file.text());
   if(incoming.commit!==data.commit)throw Error('Source commit differs. Reviews were not imported.');
   if(!incoming.reviews||typeof incoming.reviews!=='object'||Array.isArray(incoming.reviews))throw Error('This file has no valid review records.');
   for(const [id,n] of Object.entries(incoming.reviews)){
    if(!data.records.some(r=>r.config.id===+id)||!n||typeof n!=='object')continue;
    reviews[id]={flag:['','impossible','undersupplied','playtest','verified'].includes(n.flag)?n.flag:'',state:['unreviewed','inprogress','done'].includes(n.state)?n.state:'unreviewed',notes:typeof n.notes==='string'?n.notes:'',updatedAt:new Date().toISOString()};
   }
   saveReviews();renderDetail();toast('Reviews imported for this source snapshot.');
  }catch(error){toast(error.message);}
 };
}
function toast(message){document.querySelector('.toast')?.remove();const e=document.createElement('div');e.className='toast';e.role='status';e.textContent=message;document.body.append(e);setTimeout(()=>e.remove(),5000);}
window.addEventListener('hashchange',()=>{const match=location.hash.match(/^#level-(\d+)$/);if(match&&data.records.some(r=>r.config.id===+match[1])){selected=+match[1];scenario={};renderList();renderDetail();}});
render();
