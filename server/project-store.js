import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { validateProject } from '../packages/motion-engine/validate.js';
const revision = text => createHash('sha256').update(text).digest('hex');
export class ProjectError extends Error {
  constructor(status, message, details) { super(message); this.status=status; this.details=details; }
}
export function createProjectStore(file, backupDir) {
  let pending=Promise.resolve();
  async function read() {
    const text=await readFile(file,'utf8');
    let project;
    try {project=JSON.parse(text);} catch {throw new ProjectError(422,'Project file contains invalid JSON');}
    const result=validateProject(project);
    if(!result.valid) throw new ProjectError(422,'Invalid project',result.errors);
    return {project,revision:revision(text),text};
  }
  function save(project, baseRevision) {
    // Serialize saves so two browser tabs cannot both pass the same revision check.
    const operation=pending.then(async()=>{
      const result=validateProject(project);
      if(!result.valid) throw new ProjectError(422,'Invalid project',result.errors);
      const current=await read();
      if(baseRevision!==current.revision) throw new ProjectError(409,'Project changed on disk. Reload before saving.');
      const text=JSON.stringify(project,null,2)+'\n';
      await mkdir(backupDir,{recursive:true});
      const backup=path.join(backupDir,`${Date.now()}-${randomUUID()}.json`);
      // A backup must succeed before the project is replaced.
      await writeFile(backup,current.text,{flag:'wx'});
      const temporary=path.join(path.dirname(file),`.save-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary,text,{flag:'wx'});
        // Catch external edits made while the backup was being written.
        if(revision(await readFile(file,'utf8'))!==current.revision) throw new ProjectError(409,'Project changed on disk. Reload before saving.');
        await rename(temporary,file);
      } finally {await unlink(temporary).catch(error=>{if(error.code!=='ENOENT') throw error;});}
      return {project,revision:revision(text)};
    });
    pending=operation.catch(()=>{});
    return operation;
  }
  return {read,save};
}
