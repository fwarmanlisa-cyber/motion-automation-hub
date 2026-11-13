import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {compileScenario} from '../scenario-engine/index.js';
import {validateProject} from '../motion-engine/validate.js';
export const repositoryRoot=fileURLToPath(new URL('../../',import.meta.url));
export async function loadRenderSource(source,{root=repositoryRoot,input,projectFile}={}) {
  if(!['scenario','project','code'].includes(source))throw new Error('Source must be scenario, project or code');
  const file=input || (source==='code'?path.join(root,'motion/reel.js'):source==='scenario'?path.join(root,'scenarios/reel.json'):projectFile || path.join(root,'projects/demo.json'));
  const text=await readFile(file,'utf8');
  if(source==='code')return {kind:'code',code:text};
  const data=JSON.parse(text.replace(/^\uFEFF/,''));
  const project=source==='scenario'?compileScenario(data):data;
  const result=validateProject(project);
  if(!result.valid)throw new Error('Invalid render project: '+JSON.stringify(result.errors));
  return {kind:'project',project};
}
