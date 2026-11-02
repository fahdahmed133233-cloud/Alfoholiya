'use strict';

const STORAGE_KEY = 'alfaholya_app_v1';
const numbers = new Intl.NumberFormat('ar-EG');

const presetExercises = [
  {id:'squat',name:'القرفصاء',icon:'↕️',mode:'reps',description:'سجّل التكرارات يدويًا أو بصوتك.'},
  {id:'pushup',name:'ضغط الحائط',icon:'🧱',mode:'reps',description:'سجّل كل تكرار بإيقاعك.'},
  {id:'jumping-jack',name:'فتح وضم الذراعين',icon:'✳️',mode:'reps',description:'تابع عدد التكرارات.'},
  {id:'lunge',name:'اندفاع أمامي',icon:'🦵',mode:'reps',description:'سجّل نشاطك بالطريقة المناسبة.'},
  {id:'plank',name:'الثبات',icon:'⏱️',mode:'timer',description:'استخدم المؤقّت وسجّل المدة.'},
  {id:'stretch',name:'تمدد واسترخاء',icon:'🌿',mode:'timer',description:'وقت هادئ للتمدد والراحة.'}
];

function freshData(){
  return {version:1,profile:{name:'',photo:''},customExercises:[],sessions:[]};
}

function validExercise(x){
  return !!x && typeof x.id==='string' && typeof x.name==='string' &&
    ['reps','timer'].includes(x.mode) && x.custom===true;
}

function validSession(x){
  return !!x && typeof x.exerciseName==='string' &&
    typeof x.date==='string' && !Number.isNaN(Date.parse(x.date)) &&
    ['reps','timer'].includes(x.mode) &&
    Number.isFinite(x.durationSeconds) && Number.isFinite(x.reps) &&
    x.durationSeconds>=0 && x.reps>=0;
}

function loadData(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return freshData();
    const x=JSON.parse(raw);
    return {
      version:1,
      profile:{
        name:typeof x.profile?.name==='string'?x.profile.name.slice(0,28):'',
        photo:typeof x.profile?.photo==='string'?x.profile.photo:''
      },
      customExercises:Array.isArray(x.customExercises)?x.customExercises.filter(validExercise).slice(0,50):[],
      sessions:Array.isArray(x.sessions)?x.sessions.filter(validSession).slice(-1000):[]
    };
  }catch(e){console.warn('تعذر تحميل البيانات',e);return freshData();}
}

let data=loadData();
let setupPhoto='';
let editPhoto='';
let currentExercise=null;
let reps=0;
let sessionStarted=0;
let timerStart=30;
let timerLeft=30;
let timerHandle=null;
let voice=null;
let listening=false;
let toastHandle=null;

function saveData(){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
    return true;
  }catch(e){
    console.error(e);
    toast('تعذر الحفظ. جرّب صورة أصغر أو نزّل نسخة احتياطية.');
    return false;
  }
}

