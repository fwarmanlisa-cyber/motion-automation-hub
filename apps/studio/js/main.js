import { buildScene } from '/packages/motion-engine/index.js';
const $=id=>document.getElementById(id);
const controls=['play','pause','restart','seek'];
let apiReady=false;
const presets={
  'slide-up':{from:{opacity:0,y:80},to:{opacity:1,y:0}},
  'slide-left':{from:{opacity:0,x:-150},to:{opacity:1,x:0}},
  'fade-in':{from:{opacity:0},to:{opacity:1}},
  'fade-out':{from:{opacity:1},to:{opacity:0}}
};
let timeline,project,revision,savedJSON,dirty=false,formDirty=false,busy=false,selectedElement=0,selectedAnimation=-1;
function resize(){if(project) $('stage').style.transform=`scale(${$('viewport').clientWidth/project.width})`;}
function update(){if(!timeline)return;const t=timeline.time();$('seek').value=t;$('time').textContent=`${t.toFixed(2)} / ${project.duration.toFixed(2)}`;}
function setBusy(value){busy=value;$('editor').disabled=value || !project || !apiReady;$('reload').disabled=value;}
function state(){ $('save-state').textContent=dirty || formDirty?'تغییرات ذخیره نشده‌اند':'همهٔ تغییرات ذخیره شده‌اند'; }
function render(time=0){
  timeline?.kill();
  timeline=buildScene($('stage'),project,window.gsap);
  timeline.eventCallback('onUpdate',update);
  timeline.pause().seek(Math.min(time,project.duration));
  $('project-title').textContent=project.title;$('seek').max=project.duration;
  $('elements').replaceChildren(...project.elements.map(e=>{const li=document.createElement('li');li.textContent=e.content || e.id;return li;}));
  controls.forEach(id=>$(id).disabled=false);resize();update();
}
function options(select,items){select.replaceChildren(...items.map(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;}));}
function animationFields(){
  const animation=project.animations[selectedAnimation];
  for(const id of ['animation-at','animation-duration','animation-ease','animation-preset']) $(id).disabled=!animation;
  const same=(a,b)=>Object.keys(a).length===Object.keys(b).length && Object.keys(a).every(key=>a[key]===b[key]);
  $('animation-preset').value=animation ? Object.entries(presets).find(([,preset])=>same(animation.from,preset.from) && same(animation.to,preset.to))?.[0] || 'custom' : 'custom';
  $('animation-at').value=animation?.at ?? '';$('animation-duration').value=animation?.duration ?? '';$('animation-ease').value=animation?.ease ?? 'none';
}
function elementFields(){
  const element=project.elements[selectedElement];
  for(const id of ['element-content','element-color','element-x','element-y']) $(id).disabled=!element;
  $('element-content').disabled=!element || element.type!=='text';
  $('element-content').value=element?.content ?? '';$('element-color').value=element?.color ?? '#ffffff';
  $('element-x').value=element?.x ?? '';$('element-y').value=element?.y ?? '';
  $('project-background').value=project.background;
  const animations=project.animations.map((a,index)=>[index,a]).filter(([,a])=>a.target===element?.id);
  options($('animation-select'),animations.length?animations.map(([i,a])=>[i,`حرکت ${i+1} · ${a.at} تا ${+(a.at+a.duration).toFixed(2)}`]):[['-1','بدون حرکت']]);
  $('animation-select').disabled=!animations.length;
  selectedAnimation=animations[0]?.[0] ?? -1;animationFields();
}
function editor(){
  selectedElement=Math.min(selectedElement,Math.max(0,project.elements.length-1));
  options($('element-select'),project.elements.map((e,i)=>[i,e.id]));
  $('element-select').disabled=!project.elements.length;
  $('element-select').value=selectedElement;elementFields();
}
function numeric(id){
  const value=$(id).valueAsNumber;
  if(!Number.isFinite(value)) throw new Error('مقادیر عددی را کامل و صحیح وارد کنید.');
  return value;
}
async function responseJSON(response){
  let data;
  try{data=await response.json();}catch{throw new Error(`پاسخ نامعتبر سرور (HTTP ${response.status}). سرور قبلی را متوقف و npm start را دوباره اجرا کنید.`);}
  if(!response.ok){
    if(response.status===409) throw new Error('فایل پروژه تغییر کرده است. ابتدا تغییرات خود را یادداشت کنید، سپس بارگذاری مجدد را بزنید.');
    const details=data.details || data.errors;
    throw new Error(`HTTP ${response.status}: ${details?.map(e=>`${e.instancePath || ''} ${e.message}`).join('؛ ') || data.error || 'خطای درخواست'}`);
  }
  return data;
}
async function applyEdits(){
  const candidate=structuredClone(project);
  const element=candidate.elements[selectedElement];
  if(element){
    if(element.type==='text')element.content=$('element-content').value;
    element.color=$('element-color').value;element.x=numeric('element-x');element.y=numeric('element-y');
  }
  candidate.background=$('project-background').value;
  const animation=candidate.animations[selectedAnimation];
  if(animation){
    animation.at=numeric('animation-at');animation.duration=numeric('animation-duration');animation.ease=$('animation-ease').value;
    const preset=presets[$('animation-preset').value];
    if(preset){animation.from=structuredClone(preset.from);animation.to=structuredClone(preset.to);}
  }
  if(JSON.stringify(candidate)===JSON.stringify(project)){formDirty=false;state();return;}
  await responseJSON(await fetch('/api/project/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(candidate)}));
  const time=timeline?.time() || 0;
  project=candidate;dirty=JSON.stringify(project)!==savedJSON;formDirty=false;render(time);
  // Retain the selected animation while refreshing its timing label.
  const index=selectedAnimation;elementFields();
  if(index>=0){selectedAnimation=index;$('animation-select').value=index;animationFields();}
  state();$('status').textContent='تغییرات در پیش‌نمایش اعمال شدند؛ برای نگهداری، ذخیره کنید.';
}
function previewSelection(){
  const animation=project.animations[selectedAnimation];
  timeline.restart().pause().seek(animation?.at ?? 0).play();
  $('status').textContent=`پیش‌نمایش حرکت از ثانیهٔ ${(animation?.at ?? 0).toFixed(2)} در حال پخش است؛ ذخیره جداگانه انجام می‌شود.`;
}
async function checkServer(){
  apiReady=false;
  try{
    const response=await fetch('/api/status',{cache:'no-store'});
    if(!response.ok)throw new Error();
    const info=await response.json();
    if(info.protocol!=='project-editor/2' || !revision)throw new Error();
    apiReady=true;$('server-state').textContent=`سرور ویرایشگر ${info.version} متصل است`;
  }catch{
    $('server-state').textContent='سرور فعلی با ویرایشگر سازگار نیست؛ آن را با Ctrl+C متوقف کنید، npm start را اجرا و صفحه را تازه کنید.';
  }
}
async function loadProject(){
  if(busy)return;
  if((dirty || formDirty) && !confirm('تغییرات ذخیره‌نشده کنار گذاشته شوند؟'))return;
  setBusy(true);controls.forEach(id=>$(id).disabled=true);
  try {
    const response=await fetch('/projects/demo.json',{cache:'no-store'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const candidate=await response.json();
    revision=response.headers.get('ETag')?.replaceAll('"','');
    project=candidate;savedJSON=JSON.stringify(project);dirty=false;formDirty=false;
    render();editor();state();await checkServer();$('status').textContent='پروژه از JSON بارگذاری شد — آمادهٔ پخش';
  }catch(error){
    $('status').textContent='خطا در بارگذاری پروژه: '+error.message;
    // Preserve the current preview and draft if a reload fails.
    controls.forEach(id=>$(id).disabled=!timeline);
  }finally{setBusy(false);}
}
$('apply').onclick=async()=>{
  if(busy)return;setBusy(true);
  try{await applyEdits();previewSelection();}catch(error){$('status').textContent='تغییرات اعمال نشدند: '+error.message;}finally{setBusy(false);}
};
$('save').onclick=async()=>{
  if(busy)return;setBusy(true);
  try{
    await applyEdits();
    if(!dirty){state();$('status').textContent='تغییر جدیدی برای ذخیره وجود ندارد؛ فایل پروژه به‌روز است.';return;}
    const result=await responseJSON(await fetch('/api/project',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({project,revision})}));
    revision=result.revision;savedJSON=JSON.stringify(project);dirty=false;state();
    $('status').textContent='پروژه ذخیره شد؛ نسخهٔ پشتیبان فایل قبلی ایجاد شد.';
  }catch(error){$('status').textContent='ذخیره انجام نشد: '+error.message;}finally{setBusy(false);}
};
for(const eventName of ['input','change']) $('editor').addEventListener(eventName,event=>{
  if(event.target.matches('input,textarea,#animation-ease,#animation-preset')){formDirty=true;state();}
});
$('element-select').onchange=()=>{
  if(formDirty && !confirm('ویرایش‌های اعمال‌نشدهٔ فرم کنار گذاشته شوند؟')){$('element-select').value=selectedElement;return;}
  formDirty=false;selectedElement=Number($('element-select').value);elementFields();state();
};
$('animation-select').onchange=()=>{
  if(formDirty && !confirm('ابتدا ویرایش‌ها را اعمال کنید؛ کنار گذاشته شوند؟')){$('animation-select').value=selectedAnimation;return;}
  // Reset the entire form to avoid leaving discarded element edits visible.
  const index=Number($('animation-select').value);formDirty=false;elementFields();selectedAnimation=index;$('animation-select').value=index;animationFields();state();
};
$('play').onclick=()=>timeline?.play();$('pause').onclick=()=>timeline?.pause();$('restart').onclick=()=>timeline?.restart();
$('seek').oninput=()=>{timeline?.pause().seek(Number($('seek').value));update();};
$('reload').onclick=loadProject;
window.addEventListener('beforeunload',event=>{if(dirty || formDirty){event.preventDefault();event.returnValue='';}});
new ResizeObserver(resize).observe($('viewport'));
window.studio={get timeline(){return timeline;},get project(){return project;},get dirty(){return dirty || formDirty;}};
loadProject();
