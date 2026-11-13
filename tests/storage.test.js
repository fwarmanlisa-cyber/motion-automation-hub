import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createProjectStore} from '../server/project-store.js';
import {createStudioServer} from '../server/index.js';
const demo=JSON.parse(await readFile(new URL('../projects/demo.json',import.meta.url),'utf8'));
async function fixture(t){
 const root=await mkdtemp(path.join(os.tmpdir(),'motion-store-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const file=path.join(root,'demo.json'),backups=path.join(root,'backups');
 await writeFile(file,JSON.stringify(demo));
 return {root,file,backups,store:createProjectStore(file,backups)};
}
test('save persists a validated project and exact previous bytes as backup',async t=>{
 const {file,backups,store}=await fixture(t);const initial=await store.read();
 const project=structuredClone(initial.project);project.elements[1].content='ویرایش فارسی';
 const saved=await store.save(project,initial.revision);
 assert.equal(JSON.parse(await readFile(file,'utf8')).elements[1].content,'ویرایش فارسی');
 assert.equal(await readFile(path.join(backups,(await readdir(backups))[0]),'utf8'),initial.text);
 assert.equal((await store.read()).revision,saved.revision);
});
test('invalid edits leave project and backup directory unchanged',async t=>{
 const {file,backups,store}=await fixture(t);const initial=await store.read();
 const project=structuredClone(initial.project);project.animations[0].duration=999;
 await assert.rejects(store.save(project,initial.revision),e=>e.status===422);
 assert.equal(await readFile(file,'utf8'),initial.text);
 await assert.rejects(readdir(backups),{code:'ENOENT'});
});
test('concurrent saves with the same revision allow only one writer',async t=>{
 const {store,backups}=await fixture(t);const initial=await store.read();
 const projects=['first','second'].map(content=>{const p=structuredClone(demo);p.elements[1].content=content;return p;});
 const results=await Promise.allSettled(projects.map(p=>store.save(p,initial.revision)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 assert.equal((await readdir(backups)).length,1);
});
test('external edit is preserved and stale save rejected',async t=>{
 const {file,store}=await fixture(t);const initial=await store.read();
 await writeFile(file,JSON.stringify({...demo,title:'external'}));
 await assert.rejects(store.save(demo,initial.revision),e=>e.status===409);
 assert.equal((await store.read()).project.title,'external');
});
test('backup failure prevents replacement of the project',async t=>{
 const {file,store,backups}=await fixture(t);const initial=await store.read();
 await writeFile(backups,'not a directory');
 await assert.rejects(store.save(demo,initial.revision));
 assert.equal(await readFile(file,'utf8'),initial.text);
});
test('HTTP API validates, rejects cross-origin and malformed writes, and saves with revision',async t=>{
 const {root,file,backups}=await fixture(t);
 const server=createStudioServer({root,projectFile:file,backupDir:backups});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const initial=await fetch(base+'/projects/demo.json');const revision=initial.headers.get('ETag').replaceAll('"','');
 assert.equal(initial.status,200);assert.deepEqual(await initial.json(),demo);
 const put=(data,headers={})=>fetch(base+'/api/project',{method:'PUT',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 assert.equal((await put({project:demo,revision},{Origin:'https://unrelated.example'})).status,403);
 assert.equal((await fetch(base+'/api/project',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
 assert.equal((await put({project:{},revision})).status,422);
 assert.equal((await fetch(base+'/api/project/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(demo)})).status,200);
 assert.equal((await put({project:demo,revision:'stale'})).status,409);
 const edited=structuredClone(demo);edited.elements[1].content='تست API';
 assert.equal((await put({project:edited,revision},{Origin:base})).status,200);
 assert.equal((await fetch(base+'/server/storage/backups')).status,404);
 assert.equal((await fetch(base+'/package.json')).status,404);
 assert.equal((await fetch(base+'/projects/demo.json',{method:'DELETE'})).status,405);
 assert.equal((await (await fetch(base+'/projects/demo.json')).json()).elements[1].content,'تست API');
});
