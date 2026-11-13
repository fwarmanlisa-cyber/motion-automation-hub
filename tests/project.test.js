import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateProject} from '../packages/motion-engine/validate.js';
const demo=JSON.parse(readFileSync(new URL('../projects/demo.json',import.meta.url),'utf8'));
test('demo meets schema and timeline constraints',()=>assert.equal(validateProject(demo).valid,true));
for(const [name,change] of [
  ['executable animation properties',p=>p.animations[0].to.onComplete='alert(1)'],
  ['unknown element type',p=>p.elements[0].type='script'],
  ['unknown animation target',p=>p.animations[0].target='missing'],
  ['duplicate IDs',p=>p.elements[1].id=p.elements[0].id],
  ['animation beyond project duration',p=>p.animations[0].duration=11],
  ['overlapping property animations',p=>p.animations[3].at=1],
  ['invalid opacity',p=>p.animations[0].to.opacity=2],
  ['invalid dimensions',p=>p.width=0],
  ['unknown schema version',p=>p.schemaVersion='2.0']
]) test(`rejects ${name}`,()=>{const p=structuredClone(demo);change(p);assert.equal(validateProject(p).valid,false);});
