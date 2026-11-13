import {readdir,readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
export const assetTypes={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.css':'text/css'};
export async function snapshotAssets(root) {
  const resources=new Map();let bytes=0;
  async function visit(directory,prefix=''){
    for(const entry of await readdir(directory,{withFileTypes:true})){
      const file=path.join(directory,entry.name),relative=prefix+entry.name;
      if(entry.isSymbolicLink())throw new Error('Asset symlinks are not supported: '+relative);
      if(entry.isDirectory()){await visit(file,relative+'/');continue;}
      const type=assetTypes[path.extname(entry.name).toLowerCase()];if(!type)continue;
      const info=await lstat(file);bytes+=info.size;
      if(info.size>16*1024*1024 || bytes>64*1024*1024)throw new Error('Local assets exceed the 16 MB per-file / 64 MB total render limit');
      resources.set('/assets/'+relative,{type,body:await readFile(file)});
    }
  }
  try{await visit(root);}catch(error){if(error.code!=='ENOENT')throw error;}
  return resources;
}
