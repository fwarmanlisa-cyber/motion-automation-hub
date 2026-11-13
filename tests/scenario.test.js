import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {compileScenario,ScenarioError} from '../packages/scenario-engine/index.js';
import {validateProject} from '../packages/motion-engine/validate.js';
import {generate} from '../scripts/generate.js';
const scenario=JSON.parse(await readFile(new URL('../scenarios/demo.json',import.meta.url),'utf8'));
test('three scenes compile to a valid deterministic project without modifying input',()=>{
 const original=structuredClone(scenario),project=compileScenario(scenario);
 assert.deepEqual(compileScenario(scenario),project);assert.deepEqual(scenario,original);
 assert.equal(validateProject(project).valid,true);assert.equal(project.duration,12);
 assert.equal(project.elements.length,8);assert.equal(project.animations.length,16);
 assert.equal(new Set(project.elements.map(e=>e.id)).size,8);
 for(const element of project.elements){
  const motions=project.animations.filter(a=>a.target===element.id);
  assert.equal(motions.length,2);assert.equal(motions[0].from.opacity,0);
  assert.equal(motions[0].to.opacity,1);assert.equal(motions[1].from.opacity,1);assert.equal(motions[1].to.opacity,0);
  assert.ok(motions[1].at>motions[0].at+motions[0].duration,'Each element has a visible hold interval');
 }
});
test('minimal scenario uses documented defaults and optional subtitle is omitted',()=>{
 const project=compileScenario({schemaVersion:'1.0',title:'Test',scenes:[{title:'Only title',template:'statement'}]});
 assert.equal(project.width,1920);assert.equal(project.height,1080);assert.equal(project.fps,30);
 assert.equal(project.duration,4);assert.equal(project.elements.length,1);
});
test('fractional durations are quantized to frames across all supported frame rates',()=>{
 for(let fps=10;fps<=60;fps++){
  const project=compileScenario({...scenario,fps,width:1280,height:720,scenes:[{title:'One',duration:2.333},{title:'Two',duration:3.117}]});
  assert.equal(project.duration,(Math.round(2.333*fps)+Math.round(3.117*fps))/fps);
  assert.equal(validateProject(project).valid,true);
  for(const a of project.animations)assert.ok(Math.abs(a.at*fps-Math.round(a.at*fps))<1e-7);
 }
});
for(const [name,change] of [
 ['unknown template',s=>s.scenes[0].template='execute-code'],
 ['executable properties',s=>s.scenes[0].script='alert(1)'],
 ['empty scenes',s=>s.scenes=[]],
 ['blank title',s=>s.scenes[0].title='   '],
 ['too short scene',s=>s.scenes[0].duration=0.5],
 ['excessive total duration',s=>s.scenes=Array.from({length:7},()=>({title:'Scene',duration:20}))]
])test(`rejects ${name}`,()=>{const input=structuredClone(scenario);change(input);assert.throws(()=>compileScenario(input),ScenarioError);});
test('generation is repeatable, backs up changed output, and preserves it on invalid input',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'motion-generate-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const input=path.join(dir,'scenario.json'),output=path.join(dir,'project.json');
 await writeFile(input,'\uFEFF'+JSON.stringify(scenario));
 assert.equal((await generate(input,output)).changed,true);
 const first=await readFile(output,'utf8');assert.equal((await generate(input,output)).changed,false);
 const changed=structuredClone(scenario);changed.scenes[0].title='Changed automatically';
 await writeFile(input,JSON.stringify(changed));assert.equal((await generate(input,output)).backup,true);
 const backups=await readdir(path.join(dir,'.generation-backups'));
 assert.equal(await readFile(path.join(dir,'.generation-backups',backups[0]),'utf8'),first);
 const saved=await readFile(output,'utf8');
 await writeFile(input,'{}');await assert.rejects(generate(input,output));assert.equal(await readFile(output,'utf8'),saved);
 await assert.rejects(generate(input,input),/different files/);
});
