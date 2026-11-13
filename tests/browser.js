import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,readdir,rm,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createStudioServer} from '../server/index.js';
const temporary=await mkdtemp(path.join(os.tmpdir(),'motion-browser-'));
const projectFile=path.join(temporary,'demo.json');
const original=await readFile(new URL('../projects/demo.json',import.meta.url),'utf8');
await writeFile(projectFile,original);
const backupDir=path.join(temporary,'backups');
const server=createStudioServer({projectFile,backupDir});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const executablePath=process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
let browser;
try {
 browser=await chromium.launch({executablePath,headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.request.get(base+'/projects/demo.json');
 assert.equal(response.status(),200);
 await page.goto(base+'/');
 await page.waitForFunction(()=>Boolean(window.studio?.timeline));
 assert.equal(await page.locator('[data-element-id="title"]').textContent(),'سلام از فایل JSON');
 assert.equal(await page.evaluate(()=>studio.timeline.duration()),10);
 assert.equal(await page.locator('[data-element-id="title"]').evaluate(e=>getComputedStyle(e).opacity),'0');
 await page.click('#play');await page.waitForFunction(()=>studio.timeline.time()>0.2);
 await page.click('#pause');assert.equal(await page.evaluate(()=>studio.timeline.paused()),true);
 const seek=async value=>page.locator('#seek').evaluate((e,value)=>{e.value=value;e.dispatchEvent(new Event('input'));},value);
 await seek('5');assert.equal(await page.evaluate(()=>studio.timeline.time()),5);
 const snapshot=()=>page.locator('[data-element-id="orb"]').evaluate(e=>e.style.transform);
 const first=await snapshot();await seek('8');await seek('5');assert.equal(await snapshot(),first);
 await page.click('#restart');await page.waitForFunction(()=>studio.timeline.time()<1 && !studio.timeline.paused());await page.click('#pause');
 // Regression: applying at frame zero must visibly reveal the edited title without a manual seek.
 await seek('0');await page.selectOption('#element-select','1');
 await page.fill('#element-content','ویرایش در فریم صفر');await page.click('#apply');
 await page.waitForFunction(()=>studio.project.elements[1].content==='ویرایش در فریم صفر');
 await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('[data-element-id="title"]')).opacity)>0.1);
 assert.equal(await page.evaluate(()=>studio.timeline.paused()),false);
 await page.click('#pause');
 // Edit text, color, position and animation timing, then preview without writing.
 await page.selectOption('#element-select','1');
 await page.fill('#element-content','عنوان ویرایش‌شده');
 await page.fill('#element-x','220');await page.fill('#element-y','500');
 await page.locator('#element-color').evaluate(e=>{e.value='#ffcc00';e.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.fill('#animation-at','0.5');await page.fill('#animation-duration','2');
 await page.selectOption('#animation-ease','none');
 await page.click('#apply');
 await page.waitForFunction(()=>studio.project.elements[1].content==='عنوان ویرایش‌شده');
 assert.equal(await readFile(projectFile,'utf8'),original);
 await seek('4');
 assert.equal(await page.locator('[data-element-id="title"]').evaluate(e=>e.style.left),'220px');
 assert.equal(await page.locator('[data-element-id="title"]').evaluate(e=>e.style.top),'500px');
 assert.equal(await page.locator('[data-element-id="title"]').evaluate(e=>getComputedStyle(e).color),'rgb(255, 204, 0)');
 assert.equal(await page.evaluate(()=>studio.project.animations[1].at),0.5);
 await page.click('#save');await page.waitForFunction(()=>!studio.dirty);
 const saved=await readFile(projectFile,'utf8');assert.equal(JSON.parse(saved).elements[1].content,'عنوان ویرایش‌شده');
 assert.equal(await readFile(path.join(backupDir,(await readdir(backupDir))[0]),'utf8'),original);
 await page.click('#reload');await page.waitForFunction(()=>!document.getElementById('reload').disabled);
 assert.equal(await page.inputValue('#element-content'),'عنوان ویرایش‌شده');
 // Invalid timing must not replace either the valid preview or the disk project.
 await page.fill('#animation-duration','99');await page.click('#save');
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('HTTP 422'));
 assert.equal(await readFile(projectFile,'utf8'),saved);
 assert.equal(await page.evaluate(()=>studio.project.animations[1].duration),2);
 await page.fill('#animation-duration','2');
 // Save also applies valid form changes without requiring a separate preview click.
 await page.fill('#element-content','ذخیره مستقیم');await page.click('#save');
 await page.waitForFunction(()=>!studio.dirty);
 assert.equal(JSON.parse(await readFile(projectFile,'utf8')).elements[1].content,'ذخیره مستقیم');
 // Changing an actual movement preset must change rendered frames, not only JSON.
 await page.selectOption('#animation-preset','fade-out');
 await page.click('#apply');
 await page.waitForFunction(()=>studio.project.animations[1].to.opacity===0);
 await page.click('#pause');
 await seek('0.5');
 assert.equal(await page.locator('[data-element-id="title"]').evaluate(e=>getComputedStyle(e).opacity),'1');
 const exitStart=await page.locator('#viewport').screenshot();
 await seek('2.5');
 assert.equal(await page.locator('[data-element-id="title"]').evaluate(e=>getComputedStyle(e).opacity),'0');
 const exitEnd=await page.locator('#viewport').screenshot();
 assert.notDeepEqual(exitStart,exitEnd,'Exit must change the actual rendered frame');
 await page.click('#save');await page.waitForFunction(()=>!studio.dirty);
 const exitProject=JSON.parse(await readFile(projectFile,'utf8'));
 assert.deepEqual(exitProject.animations[1].from,{opacity:1});
 assert.deepEqual(exitProject.animations[1].to,{opacity:0});
 await page.click('#reload');await page.waitForFunction(()=>!document.getElementById('reload').disabled);
 await seek('2.5');assert.equal(await page.locator('[data-element-id="title"]').evaluate(e=>getComputedStyle(e).opacity),'0');
 await page.selectOption('#animation-preset','slide-up');await page.click('#apply');
 await page.waitForFunction(()=>studio.project.animations[1].from.y===80);
 await page.click('#pause');await seek('0.5');
 const entryStart=await page.locator('[data-element-id="title"]').evaluate(e=>e.style.transform);
 await seek('2.5');
 assert.notEqual(await page.locator('[data-element-id="title"]').evaluate(e=>e.style.transform),entryStart);
 assert.equal(await page.locator('[data-element-id="title"]').evaluate(e=>getComputedStyle(e).opacity),'1');
 await page.click('#save');await page.waitForFunction(()=>!studio.dirty);
 // Programmatic form tools may dispatch change instead of input; actions still read the form.
 await page.locator('#element-content').evaluate(e=>{e.value='ذخیره با رویداد change';e.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.click('#save');await page.waitForFunction(()=>!studio.dirty);
 assert.equal(JSON.parse(await readFile(projectFile,'utf8')).elements[1].content,'ذخیره با رویداد change');
 // Reload cancellation retains draft edits.
 await page.fill('#element-content','پیش‌نویس');
 page.once('dialog',dialog=>dialog.dismiss());await page.click('#reload');
 assert.equal(await page.inputValue('#element-content'),'پیش‌نویس');
 // A separate tab or external writer wins; stale editor must not overwrite it.
 const current=await page.request.get(base+'/projects/demo.json');
 const other=await current.json();other.title='تغییر از تب دیگر';
 assert.equal((await page.request.put(base+'/api/project',{data:{project:other,revision:current.headers().etag.replaceAll('"','')}})).status(),200);
 await page.click('#save');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('فایل پروژه تغییر کرده'));
 assert.equal(JSON.parse(await readFile(projectFile,'utf8')).title,'تغییر از تب دیگر');
 assert.equal(await page.evaluate(()=>studio.dirty),true);
 page.once('dialog',dialog=>dialog.accept());await page.click('#reload');
 await page.waitForFunction(()=>!studio.dirty);
 assert.equal(await page.locator('#project-title').textContent(),'تغییر از تب دیگر');
 // Failed reload leaves the existing preview usable.
 await page.route('**/projects/demo.json',route=>route.fulfill({status:422,body:'Invalid project'}));
 await page.click('#reload');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('HTTP 422'));
 assert.equal(await page.locator('#play').isDisabled(),false);
 await page.unroute('**/projects/demo.json');await page.click('#reload');
 await page.waitForFunction(()=>!document.getElementById('reload').disabled);
 await seek('4');await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/studio.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 // A stale running backend must disable editing and explain how to restart it.
 await page.route('**/api/status',route=>route.fulfill({status:404,body:'Old server'}));
 await page.click('#reload');await page.waitForFunction(()=>!document.getElementById('reload').disabled);
 assert.equal(await page.locator('#save').isDisabled(),true);
 assert.match(await page.locator('#server-state').textContent(),/npm start/);
 await page.unroute('**/api/status');await page.click('#reload');
 await page.waitForFunction(()=>!document.getElementById('save').disabled);
 assert.deepEqual(errors,[]);
 console.log('PASS: playback and repeatable seek; edit text/color/position/timing; preview; save and exact backup; reload persistence; invalid edit rejection; direct save; discard cancellation; conflict protection; reload failure recovery; mobile layout; no browser exceptions. Frame-zero preview replay, rendered exit/entry frames and persisted movement presets, change-event save, stale backend detection. Original demo untouched.');
} finally {
 await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(temporary,{recursive:true,force:true});
}
