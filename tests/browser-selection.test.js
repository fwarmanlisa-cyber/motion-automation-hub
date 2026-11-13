import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findBrowser} from '../packages/renderer/browser.js';
test('Windows uses installed Chrome without downloading Chromium',()=>{
 const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
 assert.equal(findBrowser({platform:'win32',env:{PROGRAMFILES:'C:\\Program Files'},exists:p=>p===chrome,bundled:'missing'}),chrome);
});
test('Windows falls back to Edge and supports per-user installs',()=>{
 const edge='C:\\Users\\user\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe';
 assert.equal(findBrowser({platform:'win32',env:{LOCALAPPDATA:'C:\\Users\\user\\AppData\\Local'},exists:p=>p===edge,bundled:'missing'}),edge);
});
test('explicit browser path takes precedence and invalid overrides fail clearly',()=>{
 assert.equal(findBrowser({explicit:'custom.exe',exists:()=>true}),'custom.exe');
 assert.throws(()=>findBrowser({explicit:'bad.exe',exists:()=>false}),/CHROMIUM_PATH/);
});
test('bundled browser remains a fallback and missing browsers explain the alternative',()=>{
 assert.equal(findBrowser({platform:'win32',env:{},exists:p=>p==='bundled',bundled:'bundled'}),'bundled');
 assert.throws(()=>findBrowser({platform:'win32',env:{},exists:()=>false,bundled:'missing'}),/Chrome\/Edge/);
});
