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
    if(animation.at+animation.duration>project.duration) errors.push({message:'Animation exceeds project duration'});
  }
  return {valid:errors.length===0,errors};
}
