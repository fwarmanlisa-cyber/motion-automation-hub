import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateProject } from '../packages/motion-engine/validate.js';
import { createProjectStore, ProjectError } from './project-store.js';
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
export function createStudioServer({root=defaultRoot,backupDir=path.join(root,'server/storage/backups'),projectFile=path.join(root,'projects/demo.json')}={}) {
  root=path.resolve(root);
  const store=createProjectStore(projectFile,backupDir);
  return http.createServer(async(req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
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
      else if(pathname==='/vendor/gsap.js') file='node_modules/gsap/dist/gsap.min.js';
      else if(/^\/(apps\/studio|packages\/motion-engine)\//.test(pathname)) file=pathname.slice(1);
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
  const server=createStudioServer();
  server.on('error',error=>{console.error('Studio startup failed:',error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log('Studio listening on port '+port));
}
