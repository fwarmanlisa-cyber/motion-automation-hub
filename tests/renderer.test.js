import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateComposition} from '../packages/renderer/composition.js';
import {createRenderJobs} from '../server/render-jobs.js';
const valid={width:1080,height:1920,fps:30,duration:4};
test('vertical composition has exact frame count',()=>assert.equal(validateComposition(valid).frameCount,120));
for(const [name,value] of [['odd width',{...valid,width:1081}],['invalid fps',{...valid,fps:0}],['fractional frame count',{...valid,duration:1.01}],['excessive duration',{...valid,duration:121}],['missing metadata',undefined]])test(`rejects ${name}`,()=>assert.throws(()=>validateComposition(value)));
test('jobs reject parallel work and expose progress and completion',async()=>{
 let finish;
 const jobs=createRenderJobs({outputDir:'outputs',render:options=>{options.onProgress({phase:'capturing',frame:1,total:2});return new Promise(resolve=>{finish=resolve;});}});
 const first=jobs.submit({kind:'code',code:'sample'},'code');
 assert.throws(()=>jobs.submit({},'code'),e=>e.status===409);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(jobs.get(first.id).frame,1);
 finish({...valid,frameCount:120,bytes:100});
 await new Promise(resolve=>setImmediate(resolve));
 const completed=jobs.get(first.id);assert.equal(completed.state,'completed');assert.match(completed.videoUrl,/\/video$/);
 assert.notEqual(jobs.submit({},'code').id,first.id);
});
test('failed jobs expose errors and allow another submission',async()=>{
 const jobs=createRenderJobs({outputDir:'outputs',render:async()=>{throw new Error('Invalid motion code');}});
 const job=jobs.submit({kind:'code'},'code');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(jobs.get(job.id).state,'failed');assert.equal(jobs.get(job.id).error,'Invalid motion code');
 assert.ok(jobs.submit({},'code').id);
});
