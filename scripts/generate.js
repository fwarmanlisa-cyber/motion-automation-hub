import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileScenario} from '../packages/scenario-engine/index.js';
import {createProjectStore} from '../server/project-store.js';
export async function generate(input,output) {
  if(path.resolve(input)===path.resolve(output))throw new Error('Input and output must be different files');
  const project=compileScenario(JSON.parse((await readFile(input,'utf8')).replace(/^\uFEFF/,'')));
  const text=JSON.stringify(project,null,2)+'\n';
  await mkdir(path.dirname(output),{recursive:true});
  try {
    await writeFile(output,text,{flag:'wx'});
    return {project,changed:true,backup:false};
  }catch(error){if(error.code!=='EEXIST')throw error;}
  const store=createProjectStore(output,path.join(path.dirname(output),'.generation-backups'));
  const current=await store.read();
  if(JSON.stringify(current.project)===JSON.stringify(project))return {project,changed:false,backup:false};
  await store.save(project,current.revision);
  return {project,changed:true,backup:true};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2);
    const options={input:'scenarios/demo.json',output:'projects/generated.json'};
    for(let i=0;i<args.length;i+=2){
      const key=args[i]?.replace(/^--/,'');
      if(!['input','output'].includes(key) || !args[i+1] || !args[i].startsWith('--'))throw new Error('Usage: npm run generate -- --input scenario.json --output project.json');
      options[key]=args[i+1];
    }
    const input=path.resolve(options.input),output=path.resolve(options.output);
    if(input===output)throw new Error('Input and output must be different files');
    const result=await generate(input,output);
    console.log(`${result.changed?'Generated':'Unchanged'}: ${output}`);
    console.log(`${result.project.duration}s | ${result.project.fps}fps | ${result.project.elements.length} elements | ${result.project.animations.length} animations`);
    if(result.backup)console.log('Previous project backed up in .generation-backups next to the output.');
  }catch(error){console.error(error.message);if(error.details?.length)console.error(JSON.stringify(error.details,null,2));process.exitCode=1;}
}
