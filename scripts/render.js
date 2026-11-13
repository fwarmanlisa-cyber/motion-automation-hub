import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {loadRenderSource} from '../packages/renderer/source.js';
import {renderMotion} from '../packages/renderer/index.js';
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const options={source:'code'};const args=process.argv.slice(2);
    for(let i=0;i<args.length;i+=2){
      const key=args[i]?.replace(/^--/,'');
      if(!['source','input','output'].includes(key) || !args[i]?.startsWith('--') || !args[i+1])throw new Error('Usage: node scripts/render.js --source code|scenario|project [--input file] [--output new.mp4]');
      options[key]=args[i+1];
    }
    const source=await loadRenderSource(options.source,{input:options.input?path.resolve(options.input):undefined});
    const outputFile=path.resolve(options.output || `outputs/reel-${randomUUID()}.mp4`);
    let last=-1;
    const result=await renderMotion({source,outputFile,onProgress:progress=>{
      const percent=progress.total?Math.floor(progress.frame/progress.total*100):0;
      if(percent>=last+10 || progress.phase==='completed'){last=percent;console.log(`${progress.phase}: ${progress.frame}/${progress.total} (${percent}%)`);}
    }});
    console.log(`MP4: ${result.outputFile}\n${result.width}x${result.height} | ${result.fps}fps | ${result.duration}s | ${result.frameCount} frames`);
  }catch(error){console.error('Render failed:',error.message);process.exitCode=1;}
}
