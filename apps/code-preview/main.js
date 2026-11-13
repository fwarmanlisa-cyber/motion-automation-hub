import {validateComposition} from '/packages/renderer/composition.js';
const $=id=>document.getElementById(id);
try {
  const motion=await import('/motion/reel.js');
  const {composition}=motion;
  const {initializeMotion}=await import('/packages/renderer/runtime.js');
  const metadata=validateComposition(composition),stage=$('stage');
  Object.assign(stage.style,{width:metadata.width+'px',height:metadata.height+'px'});
  $('viewport').style.aspectRatio=`${metadata.width}/${metadata.height}`;
  const session=await initializeMotion(motion,stage,window.gsap,metadata),timeline=session.timeline;
  $('seek').max=metadata.duration;
  const update=()=>{$('seek').value=timeline.time();$('time').textContent=`${timeline.time().toFixed(2)} / ${metadata.duration.toFixed(2)}`;};
  const previousUpdate=timeline.eventCallback('onUpdate');
  timeline.eventCallback('onUpdate',function(...args){previousUpdate?.apply(this,args);session.draw(timeline.time());update();});
  $('play').onclick=()=>timeline.play();$('pause').onclick=()=>timeline.pause();$('restart').onclick=()=>timeline.restart();
  $('seek').oninput=()=>{session.seek(Number($('seek').value));update();};
  new ResizeObserver(()=>{stage.style.transform=`scale(${$('viewport').clientWidth/metadata.width})`;}).observe($('viewport'));
  update();$('controls').disabled=false;$('status').textContent='کد بارگذاری شد — آمادهٔ پخش';
}catch(error){$('status').textContent='خطا در پیش‌نمایش: '+error.message;}
