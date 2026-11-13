import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateProject } from '../packages/motion-engine/validate.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json; charset=utf-8'};
http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file;
    if (pathname === '/' || pathname === '/apps/studio/') file = 'apps/studio/index.html';
    else if (pathname === '/vendor/gsap.js') file = 'node_modules/gsap/dist/gsap.min.js';
    else if (/^\/(apps\/studio|packages\/motion-engine|projects)\//.test(pathname)) file = pathname.slice(1);
    else {res.writeHead(404).end(); return;}
    const target = path.resolve(root,file);
    if (!target.startsWith(root) || file.split('/').includes('..')) {res.writeHead(403).end();return;}
    const content = await readFile(target);
    if (pathname.startsWith('/projects/') && !validateProject(JSON.parse(content)).valid) {
      res.writeHead(422,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Invalid project',details:validateProject(JSON.parse(content)).errors}));return;
    }
    res.writeHead(200,{'Content-Type':types[path.extname(target)] || 'application/octet-stream','Cache-Control':'no-store'}).end(content);
  } catch(error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Unable to load resource'); }
}).listen(Number(process.env.PORT || 5500),'127.0.0.1',()=>console.log('Studio listening on port '+(process.env.PORT || 5500)));
