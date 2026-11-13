import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createStudioServer} from '../server/index.js';
import {launchBrowser} from '../packages/renderer/browser.js';
const directory=await mkdtemp(path.join(os.tmpdir(),'motion-panel-'));
const server=createStudioServer({outputDir:directory});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await launchBrowser();const page=await browser.newPage({viewport:{width:1440,height:1200}});page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/code-preview/');await page.waitForFunction(()=>!document.getElementById('controls').disabled);
 await mkdir('test-results',{recursive:true});const images=[];
 for(const style of ['minimal','product','educational']){
  await page.selectOption('#example-select',style);page.once('dialog',d=>d.accept());await page.click('#load-example');
  await page.waitForFunction(style=>!document.getElementById('controls').disabled && document.getElementById('code-input').value.includes(`export const style="${style}"`),style);
  await page.locator('#seek').evaluate(e=>{e.value='1.5';e.dispatchEvent(new Event('input'));});
  const headings=page.locator('[data-study-title]');assert.equal(await headings.first().textContent(),'ایده را روشن کن');
  const visible=await headings.first().evaluate(e=>{const r=e.getBoundingClientRect(),s=document.getElementById('stage').getBoundingClientRect();return r.left>=s.left && r.right<=s.right && r.top>=s.top && r.bottom<=s.bottom;});assert.equal(visible,true);
  images.push(await page.locator('#viewport').screenshot({path:`test-results/style-${style}.png`}));
  await page.locator('#seek').evaluate(e=>{e.value='4.5';e.dispatchEvent(new Event('input'));});
  assert.equal(await page.locator('[data-study-scene="0"]').evaluate(e=>getComputedStyle(e).opacity),'0');
  assert.equal(await page.locator('[data-study-scene="1"]').evaluate(e=>getComputedStyle(e).opacity),'1');
 }
 assert.notDeepEqual(images[0],images[1]);assert.notDeepEqual(images[1],images[2]);
 const code=`export const composition={width:320,height:568,fps:10,duration:2};export function createMotion({stage,gsap}){const text=document.createElement('h1');text.textContent='کد وارد شده';text.style.color='white';stage.append(text);const t=gsap.timeline({paused:true});t.fromTo(text,{opacity:0},{opacity:1,duration:2},0);return t;}`;
 await page.fill('#code-input',code);await page.click('#apply-code');await page.waitForFunction(()=>!document.getElementById('controls').disabled && document.getElementById('seek').max==='2');
 assert.equal(await page.locator('#stage h1').textContent(),'کد وارد شده');
 await page.locator('#seek').evaluate(e=>{e.value='1';e.dispatchEvent(new Event('input'));});
 await page.click('#play');await page.waitForFunction(()=>Number(document.getElementById('seek').value)>1.1);await page.click('#pause');
 await page.click('#render-code');await page.waitForFunction(()=>!document.getElementById('video-link').hidden,{},{timeout:60000});
 const video=await page.request.get(base+await page.locator('#video-link').getAttribute('href'));assert.equal(video.status(),200);assert.ok((await video.body()).length>1000);
 await page.fill('#code-input','export invalid code;');assert.equal(await page.locator('#video-link').isHidden(),true);
 await page.click('#apply-code');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('خطا در کد'));
 assert.equal(await page.locator('#play').isDisabled(),true);
 // Intentional syntax errors are caught by the panel rather than escaping as page exceptions.
 assert.deepEqual(errors,[]);
 console.log('PASS: three distinct styles/same story, visible titles, scene transition, pasted code preview/play/pause/seek, actual MP4 from panel, syntax error feedback and stale download hidden.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
