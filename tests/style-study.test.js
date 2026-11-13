import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileStyleStudy,studyStyles} from '../packages/art-direction/index.js';
const brief=JSON.parse(await readFile(new URL('../scenarios/style-study.json',import.meta.url),'utf8'));
test('three styles share the same story and duration and produce repeatable standalone code',async()=>{
 const before=structuredClone(brief);const codes=[];
 for(const style of studyStyles){
  const result=compileStyleStudy(brief,style),again=compileStyleStudy(brief,style);assert.equal(result.code,again.code);
  assert.equal(result.composition.duration,6);assert.deepEqual(result.story.map(s=>s.title),brief.scenes.map(s=>s.title));
  const module=await import('data:text/javascript;base64,'+Buffer.from(result.code).toString('base64'));
  assert.equal(typeof module.createMotion,'function');assert.equal(module.style,style);codes.push(result.code);
 }
 assert.equal(new Set(codes).size,3);assert.deepEqual(brief,before);
});
test('study compilation rejects unknown styles and invalid stories',()=>{
 assert.throws(()=>compileStyleStudy(brief,'anything'),/Unknown/);
 assert.throws(()=>compileStyleStudy({...brief,scenes:[]},'minimal'));
});
