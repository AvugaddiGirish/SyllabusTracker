const API='/api';
let currentSubject='all',currentTagFilter='',allTopics=[],allSubjects=[],allTags=[],expandedCards=new Set();

document.addEventListener('DOMContentLoaded',async()=>{
// Check auth
const me=await api('GET','/auth/me');
if(me){showApp(me)}else{showAuth()}
});

async function api(method,path,body){
const opts={method,headers:{'Content-Type':'application/json'},credentials:'same-origin'};
if(body)opts.body=JSON.stringify(body);
try{const r=await fetch(API+path,opts);if(!r.ok){const e=await r.json().catch(()=>({}));throw e}return r.json()}catch(e){throw e}}

// ── AUTH ──
function showAuth(){
document.getElementById('auth-overlay').classList.remove('hidden');
document.getElementById('app-shell').classList.add('hidden');
setupAuthEvents();
}
function showApp(user){
document.getElementById('auth-overlay').classList.add('hidden');
document.getElementById('app-shell').classList.remove('hidden');
document.getElementById('user-name').textContent=user.username;
document.getElementById('user-avatar').textContent=user.username[0].toUpperCase();
initApp();
}
function setupAuthEvents(){
document.querySelectorAll('.auth-tab').forEach(t=>t.addEventListener('click',()=>{
document.querySelectorAll('.auth-tab').forEach(x=>x.classList.remove('active'));
t.classList.add('active');
document.getElementById('login-form').classList.toggle('hidden',t.dataset.tab!=='login');
document.getElementById('register-form').classList.toggle('hidden',t.dataset.tab!=='register');
}));
document.getElementById('login-form').addEventListener('submit',async e=>{
e.preventDefault();
const err=document.getElementById('login-error');err.textContent='';
try{const u=await api('POST','/auth/login',{email:document.getElementById('login-email').value,password:document.getElementById('login-password').value});showApp(u)}catch(ex){err.textContent=ex.error||'Login failed'}
});
document.getElementById('register-form').addEventListener('submit',async e=>{
e.preventDefault();
const err=document.getElementById('register-error');err.textContent='';
try{const u=await api('POST','/auth/register',{username:document.getElementById('register-username').value,email:document.getElementById('register-email').value,password:document.getElementById('register-password').value});showApp(u)}catch(ex){err.textContent=ex.error||'Registration failed'}
});
}
// ── INIT APP ──
async function initApp(){
setupSidebar();setupAddTopic();setupModals();setupFilters();setupDarkMode();setupExport();setupTimer();
await Promise.all([loadSubjects(),loadTags()]);
await loadTopics();loadAnalytics();
}
// ── SIDEBAR ──
function setupSidebar(){
document.getElementById('hamburger-btn').addEventListener('click',()=>{document.getElementById('sidebar').classList.add('open');document.getElementById('sidebar-overlay').classList.remove('hidden')});
document.getElementById('sidebar-close-btn').addEventListener('click',closeSidebar);
document.getElementById('sidebar-overlay').addEventListener('click',closeSidebar);
document.getElementById('logout-btn').addEventListener('click',async()=>{await api('POST','/auth/logout');location.reload()});
document.getElementById('add-subject-btn').addEventListener('click',()=>document.getElementById('subject-modal').classList.remove('hidden'));
document.getElementById('add-tag-btn').addEventListener('click',()=>document.getElementById('tag-modal').classList.remove('hidden'));
}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebar-overlay').classList.add('hidden')}
// ── SUBJECTS ──
async function loadSubjects(){
allSubjects=await api('GET','/subjects');
renderSubjects();populateSubjectDropdowns();
}
function renderSubjects(){
const list=document.getElementById('subjects-list');
const oldAll=list.querySelector('[data-subject="all"]');
const newAll=oldAll.cloneNode(true);
list.innerHTML='';list.appendChild(newAll);
if(currentSubject==='all')newAll.classList.add('active');else newAll.classList.remove('active');
allSubjects.forEach(s=>{
const li=document.createElement('li');li.className='nav-item'+(currentSubject==s.id?' active':'');li.dataset.subject=s.id;
li.innerHTML=`<span class="nav-dot" style="background:${s.color}"></span><span class="nav-label">${esc(s.name)}</span><span class="nav-count">${s.topic_count}</span><button class="nav-delete" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
li.querySelector('.nav-label').addEventListener('click',()=>{currentSubject=s.id;document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));li.classList.add('active');loadTopics();closeSidebar()});
li.querySelector('.nav-delete').addEventListener('click',async e=>{e.stopPropagation();if(confirm('Delete subject "'+s.name+'"?')){await api('DELETE','/subjects/'+s.id);await loadSubjects();await loadTopics()}});
list.appendChild(li);
});
newAll.querySelector('.nav-count').textContent=allTopics.length||'0';
newAll.addEventListener('click',()=>{currentSubject='all';document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));newAll.classList.add('active');loadTopics();closeSidebar()});
}
function populateSubjectDropdowns(){
const opts='<option value="">No Subject</option>'+allSubjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
document.getElementById('topic-subject-select').innerHTML=opts;
document.getElementById('edit-topic-subject').innerHTML=opts;
}
// ── TAGS ──
async function loadTags(){
allTags=await api('GET','/tags');
renderTags();populateTagChips();updateFilterTagDropdown();
}
function renderTags(){
const list=document.getElementById('tags-list');list.innerHTML='';
allTags.forEach(t=>{
const li=document.createElement('li');li.className='nav-item';li.dataset.tag=t.id;
li.innerHTML=`<span class="nav-dot" style="background:${t.color}"></span><span class="nav-label">${esc(t.name)}</span><button class="nav-delete" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
li.querySelector('.nav-label').addEventListener('click',()=>{currentTagFilter=currentTagFilter==t.id?'':t.id;document.querySelectorAll('#tags-list .nav-item').forEach(x=>x.classList.remove('active'));if(currentTagFilter)li.classList.add('active');document.getElementById('filter-tag').value=currentTagFilter;loadTopics();closeSidebar()});
li.querySelector('.nav-delete').addEventListener('click',async e=>{e.stopPropagation();if(confirm('Delete tag "'+t.name+'"?')){await api('DELETE','/tags/'+t.id);await loadTags();await loadTopics()}});
list.appendChild(li);
});
}
function populateTagChips(){
['tag-chips-select','edit-tag-chips-select'].forEach(id=>{
const el=document.getElementById(id);el.innerHTML='';
allTags.forEach(t=>{
const chip=document.createElement('span');chip.className='tag-chip';chip.dataset.tagId=t.id;
chip.style.background=t.color+'22';chip.style.color=t.color;chip.textContent=t.name;
chip.addEventListener('click',()=>chip.classList.toggle('selected'));
el.appendChild(chip);
});
});
}
function updateFilterTagDropdown(){
const sel=document.getElementById('filter-tag');
sel.innerHTML='<option value="">All Tags</option>'+allTags.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
}
function getSelectedTagIds(containerId){return[...document.querySelectorAll('#'+containerId+' .tag-chip.selected')].map(c=>parseInt(c.dataset.tagId))}
// ── TOPICS ──
async function loadTopics(){
let path='/topics?';
if(currentSubject!=='all')path+=`subject_id=${currentSubject}&`;
const status=document.getElementById('filter-status').value;if(status)path+=`status=${encodeURIComponent(status)}&`;
const priority=document.getElementById('filter-priority').value;if(priority)path+=`priority=${priority}&`;
const tag=document.getElementById('filter-tag').value||currentTagFilter;if(tag)path+=`tag=${tag}&`;
const search=document.getElementById('search-input').value.trim();if(search)path+=`search=${encodeURIComponent(search)}&`;
allTopics=await api('GET',path);
renderTopics();populateTimerTopics();renderSubjects();
}
function renderTopics(){
const grid=document.getElementById('topics-grid');grid.innerHTML='';
if(allTopics.length===0){grid.innerHTML='<div class="empty-state"><h3>No Topics Yet</h3><p>Add a topic above to start tracking your syllabus.</p></div>';return}
allTopics.forEach((t,i)=>{
const card=document.createElement('div');card.className=`topic-card priority-${t.priority.toLowerCase()}`;card.dataset.id=t.id;card.draggable=true;card.style.animationDelay=`${i*0.04}s`;
let metaHtml='';
if(t.subject_name)metaHtml+=`<span class="card-subject" style="background:${t.subject_color||'#6366f1'}">${esc(t.subject_name)}</span>`;
if(t.deadline)metaHtml+=deadlineBadge(t.deadline);
if(t.tags)t.tags.forEach(tg=>{metaHtml+=`<span class="card-tag" style="background:${tg.color}22;color:${tg.color}">${esc(tg.name)}</span>`});
if(t.time_spent_seconds>0)metaHtml+=`<span class="card-time">⏱ ${fmtTime(t.time_spent_seconds)}</span>`;
const isExpanded=expandedCards.has(t.id);
card.innerHTML=`<div class="card-top"><span class="card-title">${esc(t.title)}</span><div class="card-actions"><select class="status-select" data-status="${t.status}"><option value="Not Started"${t.status==='Not Started'?' selected':''}>Not Started</option><option value="In Progress"${t.status==='In Progress'?' selected':''}>In Progress</option><option value="Mastered"${t.status==='Mastered'?' selected':''}>Mastered</option></select><button class="card-edit-btn" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="card-delete-btn" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div></div>${metaHtml?`<div class="card-meta">${metaHtml}</div>`:''}<button class="card-expand-toggle" data-expanded="${isExpanded}">${isExpanded?'▾ Hide details':'▸ Show details'}</button><div class="card-expand${isExpanded?'':' hidden'}">${t.description?`<div class="card-desc">${esc(t.description)}</div>`:''}${renderSubtasksHTML(t)}</div>`;
// Events
const sel=card.querySelector('.status-select');
sel.addEventListener('change',async()=>{sel.dataset.status=sel.value;await api('PUT','/topics/'+t.id,{status:sel.value});loadAnalytics();loadSubjects()});
card.querySelector('.card-delete-btn').addEventListener('click',async()=>{card.classList.add('fade-out');setTimeout(async()=>{await api('DELETE','/topics/'+t.id);await loadTopics();loadAnalytics();loadSubjects()},250)});
card.querySelector('.card-edit-btn').addEventListener('click',()=>openEditModal(t));
const toggle=card.querySelector('.card-expand-toggle');
toggle.addEventListener('click',()=>{const ex=card.querySelector('.card-expand');const open=toggle.dataset.expanded==='true';ex.classList.toggle('hidden',open);toggle.dataset.expanded=open?'false':'true';toggle.textContent=open?'▸ Show details':'▾ Hide details';if(!open)expandedCards.add(t.id);else expandedCards.delete(t.id)});
// Subtask events
setupSubtaskEvents(card,t);
// Drag
card.addEventListener('dragstart',e=>{card.classList.add('dragging');e.dataTransfer.setData('text/plain',t.id)});
card.addEventListener('dragend',()=>card.classList.remove('dragging'));
card.addEventListener('dragover',e=>{e.preventDefault();card.classList.add('drag-over')});
card.addEventListener('dragleave',()=>card.classList.remove('drag-over'));
card.addEventListener('drop',async e=>{e.preventDefault();card.classList.remove('drag-over');const dragId=parseInt(e.dataTransfer.getData('text/plain'));if(dragId===t.id)return;const order=allTopics.map(x=>x.id);const fromIdx=order.indexOf(dragId);const toIdx=order.indexOf(t.id);order.splice(fromIdx,1);order.splice(toIdx,0,dragId);await api('PUT','/topics/reorder',{order:order.map((id,i)=>({id,sort_order:i}))});await loadTopics()});
grid.appendChild(card);
});
}
function renderSubtasksHTML(t){
if(!t.subtasks||t.subtasks.length===0)return`<div class="card-subtasks" data-topic-id="${t.id}"><div class="subtask-add"><input type="text" placeholder="Add subtask..." class="subtask-add-input"><button class="subtask-add-btn">Add</button></div></div>`;
const done=t.subtasks.filter(s=>s.completed).length;const total=t.subtasks.length;
let html=`<div class="card-subtasks" data-topic-id="${t.id}"><div class="card-subtasks-header"><span>Subtasks (${done}/${total})</span></div><div class="subtask-progress"><div class="subtask-progress-fill" style="width:${total?Math.round(done/total*100):0}%"></div></div>`;
t.subtasks.forEach(s=>{html+=`<div class="subtask-item${s.completed?' done':''}" data-subtask-id="${s.id}"><input type="checkbox"${s.completed?' checked':''}><span>${esc(s.title)}</span><button class="subtask-delete">✕</button></div>`});
html+=`<div class="subtask-add"><input type="text" placeholder="Add subtask..." class="subtask-add-input"><button class="subtask-add-btn">Add</button></div></div>`;
return html;
}
function setupSubtaskEvents(card,topic){
card.querySelectorAll('.subtask-item input[type="checkbox"]').forEach(cb=>{
cb.addEventListener('change',async()=>{const sid=cb.closest('.subtask-item').dataset.subtaskId;await api('PUT','/subtasks/'+sid,{completed:cb.checked?1:0});await loadTopics()})
});
card.querySelectorAll('.subtask-delete').forEach(btn=>{
btn.addEventListener('click',async()=>{const sid=btn.closest('.subtask-item').dataset.subtaskId;await api('DELETE','/subtasks/'+sid);await loadTopics()})
});
const addBtn=card.querySelector('.subtask-add-btn');
if(addBtn)addBtn.addEventListener('click',async()=>{const inp=card.querySelector('.subtask-add-input');const title=inp.value.trim();if(!title)return;await api('POST','/topics/'+topic.id+'/subtasks',{title});await loadTopics()});
const addInp=card.querySelector('.subtask-add-input');
if(addInp)addInp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();card.querySelector('.subtask-add-btn').click()}});
}
// ── EDIT MODAL ──
function openEditModal(t){
document.getElementById('edit-topic-id').value=t.id;
document.getElementById('edit-topic-title').value=t.title;
document.getElementById('edit-topic-subject').value=t.subject_id||'';
document.getElementById('edit-topic-priority').value=t.priority;
document.getElementById('edit-topic-deadline').value=t.deadline||'';
document.getElementById('edit-topic-desc').value=t.description||'';
document.querySelectorAll('#edit-tag-chips-select .tag-chip').forEach(c=>{c.classList.toggle('selected',t.tags&&t.tags.some(tg=>tg.id==c.dataset.tagId))});
document.getElementById('edit-topic-modal').classList.remove('hidden');
}
// ── ADD TOPIC ──
function setupAddTopic(){
const toggleBtn=document.getElementById('add-toggle-btn');
const form=document.getElementById('add-topic-form');
const cancelBtn=document.getElementById('add-cancel-btn');
toggleBtn.addEventListener('click',()=>{form.classList.toggle('hidden');toggleBtn.classList.toggle('hidden')});
cancelBtn.addEventListener('click',()=>{form.classList.add('hidden');toggleBtn.classList.remove('hidden');form.reset()});
form.addEventListener('submit',async e=>{
e.preventDefault();
const title=document.getElementById('topic-title-input').value.trim();if(!title)return;
const body={title,subject_id:document.getElementById('topic-subject-select').value||null,priority:document.getElementById('topic-priority-select').value,deadline:document.getElementById('topic-deadline-input').value||null,description:document.getElementById('topic-desc-input').value,tag_ids:getSelectedTagIds('tag-chips-select')};
await api('POST','/topics',body);
form.reset();form.classList.add('hidden');toggleBtn.classList.remove('hidden');
document.querySelectorAll('#tag-chips-select .tag-chip').forEach(c=>c.classList.remove('selected'));
await loadTopics();loadAnalytics();loadSubjects();
});
}
// ── MODALS ──
function setupModals(){
document.querySelectorAll('.modal-cancel').forEach(btn=>btn.addEventListener('click',()=>document.getElementById(btn.dataset.modal).classList.add('hidden')));
document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.add('hidden')}));
document.getElementById('subject-form').addEventListener('submit',async e=>{
e.preventDefault();await api('POST','/subjects',{name:document.getElementById('subject-name-input').value,color:document.getElementById('subject-color-input').value});
document.getElementById('subject-modal').classList.add('hidden');e.target.reset();await loadSubjects();
});
document.getElementById('tag-form').addEventListener('submit',async e=>{
e.preventDefault();await api('POST','/tags',{name:document.getElementById('tag-name-input').value,color:document.getElementById('tag-color-input').value});
document.getElementById('tag-modal').classList.add('hidden');e.target.reset();await loadTags();
});
document.getElementById('edit-topic-form').addEventListener('submit',async e=>{
e.preventDefault();const id=document.getElementById('edit-topic-id').value;
await api('PUT','/topics/'+id,{title:document.getElementById('edit-topic-title').value,subject_id:document.getElementById('edit-topic-subject').value||null,priority:document.getElementById('edit-topic-priority').value,deadline:document.getElementById('edit-topic-deadline').value||null,description:document.getElementById('edit-topic-desc').value,tag_ids:getSelectedTagIds('edit-tag-chips-select')});
document.getElementById('edit-topic-modal').classList.add('hidden');await loadTopics();loadAnalytics();loadSubjects();
});
}
// ── FILTERS ──
function setupFilters(){
let debounce;
document.getElementById('search-input').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(loadTopics,300)});
document.getElementById('filter-status').addEventListener('change',loadTopics);
document.getElementById('filter-priority').addEventListener('change',loadTopics);
document.getElementById('filter-tag').addEventListener('change',()=>{currentTagFilter=document.getElementById('filter-tag').value;loadTopics()});
}
// ── ANALYTICS ──
async function loadAnalytics(){
try{
const[progress,streaks]=await Promise.all([api('GET','/analytics/progress'),api('GET','/analytics/streaks')]);
document.getElementById('stat-total').textContent=progress.total;
document.getElementById('stat-not-started').textContent=progress.not_started;
document.getElementById('stat-in-progress').textContent=progress.in_progress;
document.getElementById('stat-mastered').textContent=progress.mastered;
const pct=progress.total?Math.round(progress.mastered/progress.total*100):0;
document.getElementById('donut-percent').textContent=pct+'%';
const masteredArc=progress.total?progress.mastered/progress.total*100:0;
const progressArc=progress.total?progress.in_progress/progress.total*100:0;
document.getElementById('donut-mastered').setAttribute('stroke-dasharray',`${masteredArc} ${100-masteredArc}`);
document.getElementById('donut-progress').setAttribute('stroke-dasharray',`${progressArc} ${100-progressArc}`);
document.getElementById('donut-progress').setAttribute('stroke-dashoffset',`${25-masteredArc}`);
document.getElementById('streak-current').textContent=streaks.current_streak;
document.getElementById('streak-longest').textContent=streaks.longest_streak;
document.getElementById('streak-flame').style.opacity=streaks.current_streak>0?'1':'0.3';
const totalH=Math.floor(progress.total_study_time_seconds/3600);
const totalM=Math.floor((progress.total_study_time_seconds%3600)/60);
document.getElementById('timer-total-value').textContent=`${totalH}h ${totalM}m`;
}catch(e){console.error('Analytics error',e)}
}
// ── POMODORO TIMER ──
let timerInterval=null,timerSeconds=25*60,timerRunning=false,timerTotal=25*60;
function setupTimer(){
const startBtn=document.getElementById('timer-start-btn');
const resetBtn=document.getElementById('timer-reset-btn');
const mobileBtn=document.getElementById('mobile-timer-btn');
updateTimerDisplay();
startBtn.addEventListener('click',()=>{
if(timerRunning){clearInterval(timerInterval);timerRunning=false;startBtn.textContent='Resume';startBtn.classList.remove('running')}
else{timerRunning=true;startBtn.textContent='Pause';startBtn.classList.add('running');
timerInterval=setInterval(async()=>{
timerSeconds--;updateTimerDisplay();
if(timerSeconds<=0){clearInterval(timerInterval);timerRunning=false;startBtn.textContent='Start';startBtn.classList.remove('running');
try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=800;o.type='sine';g.gain.value=0.3;o.start();setTimeout(()=>{o.stop();ctx.close()},500)}catch(e){}
const topicId=document.getElementById('timer-topic-select').value;
await api('POST','/study-sessions',{topic_id:topicId||null,duration_seconds:timerTotal});
timerSeconds=timerTotal;updateTimerDisplay();loadAnalytics();loadTopics();
}
},1000)}
});
resetBtn.addEventListener('click',()=>{clearInterval(timerInterval);timerRunning=false;timerSeconds=timerTotal;startBtn.textContent='Start';startBtn.classList.remove('running');updateTimerDisplay()});
if(mobileBtn)mobileBtn.addEventListener('click',()=>{document.getElementById('dash-timer-card').scrollIntoView({behavior:'smooth'})});
}
function updateTimerDisplay(){
const m=Math.floor(timerSeconds/60).toString().padStart(2,'0');
const s=(timerSeconds%60).toString().padStart(2,'0');
document.getElementById('timer-text').textContent=m+':'+s;
const circ=326.73;const offset=circ*(1-timerSeconds/timerTotal);
document.getElementById('timer-ring-fg').style.strokeDashoffset=offset;
}
function populateTimerTopics(){
const sel=document.getElementById('timer-topic-select');
const val=sel.value;
sel.innerHTML='<option value="">No topic linked</option>'+allTopics.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('');
sel.value=val;
}
// ── DARK MODE ──
function setupDarkMode(){
const toggle=document.getElementById('dark-mode-toggle');
const saved=localStorage.getItem('theme');
if(saved)document.documentElement.setAttribute('data-theme',saved);
updateThemeLabel();
toggle.addEventListener('click',()=>{
const current=document.documentElement.getAttribute('data-theme');
const next=current==='dark'?'light':'dark';
document.documentElement.setAttribute('data-theme',next);
localStorage.setItem('theme',next);updateThemeLabel();
});
}
function updateThemeLabel(){
const isDark=document.documentElement.getAttribute('data-theme')==='dark';
document.getElementById('theme-label').textContent=isDark?'Light Mode':'Dark Mode';
document.getElementById('theme-icon').innerHTML=isDark?'<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>':'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
}
// ── EXPORT ──
function setupExport(){document.getElementById('export-csv-btn').addEventListener('click',()=>{window.location.href=API+'/export/csv'})}
// ── HELPERS ──
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function deadlineBadge(d){
const dl=new Date(d+'T00:00:00');const now=new Date();now.setHours(0,0,0,0);
const diff=Math.ceil((dl-now)/(1000*60*60*24));
if(diff<0)return`<span class="card-deadline overdue">Overdue ${-diff}d</span>`;
if(diff<=3)return`<span class="card-deadline soon">Due in ${diff}d</span>`;
return`<span class="card-deadline upcoming">${d}</span>`;
}
function fmtTime(s){const h=Math.floor(s/3600);const m=Math.floor((s%3600)/60);return h>0?`${h}h ${m}m`:`${m}m`}
