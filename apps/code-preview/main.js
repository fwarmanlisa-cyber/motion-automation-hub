import {validateComposition} from '/packages/renderer/composition.js';
import {initializeMotion} from '/packages/renderer/runtime.js';
const $=id=>document.getElementById(id);
let session,busy=false,rendering=false,objectURL;
function lock(value){busy=value;for(const id of ['apply-code','load-example','render-code'])$(id).disabled=value || rendering;$('code-input').disabled=value;}
async function json(response){
  let data;try{data=await response.json();}catch{throw new Error(`HTTP ${response.status}: سرور را به‌روز و دوباره اجرا کنید.`);}
  if(!response.ok)throw new Error(data.error || `HTTP ${response.status}`);return data;
}
async function preview(){
  if(busy)return;session?.timeline.pause();lock(true);$('controls').disabled=true;
  try{
    const code=$('code-input').value;if(!code.trim())throw new Error('کد خالی است.');
    const nextURL=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
    let motion;
    try{motion=await import(nextURL);}catch(error){URL.revokeObjectURL(nextURL);throw error;}
    if(objectURL)URL.revokeObjectURL(objectURL);objectURL=nextURL;
    const metadata=validateComposition(motion.composition),stage=$('stage');
    if(typeof motion.createMotion!=='function')throw new Error('کد باید createMotion را export کند.');
    session?.timeline.kill();session=undefined;
    stage.replaceChildren();stage.removeAttribute('style');
    Object.assign(stage.style,{width:metadata.width+'px',height:metadata.height+'px'});
    $('viewport').style.aspectRatio=`${metadata.width}/${metadata.height}`;
    session=await initializeMotion(motion,stage,window.gsap,metadata);
    const timeline=session.timeline;$('seek').max=metadata.duration;
    const update=()=>{$('seek').value=timeline.time();$('time').textContent=`${timeline.time().toFixed(2)} / ${metadata.duration.toFixed(2)}`;};
    const previous=timeline.eventCallback('onUpdate');
    timeline.eventCallback('onUpdate',function(...args){previous?.apply(this,args);session.draw(timeline.time());update();});
    update();resize();$('controls').disabled=false;$('status').textContent='کد اجرا شد — آمادهٔ پخش';
  }catch(error){$('status').textContent='خطا در کد: '+error.message;}
  finally{lock(false);}
}
function resize(){if(session)$('stage').style.transform=`scale(${$('viewport').clientWidth/parseFloat($('stage').style.width)})`;}
async function loadExample(){
  if(busy || rendering)return;
  if($('code-input').value && !confirm('کد فعلی با نمونه جایگزین شود؟'))return;
  lock(true);
  try{
    const style=$('example-select').value;
    const code=style==='original'?await (await fetch('/motion/reel.js',{cache:'no-store'})).text():(await json(await fetch('/api/style-study/'+style,{cache:'no-store'}))).code;
    $('code-input').value=code;$('video-link').hidden=true;$('render-status').textContent='';
  }catch(error){$('status').textContent='بارگذاری انجام نشد: '+error.message;lock(false);return;}
  lock(false);await preview();
}
$('code-input').addEventListener('input',()=>{$('video-link').hidden=true;$('render-status').textContent='کد تغییر کرده است؛ MP4 قبلی مربوط به این ویرایش نیست.';});
$('apply-code').onclick=preview;$('load-example').onclick=loadExample;
$('play').onclick=()=>session?.timeline.play();$('pause').onclick=()=>session?.timeline.pause();$('restart').onclick=()=>session?.timeline.restart();
$('seek').oninput=()=>{session?.seek(Number($('seek').value));if(session)$('time').textContent=`${session.timeline.time().toFixed(2)} / ${Number($('seek').max).toFixed(2)}`;};
$('render-code').onclick=async()=>{
  if(busy || rendering)return;
  const code=$('code-input').value;if(!code.trim()){$('render-status').textContent='کد خالی است.';return;}
  rendering=true;lock(true);$('video-link').hidden=true;$('render-status').textContent='در حال ارسال کد…';
  try{
    const job=await json(await fetch('/api/renders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'code',code})}));
    const deadline=Date.now()+30*60*1000;
    while(true){
      const state=await json(await fetch('/api/renders/'+job.id,{cache:'no-store'}));
      $('render-status').textContent=`${state.phase} · ${state.frame} / ${state.total}`;
      if(state.state==='failed')throw new Error(state.error);
      if(state.state==='completed'){
        $('render-status').textContent=`MP4 آماده شد — ${state.result.width}×${state.result.height} · ${state.result.duration} ثانیه`;
        $('video-link').href=state.videoUrl;$('video-link').download=job.id+'.mp4';$('video-link').hidden=false;break;
      }
      if(Date.now()>deadline)throw new Error('زمان انتظار پنل تمام شد؛ رندر ممکن است هنوز روی سرور در حال اجرا باشد.');
      await new Promise(resolve=>setTimeout(resolve,500));
    }
  }catch(error){$('render-status').textContent='رندر انجام نشد: '+error.message;}
  finally{rendering=false;lock(false);}
};
new ResizeObserver(resize).observe($('viewport'));
loadExample();
