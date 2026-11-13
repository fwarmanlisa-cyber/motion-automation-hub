import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
const schema = JSON.parse(readFileSync(new URL('./project.schema.json',import.meta.url),'utf8'));
const validate = new Ajv({allErrors:true}).compile(schema);
export function validateProject(project) {
  if(!validate(project)) return {valid:false,errors:structuredClone(validate.errors)};
  const ids=new Set();
  const errors=[];
  for(const element of project.elements) {
    if(ids.has(element.id)) errors.push({message:`Duplicate element ID: ${element.id}`});
    ids.add(element.id);
  }
  for(const animation of project.animations) {
    if(!ids.has(animation.target)) errors.push({message:`Unknown target: ${animation.target}`});
    if(animation.at+animation.duration>project.duration+1e-7) errors.push({message:'Animation exceeds project duration'});
  }
  for(let i=0;i<project.animations.length;i++) {
    const a=project.animations[i];
    const properties=new Set([...Object.keys(a.from),...Object.keys(a.to)]);
    for(const b of project.animations.slice(i+1)) {
      if(a.target!==b.target || a.at>=b.at+b.duration-1e-7 || b.at>=a.at+a.duration-1e-7) continue;
      if([...Object.keys(b.from),...Object.keys(b.to)].some(key=>properties.has(key))) errors.push({message:`Overlapping animations on element ${a.target}`});
    }
  }
  return {valid:errors.length===0,errors};
}
