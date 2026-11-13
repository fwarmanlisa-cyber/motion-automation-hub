import Ajv from 'ajv';
import {readFileSync} from 'node:fs';
import {validateProject} from '../motion-engine/validate.js';
const schema=JSON.parse(readFileSync(new URL('./scenario.schema.json',import.meta.url),'utf8'));
const validate=new Ajv({allErrors:true}).compile(schema);
export class ScenarioError extends Error {
  constructor(message,details=[]) {super(message);this.details=details;}
}
// Pure compilation: no randomness, network, timestamps or executable input.
export function compileScenario(scenario) {
  if(!validate(scenario))throw new ScenarioError('Invalid scenario',structuredClone(validate.errors));
  if(!scenario.title.trim() || scenario.scenes.some(scene=>!scene.title.trim())) throw new ScenarioError('Titles cannot be blank');
  const width=scenario.width ?? 1920,height=scenario.height ?? 1080,fps=scenario.fps ?? 30;
  const scale=Math.min(width/1920,height/1080);
  const enterFrames=Math.round(fps*0.6),exitFrames=Math.round(fps*0.5),staggerFrames=Math.round(fps*0.15);
  const project={schemaVersion:'1.0',title:scenario.title,width,height,fps,duration:0,language:scenario.language ?? 'fa',background:scenario.background ?? '#101827',elements:[],animations:[]};
  let cursor=0;
  const add=(element,start,end,offset,kind)=>{
    project.elements.push(element);
    const begin=(start+offset)/fps,enterEnd=(start+offset+enterFrames)/fps,exitStart=(end-exitFrames)/fps,finish=end/fps;
    const shift=Math.round(60*scale);
    const entrance=kind==='circle'?{from:{opacity:0,scale:0.6},to:{opacity:1,scale:1}}:kind==='title'?{from:{opacity:0,y:shift},to:{opacity:1,y:0}}:{from:{opacity:0},to:{opacity:1}};
    const exit=kind==='circle'?{from:{opacity:1,scale:1},to:{opacity:0,scale:0.6}}:kind==='title'?{from:{opacity:1,y:0},to:{opacity:0,y:-shift}}:{from:{opacity:1},to:{opacity:0}};
    project.animations.push({target:element.id,at:begin,duration:enterEnd-begin,ease:'power2.out',...entrance},{target:element.id,at:exitStart,duration:finish-exitStart,ease:'power1.inOut',...exit});
  };
  for(const [index,scene] of scenario.scenes.entries()) {
    const frames=Math.round((scene.duration ?? 4)*fps),end=cursor+frames;
    if(end>fps*120)throw new ScenarioError('Total duration must not exceed 120 seconds');
    if(frames<=enterFrames+2*staggerFrames+exitFrames)throw new ScenarioError('Scene duration leaves no hold interval');
    const prefix=`scene_${index+1}`,titleCard=(scene.template ?? 'title-card')==='title-card';
    const base={type:'text',x:Math.round(width*0.1),width:Math.round(width*0.8),height:Math.round(height*0.22)};
    if(titleCard){
      const size=Math.round(160*scale);
      add({id:prefix+'_accent',type:'circle',content:'',x:Math.round((width-size)/2),y:Math.round(height*0.17),width:size,height:size,fontSize:Math.max(1,Math.round(48*scale)),color:scenario.accent ?? '#2dd4bf'},cursor,end,0,'circle');
    }
    add({...base,id:prefix+'_title',content:scene.title,y:Math.round(height*(titleCard?0.43:0.33)),fontSize:Math.max(1,Math.round((titleCard?80:96)*scale)),color:scenario.textColor ?? '#ffffff'},cursor,end,staggerFrames,'title');
    if(scene.subtitle?.trim())add({...base,id:prefix+'_subtitle',content:scene.subtitle,y:Math.round(height*(titleCard?0.68:0.64)),fontSize:Math.max(1,Math.round(42*scale)),color:scenario.textColor ?? '#ffffff'},cursor,end,2*staggerFrames,'subtitle');
    cursor=end;
  }
  project.duration=cursor/fps;
  const result=validateProject(project);
  if(!result.valid)throw new ScenarioError('Compiled project is invalid',result.errors);
  return project;
}
