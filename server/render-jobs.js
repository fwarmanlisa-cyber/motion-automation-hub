import path from 'node:path';
import {randomUUID} from 'node:crypto';
export function createRenderJobs({render,outputDir}) {
  const jobs=new Map();let active;
  return {
    submit(source,sourceName){
      if(active){const error=new Error('A render is already running');error.status=409;throw error;}
      while(jobs.size>=20)jobs.delete(jobs.keys().next().value);
      const id=randomUUID(),job={id,source:sourceName,state:'running',phase:'starting',frame:0,total:0};
      jobs.set(id,job);active=id;
      Promise.resolve().then(()=>render({source,outputFile:path.join(outputDir,id+'.mp4'),onProgress:progress=>Object.assign(job,progress)}))
        .then(result=>{Object.assign(job,{state:'completed',phase:'completed',result:{width:result.width,height:result.height,fps:result.fps,duration:result.duration,frameCount:result.frameCount,bytes:result.bytes},videoUrl:`/api/renders/${id}/video`});})
        .catch(error=>{Object.assign(job,{state:'failed',phase:'failed',error:error.message});})
        .finally(()=>{active=undefined;});
      return {...job};
    },
    get(id){const job=jobs.get(id);return job?structuredClone(job):undefined;}
  };
}
