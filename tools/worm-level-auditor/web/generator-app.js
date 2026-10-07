import {generateCampaign,generateLevel,DEFAULT_SETTINGS,SUPPORTED_SIZES,normalizeSettings,levelGoal,integrationModule} from './generator.js';
import {assess} from './audit.js';
const app=document.getElementById('generator-app');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nice=s=>s.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
let data,pack,worker,jobId=0,busy=false,progress=0,results=[],selected=41,message='',storageOkay=true;
let search='',questFilter='',statusFilter='';
try{data=await fetch('./data.json').then(r=>{if(!r.ok)throw Error('Source snapshot unavailable');return r.json();});}
catch(error){app.innerHTML='<div class="loading">Generator unavailable<span>'+esc(error.message)+'. Reload to retry.</span></div>';throw error;}
const templates=data.records.filter(r=>r.config.id<=40).map(r=>r.world),storageKey='worm-generator-v1:'+(data.snapshotId??data.commit);
function validPack(p){
 if(p?.generatorVersion!==1||!Array.isArray(p.levels)||!Array.isArray(p.chapters))throw Error('This is not a compatible generator pack.');
 normalizeSettings(p.settings);
 if(p.levels.length!==p.settings.total-40||p.levels.some((l,i)=>l?.config?.id!==41+i))throw Error('Draft IDs must run consecutively from 41 to the campaign total.');
 if(p.chapters.length!==Math.ceil(p.settings.total/10)-4||p.chapters.some((c,i)=>c.id!==i+5||typeof c.title!=='string'))throw Error('Chapter metadata does not cover this campaign.');
 return p;
}
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved?.sourceCommit===data.commit)pack=validPack(saved.pack);}catch{storageOkay=false;}
if(!pack)pack=generateCampaign(DEFAULT_SETTINGS,templates);
const candidate=()=>pack.levels.find(l=>l.config.id===selected)??pack.levels[0];
const resultFor=id=>results.find(r=>r.id===id);
const exportReady=()=>!busy&&results.length===pack.levels.length&&results.every(r=>r.status==='checked');
const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify({sourceCommit:data.commit,pack}));storageOkay=true;}catch{storageOkay=false;}};
function render(){
 const good=results.filter(r=>r.status==='checked').length,issues=results.filter(r=>r.status!=='checked').length;
 app.innerHTML=`<header class="topbar"><div class="brand"><a href="index.html"><img src="icon.svg" alt="WORM home"></a><strong>WORM<sup>3</sup></strong><span class="divider"></span><small>Level Generator</small></div><div class="toplinks"><a href="index.html">← Level auditor</a><span class="private">LOCAL · LOOPBACK ONLY</span></div></header>
 <section class="hero generator-hero"><div><div class="eyebrow">Campaign workshop / Levels 41 onward</div><h1>A hundred levels. A repeatable plan.</h1><p>Generate chapters, world settings and quests. Check real supply. Refine before release.</p></div><div class="hero-action"><button id="export-js" class="primary" ${exportReady()?'':'disabled'}>Export integration module ↓</button></div></section>
 <div class="metrics"><div class="metric"><div class="number">40</div><div class="label">Authored levels preserved</div></div><div class="metric"><div class="number">${pack.levels.length}</div><div class="label">Generated draft levels</div></div><div class="metric"><div class="number ${issues?'orange':'green'}" id="validated-number">${good}<span>/ ${pack.levels.length}</span></div><div class="label">Drafts passing supply checks</div></div><div class="metric"><div class="number">${pack.settings.total}</div><div class="label">Combined campaign length</div></div></div>
 <main class="generator-workspace"><aside class="generator-controls"><h2>Generation recipe</h2><div class="generation-fields">
 <div class="field"><label for="gen-total">Total campaign levels</label><input id="gen-total" type="number" min="41" max="1000" step="1" value="${pack.settings.total}"></div><div class="field"><label for="gen-pace">Pacing</label><select id="gen-pace">${options([['relaxed','Relaxed'],['standard','Standard'],['intense','Intense']],pack.settings.pace)}</select></div>
 <div class="field wide-field"><label for="gen-seed">Repeatable seed</label><input id="gen-seed" maxlength="120" value="${esc(pack.settings.seed)}"></div>
 <div class="field wide-field"><label for="gen-profile">Quest mix</label><select id="gen-profile">${options([['balanced','Balanced campaign'],['pickups','Orb & power emphasis'],['traversal','Traversal & healing emphasis']],pack.settings.profile)}</select></div>
 <div class="field wide-field"><label>Allowed board sizes</label><div class="size-options">${SUPPORTED_SIZES.map(n=>'<label><input type="checkbox" data-size="'+n+'" '+(pack.settings.sizes.includes(n)?'checked':'')+'>'+n+'</label>').join('')}</div></div></div>
 <label class="checkrow"><input id="gen-combat" type="checkbox" ${pack.settings.combat?'checked':''}>Include combat and bomb quests</label><label class="checkrow"><input id="gen-mastery" type="checkbox" ${pack.settings.mastery?'checked':''}>Include elemental mastery finales</label>
 <button id="generate" class="primary generate-button" ${busy?'disabled':''}>Generate & audit campaign</button><div class="generator-actions"><button id="export-pack">Export draft pack · JSON</button><button id="import-pack">Import draft pack</button><input id="pack-file" class="hide" type="file" accept=".json,application/json"></div><p id="generator-message" class="generator-message" role="status">${esc(message)}</p>
 <p class="control-note">Levels 1–40 remain unchanged. Difficulty grows by chapter and then stabilizes. Unsupported small-board quests fall back to food collection. Tile style stays consistent within each level.</p>
 <p class="control-note">${storageOkay?'Drafts save in this browser; export to keep a copy.':'Browser storage is unavailable. Export your draft pack to preserve it.'}<br>Same seed + same settings = same campaign.</p></aside>
 <div class="generated-main"><section class="batch-card"><div class="batch-header"><div><h2>Generated campaign draft</h2><small>LEVELS 41–${pack.settings.total} / ${pack.chapters.length} NEW CHAPTERS / SEED ${esc(pack.settings.seed)}</small></div><span class="badge draft-label">DRAFT · PLAYTEST REQUIRED</span></div><div class="batch-status" id="batch-status" role="status" aria-live="polite"></div><div class="progress-line"><div id="progress-bar"></div></div>
 <div class="batch-filters"><label class="sr-only" for="draft-search">Search generated levels</label><input id="draft-search" type="search" placeholder="Search draft title, element, or quest…" value="${esc(search)}"><label class="sr-only" for="draft-quest">Quest filter</label><select id="draft-quest">${options([['','All quest types'],['elemental','Elemental'],['explode','Explode'],['tunnel','Tunnels'],['combat','Combat']],questFilter)}</select><label class="sr-only" for="draft-status">Audit status</label><select id="draft-status">${options([['','All statuses'],['checked','Supply checked'],['review','Review needed'],['invalid','Invalid']],statusFilter)}</select></div>
 <div class="batch-table-scroll"><table class="questtable batch-table"><thead><tr><th>ID</th><th>Level / chapter</th><th>Board</th><th>Required powers</th><th>Supply</th><th>Limit</th></tr></thead><tbody id="draft-list"></tbody></table></div><div class="batch-footer"><p class="batch-count" id="batch-count"></p></div></section>
 <article class="draft-detail" id="draft-detail" aria-label="Generated level inspector"></article>
 <details class="disclosure integration-guide"><summary>How the export fits WORM³</summary><div class="sandbox"><p>The integration module exports three matching collections:</p><ul><li><span class="mono">WORM_GENERATED_LEVELS</span> — append to the authored level array in levels.js.</li><li><span class="mono">WORM_GENERATED_WORLDS</span> — merge into STORY_WORLDS in worlds.js.</li><li><span class="mono">WORM_GENERATED_CHAPTERS</span> — append chapter metadata before mapping levels into chapters.</li></ul><p>The current game must import all three for the new levels to stage and appear on the chapter map. Review chapter navigation, unlocks, end-of-campaign behavior and performance during integration. This tool exports files only; repository changes require your approval.</p><p class="mono">Source: ${data.repository} / ${data.commit.slice(0,8)}</p></div></details></div></main>
 <footer class="footer"><div>${data.repository} · ${data.commit.slice(0,8)} · SOURCE-BACKED GENERATION</div><div>Supply checks use the real runtime. Generated levels are drafts until playtested.</div></footer>`;
 bindControls();renderList();renderDetail();updateProgress();
}
function options(values,selected){return values.map(([v,t])=>'<option value="'+v+'"'+(v===selected?' selected':'')+'>'+t+'</option>').join('');}
function bindControls(){
 document.getElementById('generate').onclick=()=>{
  try{
   const settings={total:Number(document.getElementById('gen-total').value),seed:document.getElementById('gen-seed').value,pace:document.getElementById('gen-pace').value,profile:document.getElementById('gen-profile').value,sizes:[...document.querySelectorAll('[data-size]')].filter(e=>e.checked).map(e=>+e.dataset.size),combat:document.getElementById('gen-combat').checked,mastery:document.getElementById('gen-mastery').checked};
   pack=generateCampaign(settings,templates);selected=41;search='';questFilter='';statusFilter='';message='';save();runValidation();
  }catch(error){message=error.message;document.getElementById('generator-message').textContent=message;}
 };
 document.getElementById('draft-search').oninput=e=>{search=e.target.value;renderList();};
 document.getElementById('draft-quest').onchange=e=>{questFilter=e.target.value;renderList();};
 document.getElementById('draft-status').onchange=e=>{statusFilter=e.target.value;renderList();};
 document.getElementById('export-js').onclick=()=>{if(exportReady())download('worm-levels-41-'+pack.settings.total+'.js',integrationModule(pack,data.commit),'text/javascript');};
 document.getElementById('export-pack').onclick=()=>download('worm-campaign-41-'+pack.settings.total+'.json',JSON.stringify({schemaVersion:1,sourceCommit:data.commit,repository:data.repository,exportedAt:new Date().toISOString(),pack,validation:{complete:!busy,passed:results.filter(r=>r.status==='checked').length,total:pack.levels.length,playthroughsVerified:false}},null,2),'application/json');
 document.getElementById('import-pack').onclick=()=>document.getElementById('pack-file').click();
 document.getElementById('pack-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
   if(file.size>6000000)throw Error('Use a draft pack smaller than 6 MB.');
   const incoming=JSON.parse(await file.text());
   if(incoming.sourceCommit!==data.commit)throw Error('The imported source commit differs; refresh and review that snapshot first.');
   pack=validPack(incoming.pack);selected=41;message='Draft pack imported. Rechecking supply against this source.';save();runValidation();
  }catch(error){message=error.message;document.getElementById('generator-message').textContent=message;}
 };
}
function filtered(){
 return pack.levels.filter(c=>{
  const l=c.config,m=l.mechanics??{},text=[l.id,l.title,l.kind,l.goal].join(' ').toLowerCase(),r=resultFor(l.id);
  return (!search||text.includes(search.toLowerCase()))&&(!statusFilter||r?.status===statusFilter)&&(!questFilter||(questFilter==='elemental'&&(m.elementPickups||m.uniqueElements||m.elements))||(questFilter==='explode'&&m.explodes)||(questFilter==='tunnel'&&['tunnel','collector','restore'].includes(l.kind))||(questFilter==='combat'&&(m.kills||m.bombs)));
 });
}
function renderList(){
 const visible=filtered();
 document.getElementById('draft-list').innerHTML=visible.length?visible.map(c=>{
  const l=c.config,r=resultFor(l.id),powers=r?.record?.stages.glow.powerCycle??[],chapter=pack.chapters.find(c=>c.id===Math.ceil(l.id/10));
  return '<tr tabindex="0" role="button" aria-label="Inspect level '+l.id+'" data-draft="'+l.id+'" class="'+(selected===l.id?'selected':'')+'"><td class="number">'+l.id+'</td><td>'+esc(l.title)+'<span class="explain">'+esc(chapter?.title??'Chapter '+Math.ceil(l.id/10))+'</span></td><td>'+l.cubeSize+'×'+l.cubeSize+'</td><td>'+esc(powers.join(' · ')||(r?'None required':'Checking…'))+'</td><td>'+resultBadge(r)+'</td><td class="mono">'+l.limit+'s</td></tr>';
 }).join(''):'<tr><td colspan="6" class="empty">No generated levels match these filters.</td></tr>';
 document.getElementById('batch-count').textContent=visible.length+' / '+pack.levels.length+' generated drafts shown';
 for(const row of document.querySelectorAll('[data-draft]')){
  const choose=()=>{selected=+row.dataset.draft;renderList();renderDetail();};
  row.onclick=choose;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};
 }
}
function resultBadge(r){const state=r?.status??'pending',text={checked:'Supply checked',review:'Review needed',invalid:'Invalid',pending:'Checking'}[state];return '<span class="badge '+(state==='invalid'?'impossible':state==='pending'?'playtest':state)+'">'+text+'</span>';}
function renderDetail(){
 const c=candidate(),l=c.config,r=resultFor(l.id),a=r?.record?assess(r.record):null;
 const chapter=pack.chapters.find(c=>c.id===Math.ceil(l.id/10));
 document.getElementById('draft-detail').innerHTML=`<div class="section-title"><div><div class="eyebrow">Draft ${l.id} / ${esc(chapter?.title??'')} / ${l.cubeSize} × ${l.cubeSize}</div><h2>${esc(l.title)}</h2></div><div class="detail-actions">${resultBadge(r)}<button id="reroll-level" ${busy?'disabled':''}>Reroll this level</button></div></div><p class="goal">${esc(l.goal)}</p>
 ${r?.errors.length?'<ul class="error-list">'+r.errors.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':''}
 ${a?'<div class="tablewrap draft-audit"><table class="questtable"><thead><tr><th>Objective</th><th>Required</th><th>Available</th><th>Result</th></tr></thead><tbody>'+a.rows.map(o=>'<tr><td>'+esc(o.label)+'<span class="explain">'+esc(o.detail)+'</span></td><td>'+o.target+'</td><td>'+esc(o.available)+'</td><td><span class="badge '+o.state+'">'+(o.state==='playtest'?'Gameplay check':o.state==='checked'?'Supply checked':nice(o.state))+'</span></td></tr>').join('')+'</tbody></table></div><p class="info-line">'+a.initial+' Standard food orbs / '+r.record.stages.classic.initialOrbs+' Classic food orbs / '+a.powerPool.length+' required power types<br>'+a.powerBudget+'s conservative power budget / '+a.headroom+'s remaining before routing, combat & tunnel travel</p>':'<p class="reviewintro">Runtime checks are pending, or this draft needs correction before it can be staged.</p>'}
 ${r?.findings?.length?'<ul class="error-list">'+r.findings.map(f=>'<li>'+esc(f.message)+'</li>').join('')+'</ul>':''}
 <section class="draft-edit-section"><h3>Refine this draft</h3><div class="draft-controls"><div class="field title-field"><label for="edit-title">Level title</label><input id="edit-title" maxlength="120" value="${esc(l.title)}" ${busy?'disabled':''}></div>
 ${editField('cubeSize','Board size',l.cubeSize)}${editField('target','Primary target',l.target)}${editField('orbs','Food quota',l.orbs??'')}${editField('limit','Time limit (s)',l.limit)}${editField('par','Par time (s)',l.par)}${editField('speed','Worm speed',l.speed,'0.01')}${editField('rotateEvery','Rotation interval (s)',l.rotateEvery??'')}
 <div class="field"><label for="edit-route">Food route</label><select id="edit-route" ${busy?'disabled':''}>${options(['corners','gates','steps','diagonals','diamonds','channels','lanes','branches','bastions','orbit'].map(r=>[r,r]),c.world.route)}</select></div></div>
 ${Object.keys(l.mechanics??{}).length?'<div class="draft-mechanics">'+Object.entries(l.mechanics).map(([key,n])=>editField('mechanic-'+key,nice(key),n)).join('')+'</div>':''}
 <div class="export-row"><button id="save-level" class="primary" ${busy?'disabled':''}>Save changes & re-audit</button></div><p id="edit-message" class="generator-message" role="status"></p></section>
 <details class="disclosure"><summary>Complete level & world configuration</summary><div class="sandbox"><p>Edit both definitions for more control. The ID remains fixed and the quest description is rebuilt from objective targets on save.</p><label class="sr-only" for="draft-json">Level and world JSON</label><textarea id="draft-json" class="code-editor" spellcheck="false" ${busy?'disabled':''}>${esc(JSON.stringify({config:l,world:c.world},null,2))}</textarea><div class="export-row"><button id="save-json" ${busy?'disabled':''}>Apply JSON & re-audit</button></div></div></details>
 <p class="scope-note">Generated draft, not an authored GitHub level. Supply checks run the current staging, refill, power scheduler and completion modules in a separate worker. Full combined-objective playthroughs remain to be tested.</p>`;
 // Assign editor text as a value to preserve exact JSON across DOM implementations.
 document.getElementById('draft-json').value=JSON.stringify({config:l,world:c.world},null,2);
 bindEditor(c);
}
function editField(key,label,value,step='1'){return '<div class="field"><label for="edit-'+key+'">'+label+'</label><input id="edit-'+key+'" data-edit="'+key+'" type="number" min="0" step="'+step+'" value="'+value+'" '+(busy?'disabled':'')+'></div>';}
function bindEditor(c){
 const apply=next=>{
  if(next.config.id!==c.config.id)throw Error('Keep this draft’s assigned level ID.');
  next.config.goal=levelGoal(next.config);
  pack.levels[pack.levels.findIndex(l=>l.config.id===c.config.id)]={...c,...next};message='Level '+c.config.id+' updated. Checking the campaign again.';save();runValidation();
 };
 document.getElementById('reroll-level').onclick=()=>{const next=generateLevel(c.config.id,pack.settings,templates,(c.generation?.revision??0)+1);apply(next);};
 document.getElementById('save-level').onclick=()=>{
  try{
   const next=JSON.parse(JSON.stringify(c));next.config.title=document.getElementById('edit-title').value;next.world.name=next.config.title;
   for(const input of document.querySelectorAll('[data-edit]')){
    const key=input.dataset.edit;
    if(key.startsWith('mechanic-'))next.config.mechanics[key.slice(9)]=Number(input.value);
    else if(input.value==='')delete next.config[key];
    else next.config[key]=Number(input.value);
   }
   next.world.route=document.getElementById('edit-route').value;apply(next);
  }catch(error){document.getElementById('edit-message').textContent=error.message;}
 };
 document.getElementById('save-json').onclick=()=>{try{const next=JSON.parse(document.getElementById('draft-json').value);if(!next.config||!next.world)throw Error('Include config and world objects.');apply(next);}catch(error){document.getElementById('edit-message').textContent=error.message;}};
}
function updateProgress(){
 const status=document.getElementById('batch-status'),issues=results.filter(r=>r.status!=='checked').length;
 status.classList.toggle('failed',!busy&&issues>0);
 status.textContent=busy?'Checking '+progress+' / '+pack.levels.length+' draft levels with real project modules…':results.length===pack.levels.length?(issues?issues+' draft levels need attention. Integration export is blocked until all supply checks pass.':'All '+pack.levels.length+' generated drafts passed staging, refill, required power cycles and completion-rule checks in both food densities. Playthroughs are still required.'):'Validation unavailable. '+message;
 document.getElementById('progress-bar').style.width=(busy?progress/pack.levels.length*100:results.length===pack.levels.length?100:0)+'%';
}
function runValidation(){
 worker?.terminate();const currentJob=++jobId;busy=true;progress=0;results=[];render();
 try{
  worker=new Worker('./generator-worker.js');
  worker.onmessage=({data:reply})=>{
   if(reply.jobId!==currentJob)return;
   if(reply.progress!==undefined){progress=reply.progress;updateProgress();return;}
   busy=false;
   if(reply.error){message=reply.error;results=[];}
   else{results=reply.results;message='';}
   worker.terminate();worker=null;render();
  };
  worker.onerror=()=>{if(currentJob!==jobId)return;busy=false;message='The audit worker could not run. Reload to retry; you can still export drafts.';results=[];worker?.terminate();worker=null;render();};
  worker.postMessage({jobId:currentJob,levels:pack.levels});
 }catch(error){busy=false;message='Runtime validation is unavailable: '+error.message;render();}
}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
window.addEventListener('pagehide',()=>worker?.terminate());
save();runValidation();