function el(id){return document.getElementById(id);}
function fmt(n){return numbers.format(Math.max(0,Math.round(Number(n)||0)));}
function clock(s){
  s=Math.max(0,Math.floor(s));
  return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
}
function toast(message){
  const box=el('toast');
  if(!box)return;
  box.textContent=message;
  box.classList.add('show');
  clearTimeout(toastHandle);
  toastHandle=setTimeout(()=>box.classList.remove('show'),2800);
}
function allExercises(){return presetExercises.concat(data.customExercises);}
function exerciseById(id){return allExercises().find(x=>x.id===id);}
function dayKey(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function dateText(value,withTime){
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return 'تاريخ غير معروف';
  return new Intl.DateTimeFormat('ar-EG',withTime?
    {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}:
    {day:'numeric',month:'long',year:'numeric'}).format(d);
}
function avatar(node,photo,name){
  node.replaceChildren();
  if(photo){
    const img=document.createElement('img');
    img.src=photo;img.alt='';node.append(img);
  }else{
    const span=document.createElement('span');
    span.textContent=(name||'ف').trim().charAt(0)||'ف';node.append(span);
  }
}

function renderProfile(){
  const name=data.profile.name||'صديقنا';
  el('welcomeTitle').replaceChildren(document.createTextNode('مرحبًا، '));
  const span=document.createElement('span');
  span.className='gradient-text';span.textContent=name;el('welcomeTitle').append(span);
  if(data.profile.photo){
    el('heroPhoto').src=data.profile.photo;
    el('welcomeHero').classList.add('has-photo');
  }else{
    el('heroPhoto').removeAttribute('src');
    el('welcomeHero').classList.remove('has-photo');
  }
  avatar(el('topProfileButton'),data.profile.photo,name);
  avatar(el('profileLargeAvatar'),data.profile.photo,name);
  el('profileDisplayName').textContent=name;
  el('editName').value=data.profile.name;
}

function makeExerciseCard(x){
  const card=document.createElement('article');
  card.className='exercise-card';
  const top=document.createElement('div');top.className='exercise-card-top';
  const icon=document.createElement('span');icon.className='exercise-symbol';icon.textContent=x.icon||'✳️';
  const mode=document.createElement('span');mode.className='mode-pill';mode.textContent=x.mode==='timer'?'مؤقّت':'تكرارات';
  top.append(icon,mode);
  const title=document.createElement('h3');title.textContent=x.name;
  const desc=document.createElement('p');desc.textContent=x.description||'ابدأ نشاطك وسجّل تقدمك.';
  const actions=document.createElement('div');actions.className='exercise-card-actions';
  const start=document.createElement('button');start.type='button';start.className='primary-button';start.textContent='ابدأ التمرين ←';start.dataset.startExercise=x.id;actions.append(start);
  if(x.custom){
    const del=document.createElement('button');del.type='button';del.className='custom-delete';del.textContent='×';del.title='حذف التمرين';del.dataset.deleteExercise=x.id;actions.append(del);
  }
  card.append(top,title,desc,actions);
  return card;
}

function renderExercises(){
  const grid=el('exerciseGrid');grid.replaceChildren();
  allExercises().forEach(x=>grid.append(makeExerciseCard(x)));
  const quick=el('quickExercises');quick.replaceChildren();
  presetExercises.slice(0,3).forEach(x=>{
    const b=document.createElement('button');b.type='button';b.className='quick-exercise';b.dataset.startExercise=x.id;
    const icon=document.createElement('span');icon.className='exercise-symbol';icon.textContent=x.icon;
    const title=document.createElement('strong');title.textContent=x.name;
    const small=document.createElement('small');small.textContent='ابدأ الآن';
    b.append(icon,title,small);quick.append(b);
  });
}

function totals(){
  return data.sessions.reduce((a,s)=>{
    a.sessions++;a.seconds+=s.durationSeconds||0;a.reps+=s.reps||0;return a;
  },{sessions:0,seconds:0,reps:0});
}
function sessionValue(s){
  return s.mode==='timer'?'مدة '+clock(s.durationSeconds):fmt(s.reps)+' تكرار';
}
function findExerciseIcon(name){
  return allExercises().find(x=>x.name===name)?.icon||'✳️';
}
function emptyState(message){
  const x=document.createElement('div');x.className='empty-state';x.textContent=message;return x;
}
function activityRow(s,history){
  const row=document.createElement('div');row.className=history?'history-row':'recent-row';
  const icon=document.createElement('span');icon.className=history?'history-icon':'recent-icon';icon.textContent=findExerciseIcon(s.exerciseName);
  const meta=document.createElement('div');meta.className=history?'history-meta':'recent-meta';
  const title=document.createElement('strong');title.textContent=s.exerciseName;
  const date=document.createElement('small');date.textContent=dateText(s.date,true);meta.append(title,date);
  const value=document.createElement(history?'div':'span');value.className=history?'history-value':'recent-value';value.textContent=sessionValue(s);
  if(history){const min=document.createElement('small');min.textContent=fmt(Math.round(s.durationSeconds/60))+' دقيقة تقريبًا';value.append(min);}
  row.append(icon,meta,value);return row;
}
function renderActivities(){
  const sorted=data.sessions.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
  const recent=el('recentActivity');recent.replaceChildren();
  if(!sorted.length)recent.append(emptyState('لسه مفيش جلسات مسجلة. أول خطوة ليك هتظهر هنا ✦'));
  else sorted.slice(0,4).forEach(s=>recent.append(activityRow(s,false)));
  const history=el('activityHistory');history.replaceChildren();
  if(!sorted.length)history.append(emptyState('سجل النشاط لسه فاضي. سجّل أول جلسة ليك هنا.'));
  else sorted.slice(0,30).forEach(s=>history.append(activityRow(s,true)));
}
function renderChart(){
  const box=el('weeklyChart');box.replaceChildren();
  const today=new Date(),days=[];
  for(let i=6;i>=0;i--){
    const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()-i);
    const key=dayKey(d);
    const seconds=data.sessions.filter(s=>dayKey(new Date(s.date))===key)
      .reduce((sum,s)=>sum+s.durationSeconds,0);
    days.push({date:d,seconds});
  }
  const max=Math.max(10,...days.map(x=>x.seconds/60));
  days.forEach(x=>{
    const col=document.createElement('div');col.className='chart-column';
    const wrap=document.createElement('div');wrap.className='chart-bar-wrap';
    const bar=document.createElement('div');bar.className='chart-bar';
    bar.style.height=(x.seconds?Math.max(5,(x.seconds/60/max)*100):2)+'%';
    bar.title=fmt(Math.round(x.seconds/60))+' دقيقة';wrap.append(bar);
    const label=document.createElement('span');label.className='chart-day';
    label.textContent=new Intl.DateTimeFormat('ar-EG',{weekday:'short'}).format(x.date);
    col.append(wrap,label);box.append(col);
  });
}
function renderProgress(){
  const t=totals();
  el('statSessions').textContent=fmt(t.sessions);
  el('statMinutes').textContent=fmt(Math.floor(t.seconds/60));
  el('statReps').textContent=fmt(t.reps);
  el('totalSessions').textContent=fmt(t.sessions);
  el('totalMinutes').textContent=fmt(Math.floor(t.seconds/60));
  el('totalReps').textContent=fmt(t.reps);
  el('levelSessions').textContent=fmt(t.sessions);
  let level='بداية هادئة',desc='كل تجربة جديدة بتضيف لخبرتك.';
  if(t.sessions>=10){level='صاحب عادة';desc='جميل إنك بتسجل خطواتك باستمرار. حافظ على التوازن والراحة.';}
  else if(t.sessions>=5){level='مواظب';desc='بدأت تبني روتينك الخاص، كمل بإيقاع مريح.';}
  else if(t.sessions>=1){level='مستكشف';desc='أنت بدأت تجرب وتسجل نشاطك. كل خطوة ليها قيمتها.';}
  el('levelName').textContent=level;el('levelDescription').textContent=desc;
  renderChart();renderActivities();
}
function renderAll(){
  renderProfile();renderExercises();renderProgress();
  el('todayLabel').textContent=new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
}

