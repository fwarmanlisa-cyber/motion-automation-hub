import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {compileStyleStudy,studyStyles} from '../packages/art-direction/index.js';
import {renderMotion} from '../packages/renderer/index.js';
try{
  const brief=JSON.parse(await readFile('scenarios/style-study.json','utf8'));
  const directory=path.resolve('outputs','style-study-'+randomUUID());await mkdir(directory,{recursive:true});
  for(const style of studyStyles){
    const {code}=compileStyleStudy(brief,style);await writeFile(path.join(directory,style+'.js'),code);
    console.log('Rendering '+style);
    await renderMotion({source:{kind:'code',code},outputFile:path.join(directory,style+'.mp4'),onProgress:p=>{if(p.frame && p.frame%60===0)console.log(`${style}: ${p.frame}/${p.total}`);}});
  }
  console.log('Three MP4s and their source code: '+directory);
}catch(error){console.error(error.message);process.exitCode=1;}
