import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {renderMotion} from '../packages/renderer/index.js';
import {createStudioServer} from '../server/index.js';
const exec=promisify(execFile),ffmpeg=process.env.FFMPEG_PATH || 'ffmpeg',ffprobe=process.env.FFPROBE_PATH || 'ffprobe';
const dir=await mkdtemp(path.join(os.tmpdir(),'motion-video-test-'));
const code=`export const composition={width:320,height:568,fps:10,duration:2};
export function createMotion({stage,gsap}){
 stage.style.background='#101827';const box=document.createElement('div');
 Object.assign(box.style,{position:'absolute',width:'80px',height:'80px',left:'40px',top:'180px',background:'#2dd4bf'});stage.append(box);
 const timeline=gsap.timeline({paused:true});timeline.fromTo(box,{x:0},{x:160,duration:2,ease:'none'},0);return timeline;
}`;
let server;
try {
 const first=path.join(dir,'first.mp4'),second=path.join(dir,'second.mp4');
 await renderMotion({source:{kind:'code',code},outputFile:first});
 await renderMotion({source:{kind:'code',code},outputFile:second});
 const probe=JSON.parse((await exec(ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',first])).stdout);
 const video=probe.streams.find(s=>s.codec_type==='video');
 assert.equal(video.width,320);assert.equal(video.height,568);assert.equal(video.codec_name,'h264');assert.equal(video.pix_fmt,'yuv420p');assert.equal(video.r_frame_rate,'10/1');assert.equal(Number(video.nb_read_frames),20);assert.equal(Number(probe.format.duration),2);
 const hash=async file=>(await exec(ffmpeg,['-v','error','-i',file,'-map','0:v:0','-f','hash','-hash','sha256','-'])).stdout;
 assert.equal(await hash(first),await hash(second),'Repeated renders must decode to identical pixels');
 const frameHash=async at=>(await exec(ffmpeg,['-v','error','-ss',at,'-i',first,'-frames:v','1','-f','hash','-hash','sha256','-'])).stdout;
 assert.notEqual(await frameHash('0.1'),await frameHash('1.5'),'Video frames must actually animate');
 await assert.rejects(renderMotion({source:{kind:'code',code},outputFile:first}),/already exists/);
 await assert.rejects(renderMotion({source:{kind:'code',code:'export const composition={width:321,height:568,fps:10,duration:2};'},outputFile:path.join(dir,'bad.mp4')}));
 await assert.rejects(stat(path.join(dir,'bad.mp4')),{code:'ENOENT'});
 // Richer code: asynchronous resource preparation, local SVG image and Canvas frame rendering.
 const assetsRoot=path.join(dir,'assets');await mkdir(assetsRoot);
 await writeFile(path.join(assetsRoot,'badge.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#ffcc00"/></svg>');
 const richCode=`export const composition={width:320,height:568,fps:10,duration:2};
 let image,canvas;
 export async function prepare(){image=new Image();image.src='/assets/badge.svg';await image.decode();}
 export function createMotion({stage,gsap}){
   stage.append(image);canvas=document.createElement('canvas');canvas.width=320;canvas.height=400;stage.append(canvas);
   const state={x:0};const timeline=gsap.timeline({paused:true});
   timeline.to(state,{x:1,duration:2,ease:'none',onUpdate:()=>{stage.dataset.updated='yes';}},0);return timeline;
 }
 export function renderFrame({time,stage}){
   if(time>0 && stage.dataset.updated!=='yes')throw new Error('Timeline onUpdate was suppressed');
   const ctx=canvas.getContext('2d');ctx.fillStyle='#101827';ctx.fillRect(0,0,320,400);ctx.fillStyle='#2dd4bf';ctx.fillRect(20+time*80,80,60,60);
 }`;
 const richFile=path.join(dir,'rich.mp4');
 await renderMotion({source:{kind:'code',code:richCode},outputFile:richFile,assetsRoot});
 assert.ok((await stat(richFile)).size>1000);
 const missing=richCode.replace('/assets/badge.svg','/assets/missing.svg');
 await assert.rejects(renderMotion({source:{kind:'code',code:missing},outputFile:path.join(dir,'missing.mp4'),assetsRoot}));
 await assert.rejects(stat(path.join(dir,'missing.mp4')),{code:'ENOENT'});
 // Exercise external code injection through the actual HTTP server and download MP4.
 server=createStudioServer({outputDir:path.join(dir,'api')});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const rejected=await fetch(base+'/api/renders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'code',code:''})});assert.equal(rejected.status,400);
 const response=await fetch(base+'/api/renders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'code',code})});
 assert.equal(response.status,202);const job=await response.json();
 assert.equal((await fetch(base+`/api/renders/${job.id}/video`)).status,409);
 let status;
 const deadline=Date.now()+60000;
 do {
  status=await (await fetch(base+`/api/renders/${job.id}`)).json();
  if(['completed','failed'].includes(status.state))break;
  await new Promise(resolve=>setTimeout(resolve,200));
 }while(Date.now()<deadline);
 assert.equal(status.state,'completed',status.error);assert.equal(status.result.frameCount,20);
 const download=await fetch(base+status.videoUrl);assert.equal(download.status,200);assert.equal(download.headers.get('Content-Type'),'video/mp4');assert.ok((await download.arrayBuffer()).byteLength>1000);
 const bad=await (await fetch(base+'/api/renders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'code',code:'export syntax is invalid;'})})).json();
 const badDeadline=Date.now()+20000;let badStatus;
 do{badStatus=await (await fetch(base+`/api/renders/${bad.id}`)).json();if(badStatus.state==='failed')break;await new Promise(resolve=>setTimeout(resolve,100));}while(Date.now()<badDeadline);
 assert.equal(badStatus.state,'failed');assert.ok(badStatus.error);assert.equal((await fetch(base+`/api/renders/${bad.id}/video`)).status,409);
 await assert.rejects(stat(path.join(dir,'api',bad.id+'.mp4')),{code:'ENOENT'});
 assert.equal((await readdir(dir)).some(name=>name.startsWith('.render-')),false);
 console.log('PASS: real MP4 H.264/yuv420p, exact size/FPS/duration/20 frames, moving pixels, repeated decoded pixel hash, no overwrite, invalid metadata cleanup, external-code HTTP job/progress/video download; local SVG image preparation, Canvas renderFrame and GSAP onUpdate; missing asset fails rather than producing a misleading successful video.');
}finally{if(server)await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