function showView(name){
  const ids={home:'homeView',workouts:'workoutsView',progress:'progressView',profile:'profileView'};
  if(!ids[name])return;
  Object.keys(ids).forEach(k=>el(ids[k]).classList.toggle('active-view',k===name));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===name));
  window.scrollTo({top:0,behavior:'smooth'});
}
function enterApp(){
  el('setupScreen').classList.add('hidden');
  el('app').classList.remove('hidden');
  renderAll();showView('home');
}
function openModal(id){
  const m=el(id);m.classList.add('open');m.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}
function stopTimer(){
  if(timerHandle!==null)clearInterval(timerHandle);
  timerHandle=null;
}
function stopVoice(){
  const old=voice;voice=null;listening=false;
  if(old){try{old.stop();}catch(e){}}
  setVoiceButton(false);
}
function closeModal(id){
  const m=el(id);if(!m)return;
  m.classList.remove('open');m.setAttribute('aria-hidden','true');
  if(id==='sessionModal'){stopTimer();stopVoice();currentExercise=null;}
  if(!document.querySelector('.modal-backdrop.open'))document.body.style.overflow='';
}

async function resizeImage(file){
  if(!file||!file.type.startsWith('image/'))throw new Error('اختار ملف صورة صالح.');
  if(file.size>12*1024*1024)throw new Error('حجم الصورة كبير. اختار صورة أقل من ١٢ ميجابايت.');
  const dataUrl=await new Promise((resolve,reject)=>{
    const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('تعذرت قراءة الصورة.'));r.readAsDataURL(file);
  });
  const img=await new Promise((resolve,reject)=>{
    const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('الصورة غير قابلة للفتح.'));i.src=dataUrl;
  });
  const ratio=Math.min(1,900/Math.max(img.width,img.height));
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*ratio));c.height=Math.max(1,Math.round(img.height*ratio));
  const ctx=c.getContext('2d');if(!ctx)throw new Error('تعذر تجهيز الصورة.');
  ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',0.78);
}
function previewSetupPhoto(photo){
  const p=el('setupPhotoPreview');p.replaceChildren();
  if(photo){const img=document.createElement('img');img.src=photo;img.alt='معاينة الصورة';p.append(img);}
  else{const s=document.createElement('span');s.className='photo-placeholder';s.textContent='＋';p.append(s);}
}
async function photoChanged(input,which){
  const f=input.files?.[0];if(!f)return;
  try{
    const photo=await resizeImage(f);
    if(which==='setup'){setupPhoto=photo;previewSetupPhoto(photo);}
    else{editPhoto=photo;toast('الصورة جاهزة. اضغط حفظ التعديلات.');}
  }catch(e){toast(e.message||'تعذر تحميل الصورة.');}
  finally{input.value='';}
}

