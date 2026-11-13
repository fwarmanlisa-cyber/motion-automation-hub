export function buildScene(stage, project, gsap) {
  const ids = new Set(project.elements.map(e=>e.id));
  if(ids.size !== project.elements.length || project.animations.some(a=>!ids.has(a.target) || a.at+a.duration>project.duration)) throw new Error('Invalid animation target or duration');
  stage.replaceChildren();
  Object.assign(stage.style,{width:project.width+'px',height:project.height+'px',background:project.background});
  stage.dir = project.language === 'fa' ? 'rtl' : 'ltr';
  const elements = new Map();
  for(const item of project.elements) {
    const element = document.createElement('div');
    element.dataset.elementId = item.id;
    element.textContent = item.type === 'text' ? item.content : '';
    Object.assign(element.style,{position:'absolute',left:item.x+'px',top:item.y+'px',width:item.width+'px',height:item.height+'px',fontSize:item.fontSize+'px',color:item.color,textAlign:'center',whiteSpace:'pre-wrap',borderRadius:item.type==='circle'?'50%':'0',background:item.type==='circle'?item.color:'transparent'});
    stage.append(element); elements.set(item.id,element);
  }
  // Apply the earliest declared starting value for each animated property.
  const initial = new Map();
  for(const animation of [...project.animations].sort((a,b)=>a.at-b.at)) {
    const values = initial.get(animation.target) || {};
    for(const [key,value] of Object.entries(animation.from)) if(!(key in values)) values[key]=value;
    initial.set(animation.target,values);
  }
  for(const [id,values] of initial) gsap.set(elements.get(id),values);
  const timeline = gsap.timeline({paused:true});
  timeline.to({}, {duration:project.duration},0);
  for(const animation of project.animations) timeline.fromTo(elements.get(animation.target), animation.from, {...animation.to,duration:animation.duration,ease:animation.ease,immediateRender:false},animation.at);
  timeline.seek(0);
  return timeline;
}
