import {validateComposition} from '/packages/renderer/composition.js';
const $=id=>document.getElementById(id);
try {
  const {composition,createMotion}=await import('/motion/reel.js');
  const metadata=validateComposition(composition),stage=$('stage');
  Object.assign(stage.style,{width:metadata.width+'px',height:metadata.height+'px'});
  $('viewport').style.aspectRatio=`${metadata.width}/${metadata.height}`;
  const timeline=createMotion({stage,gsap:window.gsap});
  if(!timeline || typeof timeline.pause!=='function' || timeline.duration()+1e-7<metadata.duration)throw new Error('کد باید تایم‌لاین معتبر برگرداند.');
  timeline.pause(0);$('seek').max=metadata.duration;
  const update=()=>{$('seek').value=timeline.time();$('time').textContent=`${timeline.time().toFixed(2)} / ${metadata.duration.toFixed(2)}`;};
  timeline.eventCallback('onUpdate',update);
  $('play').onclick=()=>timeline.play();$('pause').onclick=()=>timeline.pause();$('restart').onclick=()=>timeline.restart();
  $('seek').oninput=()=>{timeline.pause().time(Number($('seek').value),true);update();};
  new ResizeObserver(()=>{stage.style.transform=`scale(${$('viewport').clientWidth/metadata.width})`;}).observe($('viewport'));
  update();$('controls').disabled=false;$('status').textContent='کد بارگذاری شد — آمادهٔ پخش';
}catch(error){$('status').textContent='خطا در پیش‌نمایش: '+error.message;}
