import {launchBrowser} from '../packages/renderer/browser.js';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {compileScenario} from '../packages/scenario-engine/index.js';
import {createStudioServer} from '../server/index.js';
const scenario=JSON.parse(await readFile(new URL('../scenarios/demo.json',import.meta.url),'utf8'));
const project=compileScenario(scenario),temporary=await mkdtemp(path.join(os.tmpdir(),'motion-auto-preview-'));
const projectFile=path.join(temporary,'generated.json');
await writeFile(projectFile,JSON.stringify(project));
const server=createStudioServer({projectFile,backupDir:path.join(temporary,'backups')});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
 browser=await launchBrowser();
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/');await page.waitForFunction(()=>Boolean(window.studio?.timeline));
 await page.waitForFunction(()=>!document.getElementById('play').disabled && !document.getElementById('reload').disabled);
 assert.equal(await page.evaluate(()=>studio.timeline.duration()),12);
 assert.match(await page.locator('#project-source').textContent(),/generated.json$/);
 const seek=async time=>page.locator('#seek').evaluate((e,time)=>{e.value=time;e.dispatchEvent(new Event('input'));},String(time));
 const opacity=id=>page.locator(`[data-element-id="${id}"]`).evaluate(e=>Number(getComputedStyle(e).opacity));
 await mkdir('test-results',{recursive:true});
 for(let index=0;index<3;index++){
  await seek(index*4+2);
  for(let other=0;other<3;other++)assert.equal(await opacity(`scene_${other+1}_title`),other===index?1:0,`Only scene ${index+1} must be visible`);
  await page.locator('#viewport').screenshot({path:`test-results/automatic-scene-${index+1}.png`});
 }
 // Start, scene boundaries and final frame are intentionally empty; no ghost titles.
 for(const time of [0,4,8,12]){
  await seek(time);
  for(const element of project.elements)assert.equal(await opacity(element.id),0,`Element ${element.id} must be hidden at ${time}s`);
 }
 await seek(0.3);assert.ok(await opacity('scene_1_title')>0 && await opacity('scene_1_title')<1);
 await seek(3.75);assert.ok(await opacity('scene_1_title')>0 && await opacity('scene_1_title')<1);
 // Pixel equality across forward/reverse seeks is stronger than inspecting the JSON.
 await seek(10);const first=await page.locator('#viewport').screenshot();
 await seek(2);await seek(6);await seek(0);await seek(10);
 assert.deepEqual(await page.locator('#viewport').screenshot(),first,'The same scene/time must render identically after seeking');
 // Play through the first scene boundary using the actual GSAP clock.
 await seek(3.9);await page.click('#play');
 await page.waitForFunction(()=>studio.timeline.time()>4.5);
 await page.click('#pause');assert.equal(await opacity('scene_1_title'),0);assert.ok(await opacity('scene_2_title')>0);
 await page.click('#restart');await page.waitForFunction(()=>studio.timeline.time()<1 && !studio.timeline.paused());
 await page.click('#pause');
 // Local code uses the same sample timeline in preview and MP4 rendering.
 await page.goto(base+'/code-preview/');await page.waitForFunction(()=>!document.getElementById('controls').disabled);
 assert.equal(await page.locator('#stage section').count(),2);
 await page.locator('#seek').evaluate(e=>{e.value='1';e.dispatchEvent(new Event('input'));});
 assert.equal(await page.locator('#stage section').nth(0).evaluate(e=>getComputedStyle(e).opacity),'1');
 await page.locator('#seek').evaluate(e=>{e.value='3';e.dispatchEvent(new Event('input'));});
 assert.equal(await page.locator('#stage section').nth(0).evaluate(e=>getComputedStyle(e).opacity),'0');
 assert.equal(await page.locator('#stage section').nth(1).evaluate(e=>getComputedStyle(e).opacity),'1');
 await page.click('#play');await page.waitForFunction(()=>Number(document.getElementById('seek').value)>3.05);
 await page.click('#pause');await page.click('#restart');
 await page.waitForFunction(()=>Number(document.getElementById('seek').value)<1);await page.click('#pause');
 assert.deepEqual(errors,[]);
 console.log('PASS: automatic three-scene preview, entry/hold/exit frames, hidden scene boundaries, pixel-repeatable seeking, play across scenes, pause and restart; no JavaScript exceptions.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(temporary,{recursive:true,force:true});}
