import http from 'node:http';
import {readFile,mkdir,link,unlink,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {launchBrowser} from './browser.js';
import {snapshotAssets} from './assets.js';
import {fileURLToPath} from 'node:url';
import {validateProject} from '../motion-engine/validate.js';
import {validateComposition} from './composition.js';
const exec=promisify(execFile);
const boot=`try {
  const motion=await import('/motion.js');
  if(typeof motion.createMotion!=='function')throw new Error('Motion code must export createMotion');
  window.motionMetadata=motion.composition;
  window.motionModule=motion;
  window.createRenderMotion=()=>motion.createMotion({stage:document.getElementById('stage'),gsap:window.gsap});
} catch(error) {window.motionLoadError=error.message;}`;
function bounded(operation,ms,label) {
  let timer;
  return Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out')),ms);})]).finally(()=>clearTimeout(timer));
}
export async function renderMotion({source,outputFile,onProgress=()=>{},ffmpegPath=process.env.FFMPEG_PATH || 'ffmpeg',chromiumPath=process.env.CHROMIUM_PATH,assetsRoot=fileURLToPath(new URL('../../assets',import.meta.url))}) {
  if(!outputFile?.endsWith('.mp4'))throw new Error('Output must be an MP4 file');
  if(!source || !['project','code'].includes(source.kind))throw new Error('Invalid render source');
  if(source.kind==='project') {
    const result=validateProject(source.project);
    if(!result.valid)throw new Error('Invalid render project');
    validateComposition(source.project);
  }
  await mkdir(path.dirname(outputFile),{recursive:true});
  try{await stat(outputFile);throw new Error('Output already exists; choose a new filename');}catch(error){if(error.code!=='ENOENT')throw error;}
  try{await exec(ffmpegPath,['-hide_banner','-version'],{timeout:10000,maxBuffer:1024*1024});}
  catch(error){throw new Error('FFmpeg is unavailable. Install it or set FFMPEG_PATH. '+error.message);}
  const gsap=await readFile(new URL('../../node_modules/gsap/dist/gsap.min.js',import.meta.url));
  const runtime=await readFile(new URL('./runtime.js',import.meta.url));
  const assets=await snapshotAssets(assetsRoot);
  const engine=await readFile(new URL('../motion-engine/index.js',import.meta.url));
  const module=source.kind==='code'?source.code:`import {buildScene} from '/engine.js';\nexport const composition=${JSON.stringify(source.project)};\nexport function createMotion({stage,gsap}){return buildScene(stage,composition,gsap);}`;
  const resources=new Map([
    ['/',{type:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:#101827}#stage{position:relative;overflow:hidden;font-family:Tahoma,Arial,sans-serif}</style></head><body><div id="stage"></div><script src="/gsap.js"></script><script type="module" src="/boot.js"></script></body></html>'}],
    ['/gsap.js',{type:'text/javascript',body:gsap}],['/engine.js',{type:'text/javascript',body:engine}],
    ['/runtime.js',{type:'text/javascript',body:runtime}],...assets,
    ['/motion.js',{type:'text/javascript',body:module}],['/boot.js',{type:'text/javascript',body:boot}]
  ]);
  // This internal server is read-only and exposes only this render's snapshot.
  const server=http.createServer((req,res)=>{
    let resource;
    try{resource=resources.get(decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
    if(req.method!=='GET' || !resource){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':resource.type+'; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'"}).end(resource.body);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}`;
  const temporary=path.join(path.dirname(outputFile),`.render-${randomUUID()}.mp4`);
  let browser,encoder,encoderDone,encoderLog='';
  try {
    onProgress({phase:'starting',frame:0,total:0});
    browser=await launchBrowser({executablePath:chromiumPath});
    const context=await browser.newContext({viewport:{width:1080,height:1920},deviceScaleFactor:1,serviceWorkers:'block'});
    const blockedResources=[];
    await context.route('**/*',route=>{
      const request=route.request();
      if(request.method()==='GET' && request.url().startsWith(base+'/') && resources.has(decodeURIComponent(new URL(request.url()).pathname)))return route.continue();
      if(!request.url().endsWith('/favicon.ico'))blockedResources.push(request.url());
      return route.abort();
    });
    const page=await context.newPage();
    let pageError;
    page.on('pageerror',error=>{pageError=error;});
    await page.goto(base,{waitUntil:'load',timeout:30000});
    try{await page.waitForFunction(()=>Boolean(window.createRenderMotion || window.motionLoadError),{},{timeout:10000});}catch(error){throw pageError || error;}
    const metadata=await bounded(page.evaluate(()=>{
      if(window.motionLoadError)throw new Error(window.motionLoadError);
      return window.motionMetadata;
    }),10000,'Motion metadata');
    const composition=validateComposition(metadata);
    await page.setViewportSize({width:composition.width,height:composition.height});
    await bounded(page.evaluate(async metadata=>{
      const stage=document.getElementById('stage');
      Object.assign(stage.style,{width:metadata.width+'px',height:metadata.height+'px'});
      const {initializeMotion}=await import('/runtime.js');
      window.renderSession=await initializeMotion(window.motionModule,stage,window.gsap,metadata);
      window.gsap.ticker.sleep();
    },composition),15000,'Motion initialization');
    await page.waitForLoadState('networkidle',{timeout:15000});
    if(blockedResources.length)throw new Error('Missing or unsupported render resource: '+blockedResources[0]);
    const {width,height,fps,duration,frameCount}=composition;
    encoder=spawn(ffmpegPath,['-hide_banner','-loglevel','error','-nostdin','-n','-f','image2pipe','-vcodec','png','-framerate',String(fps),'-i','pipe:0','-frames:v',String(frameCount),'-an','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-threads','2','-movflags','+faststart',temporary],{stdio:['pipe','ignore','pipe'],windowsHide:true});
    encoder.stdin.on('error',()=>{});
    encoder.stderr.on('data',chunk=>{encoderLog=(encoderLog+chunk.toString()).slice(-4000);});
    encoderDone=new Promise(resolve=>{encoder.once('error',error=>resolve({error}));encoder.once('close',code=>resolve({code}));});
    for(let frame=0;frame<frameCount;frame++) {
      if(pageError)throw pageError;
      await bounded(page.evaluate(time=>{window.renderSession.seek(time);window.gsap.ticker.sleep();},frame/fps),10000,'Frame evaluation');
      const png=await page.screenshot({type:'png',clip:{x:0,y:0,width,height},timeout:15000});
      await bounded(new Promise((resolve,reject)=>encoder.stdin.write(png,error=>error?reject(error):resolve())),15000,'Frame encoding');
      onProgress({phase:'capturing',frame:frame+1,total:frameCount});
    }
    if(pageError)throw pageError;
    encoder.stdin.end();onProgress({phase:'encoding',frame:frameCount,total:frameCount});
    const result=await bounded(encoderDone,60000,'Video finalization');
    if(result.error || result.code!==0)throw new Error('FFmpeg failed: '+(result.error?.message || encoderLog));
    if(!(await stat(temporary)).size)throw new Error('FFmpeg produced an empty output');
    // Publish a complete file exclusively; never replace an existing video.
    await link(temporary,outputFile);
    onProgress({phase:'completed',frame:frameCount,total:frameCount});
    return {outputFile,width,height,fps,duration,frameCount,bytes:(await stat(outputFile)).size};
  } finally {
    if(encoder && encoder.exitCode===null){encoder.kill();await bounded(encoderDone,5000,'Encoder shutdown').catch(()=>{});}
    await browser?.close();
    await new Promise(resolve=>server.close(resolve));
    await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});
  }
}