function updateRep(){
  el('repCount').textContent=fmt(reps);
  el('decreaseRep').disabled=reps<=0;
  el('decreaseRep').style.opacity=reps<=0?'.4':'1';
}
function updateClock(){el('timerDisplay').textContent=clock(timerLeft);}
function startExercise(id){
  const x=exerciseById(id);if(!x)return;
  stopTimer();stopVoice();
  currentExercise=x;reps=0;sessionStarted=Date.now();
  timerStart=30;timerLeft=30;
  el('sessionTitle').textContent=x.name;
  el('sessionSubtitle').textContent=x.mode==='timer'?'اختار مدة مناسبة لك، وتقدر توقف في أي وقت.':'كل ما تسجل تكرار، العداد هيحدّث الرقم.';
  el('sessionIcon').textContent=x.icon||'✳️';
  el('repPanel').classList.toggle('hidden',x.mode!=='reps');
  el('timerPanel').classList.toggle('hidden',x.mode!=='timer');
  el('voiceStatus').textContent='اضغط وابدأ قول: واحد، اتنين، تلاتة…';
  el('timerStatus').textContent='تقدر توقف أو تنهي في أي وقت.';
  el('timerStartButton').disabled=false;el('timerStartButton').textContent='ابدأ المؤقّت';
  updateRep();updateClock();openModal('sessionModal');
}
function startPauseTimer(){
  if(timerLeft<=0)return;
  const button=el('timerStartButton');
  if(timerHandle!==null){
    stopTimer();button.textContent='استكمال المؤقّت';el('timerStatus').textContent='المؤقّت متوقف مؤقتًا.';return;
  }
  button.textContent='إيقاف مؤقت';el('timerStatus').textContent='المؤقّت شغّال. خليك على راحتك.';
  timerHandle=setInterval(()=>{
    timerLeft=Math.max(0,timerLeft-1);updateClock();
    if(timerLeft===0){
      stopTimer();button.textContent='انتهى الوقت';button.disabled=true;
      el('timerStatus').textContent='انتهى الوقت اللي اخترته. أحسنت، وخد راحتك.';
      toast('انتهى المؤقّت ✦');
    }
  },1000);
}
function resetTimer(){
  stopTimer();timerLeft=timerStart;
  el('timerStartButton').disabled=false;el('timerStartButton').textContent='ابدأ المؤقّت';
  el('timerStatus').textContent='تقدر توقف أو تنهي في أي وقت.';updateClock();
}

