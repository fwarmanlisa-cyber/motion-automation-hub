import http from 'node:http';
import {createReadStream} from 'node:fs';
import {renderMotion} from '../packages/renderer/index.js';
import {loadRenderSource} from '../packages/renderer/source.js';
import {createRenderJobs} from './render-jobs.js';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateProject } from '../packages/motion-engine/validate.js';
import { createProjectStore, ProjectError } from './project-store.js';
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const defaultRoot=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
function json(res,status,value,headers={}) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}).end(JSON.stringify(value));
}
async function body(req) {
  if(!req.headers['content-type']?.startsWith('application/json')) throw new ProjectError(415,'Expected application/json');
  const chunks=[];let bytes=0;
  for await(const chunk of req) {
    bytes+=chunk.length;
    if(bytes>1024*1024) throw new ProjectError(413,'Project exceeds 1 MB');
    chunks.push(chunk);
  }
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw new ProjectError(400,'Invalid JSON request');}
}
export function createStudioServer({root=defaultRoot,backupDir=path.join(root,'server/storage/backups'),projectFile=path.join(root,'projects/demo.json'),outputDir=path.join(root,'outputs'),render=renderMotion}={}) {
  root=path.resolve(root);
  const store=createProjectStore(projectFile,backupDir);
  const jobs=createRenderJobs({render,outputDir});
  return http.createServer(async(req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname==='/api/status' && req.method==='GET') {json(res,200,{version,protocol:'project-editor/2',projectName:path.relative(root,projectFile).split(path.sep).join('/')});return;}
      if(pathname==='/api/renders' && req.method==='POST') {
        if(req.headers['sec-fetch-site']==='cross-site' || req.headers.origin && req.headers.origin!==`http://${req.headers.host}`)throw new ProjectError(403,'Cross-origin writes are not allowed');
        const data=await body(req);
        if(!data || !['scenario','project','code'].includes(data.source) || Object.keys(data).some(key=>!['source','code'].includes(key)) || data.code!==undefined && (data.source!=='code' || typeof data.code!=='string' || !data.code.trim()))throw new ProjectError(400,'Expected source: code, scenario or project; optional code string only for code source');
        let source;
        try{source=data.code!==undefined?{kind:'code',code:data.code}:await loadRenderSource(data.source,{root,projectFile});}
        catch(error){throw new ProjectError(422,error.message);}
        const job=jobs.submit(source,data.source);
        json(res,202,job,{'Location':`/api/renders/${job.id}`});return;
      }
      const renderRoute=pathname.match(/^\/api\/renders\/([0-9a-f-]{36})(\/video)?$/);
      if(renderRoute && ['GET','HEAD'].includes(req.method)) {
        const job=jobs.get(renderRoute[1]);
        if(!job){json(res,404,{error:'Render not found'});return;}
        if(!renderRoute[2]){json(res,200,job);return;}
        if(job.state!=='completed'){json(res,409,{error:'Video is not ready'});return;}
        const video=path.join(outputDir,job.id+'.mp4');
        const {size}=await (await import('node:fs/promises')).stat(video);
        res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':size,'Content-Disposition':`attachment; filename="${job.id}.mp4"`});
        if(req.method==='HEAD'){res.end();return;}
        const stream=createReadStream(video);stream.on('error',()=>res.destroy());stream.pipe(res);return;
      }
      if((pathname==='/api/project/validate' && req.method==='POST') || (pathname==='/api/project' && req.method==='PUT')) {
        // Only same-origin browser writes; no cross-origin permissions are granted.
        if(req.headers['sec-fetch-site']==='cross-site' || req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) throw new ProjectError(403,'Cross-origin writes are not allowed');
        const data=await body(req);
        if(pathname.endsWith('/validate')) {
          const result=validateProject(data);
          json(res,result.valid?200:422,result);return;
        }
        const result=await store.save(data?.project,data?.revision);
        json(res,200,result);return;
      }
      if(!['GET','HEAD'].includes(req.method)) {json(res,405,{error:'Method not allowed'});return;}
      if(pathname==='/projects/demo.json') {
        const result=await store.read();
        json(res,200,result.project,{'ETag':`"${result.revision}"`});return;
      }
      let file;
      if(pathname==='/' || pathname==='/apps/studio/') file='apps/studio/index.html';
      else if(pathname==='/code-preview/') file='apps/code-preview/index.html';
      else if(pathname==='/motion/reel.js') file='motion/reel.js';
      else if(pathname==='/packages/renderer/composition.js') file='packages/renderer/composition.js';
      else if(pathname==='/vendor/gsap.js') file='node_modules/gsap/dist/gsap.min.js';
      else if(/^\/(apps\/studio|apps\/code-preview|packages\/motion-engine)\//.test(pathname)) file=pathname.slice(1);
      else {json(res,404,{error:'Not found'});return;}
      const target=await realpath(path.resolve(root,file));
      if(!target.startsWith(root+path.sep) || file.split('/').includes('..')) {json(res,403,{error:'Forbidden'});return;}
      const content=await readFile(target);
      res.writeHead(200,{'Content-Type':types[path.extname(target)] || 'application/octet-stream','Cache-Control':'no-store'}).end(req.method==='HEAD'?undefined:content);
    } catch(error) {
      json(res,error.status || (error.code==='ENOENT'?404:500),{error:error.status?error.message:'Unable to load or save resource',details:error.details});
    }
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT || 5500);
  const args=process.argv.slice(2);
  if(args.length && (args.length!==2 || args[0]!=='--project')) {
    console.error('Usage: node server/index.js [--project path/to/project.json]');
    process.exit(1);
  }
  const projectFile=args.length?path.resolve(args[1]):path.join(defaultRoot,'projects/demo.json');
  // Fail early rather than open an unusable preview for a missing/invalid generated file.
  try{await createProjectStore(projectFile,path.join(defaultRoot,'server/storage/backups')).read();}
  catch(error){console.error('Cannot start preview:',error.message,'Run npm run generate first for generated projects.');process.exit(1);}
  const server=createStudioServer({projectFile});
  server.on('error',error=>{console.error('Studio startup failed:',error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log('Studio listening on port '+port));
}
