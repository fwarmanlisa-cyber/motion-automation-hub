// Browser runtime shared by preview and frame capture. Never await a GSAP timeline.
export async function initializeMotion(motion,stage,gsap,metadata) {
  const context={stage,gsap,...metadata};
  if(motion.prepare)await motion.prepare(context);
  const timeline=motion.createMotion(context);
  if(!timeline || typeof timeline.pause!=='function' || typeof timeline.time!=='function' || typeof timeline.duration!=='function')throw new Error('createMotion must synchronously return a GSAP timeline');
  if(timeline.duration()+1e-7<metadata.duration)throw new Error('Timeline is shorter than composition duration');
  timeline.pause(0);
  await Promise.all([...stage.querySelectorAll('img')].map(async image=>{
    try{await image.decode();}catch{throw new Error('Image failed to load: '+image.getAttribute('src'));}
  }));
  await document.fonts.ready;
  for(const face of document.fonts)if(face.status==='error')throw new Error('A local font failed to load');
  const draw=(time)=>{
    const frame=Math.round(time*metadata.fps);
    motion.renderFrame?.({...context,time,frame,progress:time/metadata.duration});
  };
  const seek=(time)=>{timeline.pause().time(time,false);draw(time);};
  seek(0);
  return {timeline,draw,seek};
}