function transcriptCount(text){
  const cleaned=text.toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/[،,؛;.!؟?]/g,' ');
  const words=cleaned.match(/[0-9٠-٩]+|[\u0621-\u064A]+/g)||[];
  const accepted=new Set(['واحد','واحده','وحده','احد','اول','اتنين','اثنين','تنين','اثنان','تلاته','ثلاثه','ثلاث','تلات','اربعه','اربع','خمسه','خمس','سته','ست','سبعه','سبع','تمانيه','ثمانيه','ثمان','تماني','تسعه','تسع','عشره','عشر']);
  return words.filter(w=>/^[0-9٠-٩]+$/.test(w)||accepted.has(w)).length;
}
function setVoiceButton(active){
  const b=el('voiceButton');if(!b)return;
  b.classList.toggle('listening',active);
  b.innerHTML=active?'<span>●</span> إيقاف الميكروفون':'<span>🎙</span> العد بالصوت';
}
function toggleVoice(){
  if(listening){stopVoice();el('voiceStatus').textContent='الميكروفون متوقف.';return;}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){el('voiceStatus').textContent='ميزة الصوت غير مدعومة. استخدم زر +.';toast('جرّب Chrome أو Edge للعد بالصوت.');return;}
  try{
    const active=new SR();voice=active;active.lang='ar-EG';active.continuous=true;active.interimResults=false;active.maxAlternatives=1;
    active.onstart=()=>{listening=true;setVoiceButton(true);el('voiceStatus').textContent='سامعك… قول كل رقم بوضوح.';};
    active.onresult=e=>{
      let count=0;
      for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)count+=transcriptCount(e.results[i][0].transcript||'');
      if(count){reps+=count;updateRep();el('voiceStatus').textContent='تم تسجيل '+fmt(count)+' تكرار بالصوت.';}
    };
    active.onerror=e=>{
      const messages={'not-allowed':'اسمح للمتصفح باستخدام الميكروفون.','no-speech':'ما وصلناش صوت واضح. جرّب تاني.','audio-capture':'مش قادر أوصل للميكروفون.'};
      el('voiceStatus').textContent=messages[e.error]||'حصلت مشكلة في التعرف على الصوت.';
    };
    active.onend=()=>{if(voice===active){voice=null;listening=false;setVoiceButton(false);}};
    active.start();
  }catch(e){voice=null;listening=false;setVoiceButton(false);el('voiceStatus').textContent='تعذر تشغيل الميكروفون. استخدم العد اليدوي.';}
}

function finishSession(){
  if(!currentExercise)return;
  stopTimer();stopVoice();
  const duration=currentExercise.mode==='timer'?Math.max(0,timerStart-timerLeft):Math.max(0,Math.floor((Date.now()-sessionStarted)/1000));
  if(currentExercise.mode==='reps'&&reps===0){toast('سجّل تكرار واحد على الأقل قبل الحفظ.');return;}
  if(currentExercise.mode==='timer'&&duration===0){toast('ابدأ المؤقّت الأول عشان نسجل الوقت.');return;}
  const s={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),exerciseName:currentExercise.name,mode:currentExercise.mode,reps:currentExercise.mode==='reps'?reps:0,durationSeconds:duration,date:new Date().toISOString()};
  data.sessions.push(s);
  if(!saveData()){data.sessions.pop();return;}
  closeModal('sessionModal');renderAll();toast('اتسجلت جلستك بنجاح. أحسنت! ✦');
}

function addCustomExercise(name,mode){
  name=name.trim();if(!name)return;
  if(allExercises().some(x=>x.name.toLowerCase()===name.toLowerCase())){toast('الاسم ده موجود بالفعل.');return;}
  const x={id:'custom-'+Date.now(),name,mode,icon:mode==='timer'?'⏱️':'✳️',description:mode==='timer'?'تمرين مخصص باستخدام المؤقّت.':'تمرين مخصص لعدّ التكرارات.',custom:true};
  data.customExercises.push(x);
  if(!saveData()){data.customExercises.pop();return;}
  renderExercises();toast('اتضاف التمرين لمساحتك.');
}
function deleteCustomExercise(id){
  const x=data.customExercises.find(a=>a.id===id);if(!x)return;
  if(!confirm('تحذف تمرين «'+x.name+'»؟ الجلسات القديمة هتفضل في السجل.'))return;
  const old=data.customExercises.slice();
  data.customExercises=data.customExercises.filter(a=>a.id!==id);
  if(!saveData()){data.customExercises=old;return;}
  renderExercises();toast('تم حذف التمرين.');
}

