import {existsSync} from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
// Pure selection is separately testable for Windows even on a Linux worker.
export function findBrowser({explicit,env=process.env,platform=process.platform,exists=existsSync,bundled=chromium.executablePath()}={}) {
  if(explicit){if(!exists(explicit))throw new Error('CHROMIUM_PATH does not exist: '+explicit);return explicit;}
  const paths=[];
  if(platform==='win32'){
    for(const base of [env.PROGRAMFILES,env['PROGRAMFILES(X86)'],env.LOCALAPPDATA].filter(Boolean)){
      paths.push(path.win32.join(base,'Google/Chrome/Application/chrome.exe'),path.win32.join(base,'Microsoft/Edge/Application/msedge.exe'));
    }
  }else if(platform==='darwin')paths.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  else paths.push('/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/opt/google/chrome/chrome');
  paths.push(bundled);
  const found=paths.find(p=>p && exists(p));
  if(!found)throw new Error('No compatible browser found. Use installed Chrome/Edge or set CHROMIUM_PATH to its executable; a separate Chromium download is not required.');
  return found;
}
export function launchBrowser({executablePath=process.env.CHROMIUM_PATH,...options}={}){
  return chromium.launch({headless:true,...options,executablePath:findBrowser({explicit:executablePath})});
}
