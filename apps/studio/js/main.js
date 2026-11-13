import { buildScene } from '/packages/motion-engine/index.js';
const $ = id=>document.getElementById(id);
let timeline,project;
const controls=['play','pause','restart','seek'];
function resize(){if(project) $('stage').style.transform=`scale(${$('viewport').clientWidth/project.width})`;}
function update(){if(!timeline)return; const t=timeline.time(); $('seek').value=t; $('time').textContent=`${t.toFixed(2)} / ${project.duration.toFixed(2)}`;}
async function loadProject(){
  $('reload').disabled=true;
  controls.forEach(id=>$(id).disabled=true);
  timeline?.kill(); timeline=null;
  $('stage').replaceChildren();
  try {
    const response=await fetch('/projects/demo.json',{cache:'no-store'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    project=await response.json();
    timeline=buildScene($('stage'),project,window.gsap);
    timeline.eventCallback('onUpdate',update);
    $('project-title').textContent=project.title;
    $('seek').max=project.duration;
    $('elements').replaceChildren(...project.elements.map(e=>{const li=document.createElement('li');li.textContent=e.content || e.id;return li;}));
    controls.forEach(id=>$(id).disabled=false);
    resize();update();$('status').textContent='پروژه از JSON بارگذاری شد — آمادهٔ پخش';
    window.studio={get timeline(){return timeline;},get project(){return project;}};
  } catch(error){$('status').textContent='خطا در بارگذاری پروژه: '+error.message;}
  finally{$('reload').disabled=false;}
}
$('play').onclick=()=>timeline?.play();
$('pause').onclick=()=>timeline?.pause();
$('restart').onclick=()=>timeline?.restart();
$('seek').oninput=()=>{timeline?.pause().seek(Number($('seek').value));update();};
$('reload').onclick=loadProject;
new ResizeObserver(resize).observe($('viewport'));
loadProject();