function exportBackup(){
  const blob=new Blob([JSON.stringify({product:'الفحولية',backupVersion:1,exportedAt:new Date().toISOString(),data},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='alfaholya-backup-'+dayKey(new Date())+'.json';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);toast('اتجهزت النسخة الاحتياطية.');
}
async function importBackup(file){
  if(!file)return;
  try{
    const parsed=JSON.parse(await file.text());const incoming=parsed.data||parsed;
    if(!incoming.profile||!Array.isArray(incoming.sessions)||!Array.isArray(incoming.customExercises))throw new Error('ملف النسخة الاحتياطية غير صالح.');
    if(!confirm('استعادة النسخة هتستبدل البيانات الحالية. نكمل؟'))return;
    const restored={version:1,profile:{name:String(incoming.profile.name||'').slice(0,28),photo:typeof incoming.profile.photo==='string'?incoming.profile.photo:''},customExercises:incoming.customExercises.filter(validExercise).slice(0,50),sessions:incoming.sessions.filter(validSession).slice(-1000)};
    if(!restored.profile.name)throw new Error('النسخة لا تحتوي على اسم صالح.');
    const old=data;data=restored;
    if(!saveData()){data=old;return;}
    editPhoto='';renderAll();toast('تم استعادة بياناتك بنجاح.');
  }catch(e){toast(e.message||'تعذر استعادة النسخة الاحتياطية.');}
}

function bindEvents(){
  el('setupPhotoInput').addEventListener('change',e=>photoChanged(e.target,'setup'));
  el('setupForm').addEventListener('submit',e=>{
    e.preventDefault();const name=el('setupName').value.trim();if(!name){toast('اكتب اسمك الأول.');return;}
    const old=data.profile;data.profile={name,photo:setupPhoto};
    if(saveData())enterApp();else data.profile=old;
  });
  el('editPhotoInput').addEventListener('change',e=>photoChanged(e.target,'edit'));
  el('editProfileForm').addEventListener('submit',e=>{
    e.preventDefault();const name=el('editName').value.trim();if(!name){toast('الاسم مينفعش يكون فاضي.');return;}
    const old={...data.profile};data.profile.name=name;if(editPhoto)data.profile.photo=editPhoto;
    if(saveData()){editPhoto='';renderAll();toast('اتحفظت تعديلات ملفك الشخصي.');}else data.profile=old;
  });

  el('topProfileButton').addEventListener('click',()=>showView('profile'));
  document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.nav)));
  el('exerciseGrid').addEventListener('click',e=>{
    const start=e.target.closest('[data-start-exercise]'),del=e.target.closest('[data-delete-exercise]');
    if(start)startExercise(start.dataset.startExercise);
    if(del)deleteCustomExercise(del.dataset.deleteExercise);
  });
  el('quickExercises').addEventListener('click',e=>{
    const b=e.target.closest('[data-start-exercise]');if(b)startExercise(b.dataset.startExercise);
  });

  el('addExerciseButton').addEventListener('click',()=>openModal('addExerciseModal'));
  el('addExerciseForm').addEventListener('submit',e=>{
    e.preventDefault();addCustomExercise(el('newExerciseName').value,el('newExerciseMode').value);
    el('newExerciseName').value='';closeModal('addExerciseModal');
  });
  el('increaseRep').addEventListener('click',()=>{reps++;updateRep();});
  el('decreaseRep').addEventListener('click',()=>{reps=Math.max(0,reps-1);updateRep();});
  el('voiceButton').addEventListener('click',toggleVoice);
  el('finishSessionButton').addEventListener('click',finishSession);
  el('timerStartButton').addEventListener('click',startPauseTimer);
  el('timerResetButton').addEventListener('click',resetTimer);
  document.querySelectorAll('[data-seconds]').forEach(b=>b.addEventListener('click',()=>{
    if(timerHandle!==null)return;timerStart=Number(b.dataset.seconds);timerLeft=timerStart;
    document.querySelectorAll('[data-seconds]').forEach(x=>x.classList.toggle('selected',x===b));
    el('timerStartButton').disabled=false;el('timerStartButton').textContent='ابدأ المؤقّت';
    el('timerStatus').textContent='تقدر توقف أو تنهي في أي وقت.';updateClock();
  }));

  document.querySelectorAll('[data-close-modal]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.closeModal)));
  document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id);}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-backdrop.open').forEach(m=>closeModal(m.id));});

  el('exportButton').addEventListener('click',exportBackup);
  el('importInput').addEventListener('change',async e=>{await importBackup(e.target.files?.[0]);e.target.value='';});
  el('resetButton').addEventListener('click',()=>{
    if(!confirm('ده هيمسح الملف الشخصي والصورة والتمارين وسجل النشاط من المتصفح ده. متأكد؟'))return;
    stopTimer();stopVoice();localStorage.removeItem(STORAGE_KEY);data=freshData();setupPhoto='';editPhoto='';
    el('app').classList.add('hidden');el('setupScreen').classList.remove('hidden');el('setupName').value='';previewSetupPhoto('');
  });
}

function init(){
  bindEvents();
  if(data.profile.name)enterApp();
  else{el('setupScreen').classList.remove('hidden');el('app').classList.add('hidden');}
  if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
    navigator.serviceWorker.register('./sw.js').catch(e=>console.info('Service Worker unavailable:',e));
  }
}

document.addEventListener('DOMContentLoaded',init);
