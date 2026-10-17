// Real service workers and offline navigation, using existing Playwright engines.
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { serve } from './support/server.mjs';
import { initial, KEY, RECOVERY_KEY, today, shift } from '../js/state.js';
import { migrateState, parseBackup } from '../js/data-safety.js';
import { gxp, stage } from '../js/companions.js';
const require=createRequire(import.meta.url), engines=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const engine=process.env.BROWSER_ENGINE || 'chromium';
let browser;
before(async()=>{
  browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{channel:process.env.BROWSER_CHANNEL || 'msedge'}:{})});
  console.log('PWA browser:',engine,await browser.version());
});
after(async()=>{await browser?.close();});
const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const assets=JSON.parse(sw.match(/const ASSETS = (\{[\s\S]*?\});/)[1]);
const digest=b=>createHash('sha256').update(b).digest('hex');
async function until(probe) {
  const end=Date.now()+15000;
  while(Date.now()<end) {if(await probe())return;await new Promise(r=>setTimeout(r,50));}
  assert.fail('Timed out waiting for service worker state');
}
function seedState() {
  const seed=migrateState(initial());seed.demo=false;seed.screen='home';seed.journal=[];
  seed.privateExtension={keep:'synthetic private offline note'};
  for(const [i,g] of seed.goals.entries()) {
    g.id=`goal-${i}`;g.goalStatus='active';g.checkins=[];g.plus.contract=false;g.woop.plan='';
    g.tasks.forEach((t,j)=>{t.id=`task-${i}-${j}`;t.due=today();t.doneAt=null;});
  }
  seed.selected=seed.goals[0].id;
  return seed;
}
async function open({base='/goal-quest/',width=390,seed=seedState(),transform}={}) {
  const server=await serve({transform});
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',timezoneId:'America/Toronto',acceptDownloads:true});
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(!r.url().startsWith(server.url)&& !/^(blob:|data:)/.test(r.url()))external.push(r.url());});
  await page.addInitScript(({seed,key})=>{
    if (!/^https?:$/.test(location.protocol)) return;
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));
  },{seed,key:KEY});
  await page.goto(server.url+base);await page.locator('#main h1').waitFor();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();await page.locator('#main h1').waitFor();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const nav=name=>page.locator(`${width<=670?'#bottom-nav':'#sidebar-nav'} [data-nav="${name}"]`).click();
  const act=name=>page.locator(`:is(#main,#modalhost) [data-act="${name}"]`).first().click();
  const state=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  const goal=async id=>{await nav('goals');await page.locator(`[data-goal="${id}"]`).click();};
  const menu=()=>page.locator('.data-toolbar [data-act="data-menu"]').click();
  const healthy=async()=>{
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('#bottom-nav [data-nav]').count(),5);
  };
  return {server,context,page,nav,act,state,goal,menu,healthy,close:async()=>{await context.close();await server.close();}};
}
for(const [base,width] of [['/',375],['/goal-quest/',1365]]) test(`offline student workflows, backup/restore and reopen at ${base} ${width}px`,{timeout:90000},async()=>{
  let disconnected=false;const networkWhileOffline=[];
  const t=await open({base,width,transform:path=>{if(disconnected){networkWhileOffline.push(path);return {status:503};}}}),{page}=t;
  try {
    const scope=await page.evaluate(async()=> (await navigator.serviceWorker.getRegistration()).scope);
    assert.equal(scope,t.server.url+base);
    const cacheInfo=await page.evaluate(async()=>{
      const keys=await caches.keys(),cache=await caches.open(keys[0]);return {keys,urls:(await cache.keys()).map(r=>r.url)};
    });
    assert.equal(cacheInfo.keys.length,1);assert.equal(cacheInfo.urls.length,Object.keys(assets).length);
    assert.ok(cacheInfo.urls.every(u=>u.startsWith(t.server.url+base)));
    if(engine==='chromium') {
      const cdp=await t.context.newCDPSession(page);
      const manifest=await cdp.send('Page.getAppManifest');assert.ok(manifest.data.includes('H4 Goal Quest'));
      await cdp.detach();
    }
    disconnected=true;await t.context.setOffline(true);
    await page.goto(t.server.url+base+'index.html?offline-test=1');await page.locator('#main h1').waitFor();
    assert.equal(await page.evaluate(()=>navigator.onLine),false);
    for(const screen of ['home','week','goals','path','coach']){await t.nav(screen);await t.healthy();}
    // Real creator and saved draft survive an offline refresh.
    await t.nav('goals');await t.act('new-goal');await page.locator('[data-draft="title"]').fill('Read five stories offline');
    await page.reload();await page.locator('[data-draft="title"]').waitFor();
    assert.equal(await page.locator('[data-draft="title"]').inputValue(),'Read five stories offline');
    await t.act('wizard-next');await page.locator('[data-draft="success"]').fill('Finish five stories');
    await page.locator('[data-draft="agree"]').selectOption('yes');await page.locator('[data-draft="realistic"]').fill('Ten minutes daily');
    await t.act('wizard-next');await page.locator('#w-action').fill('Read the first page');await t.act('w-add');await t.act('wizard-next');
    await page.locator('[data-date-task]').selectOption({index:1});await t.act('wizard-next');await t.act('wizard-next');
    const created=(await t.state()).goals.at(-1);assert.equal(created.title,'Read five stories offline');
    await t.act('edit-goal');await page.locator('#edit-form [name="title"]').fill('Read five stories');await page.locator('#edit-form > button').click();
    const xp=gxp(created),taskId=created.tasks[0].id;
    await page.locator(`[data-done="${taskId}"]`).click();
    const earned=(await t.state()).goals.at(-1);assert.equal(gxp(earned),xp+35);
    await page.locator(`[data-done="${taskId}"]`).click();await page.locator(`[data-done="${taskId}"]`).click();
    assert.equal(gxp((await t.state()).goals.at(-1)),xp+35);
    await page.locator(`[data-move="${taskId}"]`).click();await page.locator('#move-form [name="date"]').fill(shift(today(),2));await page.locator('#move-form > button').click();
    await t.act('customize-companion');await page.getByLabel('Nickname (optional)').fill('Offline Nova');
    await page.getByLabel('Accessory',{exact:true}).selectOption('scarf');await page.locator('#companion-form [type="submit"]').click();
    await page.locator('[data-lesson="smartplus"]').click();
    await page.locator('[name="primer"]').fill('My offline reading notebook');await page.locator('[name="contract"]').check();await page.locator('#plus-form > button').click();
    await page.locator('[data-lesson="woop"]').click();
    for(const [name,value] of Object.entries({wish:'Read stories',opportunity:'Enjoy new ideas',obstacle:'Distractions',plan:'If distracted, then read one page'})) await page.locator(`[name="${name}"]`).fill(value);
    await page.locator('#woop-form > button').click();
    await t.act('evidence');await page.locator('[name="text"]').fill('I practised without internet');await page.locator('#evidence-form > button').click();
    await t.act('park-goal');assert.equal((await t.state()).goals.at(-1).goalStatus,'parked');await t.act('activate-goal');
    await t.nav('home');await t.act('checkin');await page.locator('[name="note"]').fill('Offline reflection');await page.locator('#checkin-form > button').click();
    await t.nav('path');await page.locator('[data-lesson="smart"]').click();await t.act('learn-done');
    await t.nav('path');await page.locator('[data-lesson="wheel"]').click();
    await page.locator('[data-wheel]').first().fill('7');await t.act('wheel-finish');
    await t.nav('coach');await page.locator('[data-prompt-view]').first().click();assert.ok(await page.locator('#modalhost textarea').inputValue());await page.keyboard.press('Escape');
    // Start near an evolution threshold, then earn once and preserve that form.
    await t.goal('goal-0');
    for(const task of (await t.state()).goals[0].tasks.slice(0,5)) {
      await page.locator(`[data-done="${task.id}"]`).click();if(await page.locator('#companion-heading').count())await page.keyboard.press('Escape');
    }
    assert.equal(stage((await t.state()).goals[0]),2);
    await t.goal(created.id);await t.act('achieve-goal');await page.locator('[name="reflection"]').fill('Finished the stories');await page.locator('[name="howKnow"]').fill('My reading journal lists five');await page.locator('#achieve-goal-form [type="submit"]').click();await t.act('view-achievements');
    assert.match(await page.locator('#hall-achievements').textContent(),/Offline Nova/);
    await t.nav('week');await page.locator('[data-minutes="5"]').click();await t.act('timer-toggle');
    const deadline=(await t.state()).focus.deadline;await page.reload();assert.equal((await t.state()).focus.deadline,deadline);
    await t.act('timer-toggle');assert.equal((await t.state()).focus.status,'paused');
    const saved=await t.state();await t.menu();const event=page.waitForEvent('download');await t.act('backup');
    const raw=await readFile(await (await event).path(),'utf8');assert.deepEqual(parseBackup(raw).state,saved);
    await page.locator('#backup-file').setInputFiles({name:'offline.json',mimeType:'application/json',buffer:Buffer.from(raw)});await t.act('confirm-restore');
    assert.deepEqual(await t.state(),saved);assert.ok(await page.evaluate(key=>localStorage.getItem(key),RECOVERY_KEY));
    await page.reload();assert.deepEqual(await t.state(),saved);await t.healthy();
    // Close the actual client, then reopen in the same isolated profile offline.
    await page.goto('about:blank');await page.goto(t.server.url+base);await page.locator('#main h1').waitFor();assert.deepEqual(await t.state(),saved);
    // Chromium's browser-process worker update check can bypass Playwright's
    // page offline flag. The server rejects it too; no shell file uses network.
    assert.deepEqual(networkWhileOffline.filter(p=>p!=='/sw.js'),[],'offline shell/interactions make no network requests');
    const cachedText=await page.evaluate(async()=>{
      const cache=await caches.open((await caches.keys())[0]);return Promise.all((await cache.keys()).filter(r=>/\.(html|js|css)$/.test(r.url)).map(async r=>(await cache.match(r)).text()));
    });
    assert.ok(!cachedText.join('').includes('synthetic private offline note'));
    const dir=process.env.PWA_SCREENSHOT_DIR || join(tmpdir(),'goal-quest-pwa');await mkdir(dir,{recursive:true});
    await page.waitForFunction(()=>document.querySelector('[data-act="pwa-help"]').textContent.includes('ready'));
    await page.locator('[data-act="pwa-help"]').click();await page.screenshot({path:join(dir,`${width}-offline-help.png`),fullPage:true});await t.healthy();
  } finally {await t.close();}
});

test('failed updates keep old shell; verified update waits for every window and preserves forms, timer and progress',{timeout:90000},async()=>{
  let mode='old';
  const newCSS=Buffer.concat([await readFile(new URL('../styles.css',import.meta.url)),Buffer.from('\n/* verified-next-release */')]);
  const t=await open({transform:(path,body)=>{
    if(path==='/sw.js' && mode!=='old')return {body:Buffer.from(sw.replace(/const RELEASE = '[^']+'/,`const RELEASE = '${mode}'`).replace(assets['./styles.css'],digest(newCSS)))};
    if(path==='/styles.css' && mode!=='old') return mode==='missing'?{status:404}:{body:mode==='corrupt'?Buffer.from('incomplete'):newCSS};
  }}),{page}=t;
  try {
    const oldKeys=await page.evaluate(()=>caches.keys());
    for(const failed of ['missing','corrupt']) {
      mode=failed;
      await page.evaluate(async()=>{
        const r=await navigator.serviceWorker.getRegistration();
        const done=new Promise(resolve=>r.addEventListener('updatefound',()=>{
          const w=r.installing;w.addEventListener('statechange',()=>{if(w.state==='redundant')resolve();});
        },{once:true}));await r.update();await done;
      });
      assert.deepEqual(await page.evaluate(()=>caches.keys()),oldKeys);
      await t.context.setOffline(true);await page.reload();await page.locator('#main h1').waitFor();await t.context.setOffline(false);
    }
    await t.nav('week');await t.act('timer-toggle');const deadline=(await t.state()).focus.deadline;
    await t.goal('goal-0');await t.act('edit-goal');await page.locator('[name="title"]').fill('Still editing while update waits');
    const second=await t.context.newPage();await second.goto(t.server.url+'/goal-quest/');await second.locator('#main h1').waitFor();
    mode='next';await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
    await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
    await page.waitForFunction(()=>document.querySelector('#pwa-notice').textContent.includes('update is ready'));
    assert.equal(await page.locator('[name="title"]').inputValue(),'Still editing while update waits');
    assert.equal((await t.state()).focus.deadline,deadline);
    assert.equal((await page.evaluate(()=>caches.keys())).length,2);
    assert.ok(!(await page.evaluate(async()=> (await fetch('./styles.css').then(r=>r.text())))).includes('verified-next-release'));
    await page.locator('#edit-form > button').click();const saved=await t.state();
    await page.reload();assert.equal(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),true,'refresh does not force activation');
    await second.close();
    const nextWorker=t.context.serviceWorkers().find(w=>w!==t.context.serviceWorkers()[0]) || t.context.serviceWorkers().at(-1);
    await page.goto('about:blank');
    await until(async()=>{try{return await nextWorker.evaluate(()=>self.registration.active?.state==='activated' && !self.registration.waiting);}catch{return false;}});
    await page.goto(t.server.url+'/goal-quest/');await page.locator('#main h1').waitFor();
    assert.deepEqual((await t.state()).goals,saved.goals);assert.equal((await t.state()).focus.deadline,deadline);
    assert.ok((await page.evaluate(async()=>fetch('./styles.css').then(r=>r.text()))).includes('verified-next-release'));
    assert.equal((await page.evaluate(()=>caches.keys())).length,1);
    await t.context.setOffline(true);await page.reload();await page.locator('#main h1').waitFor();await t.healthy();
  } finally {await t.close();}
});

test('offline storage failure retains unsaved progress in downloaded backup without changing saved bytes',{timeout:60000},async()=>{
  const t=await open(),{page}=t;
  try {
    await t.context.setOffline(true);const before=await page.evaluate(key=>localStorage.getItem(key),KEY);
    await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});
    await t.goal('goal-0');await t.act('edit-goal');await page.locator('[name="title"]').fill('Unsaved offline change');await page.locator('#edit-form > button').click();
    assert.equal(await page.locator('#storage-warning').isVisible(),true);assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),before);
    await t.menu();const event=page.waitForEvent('download');await t.act('backup');const raw=await readFile(await (await event).path(),'utf8');
    assert.equal(parseBackup(raw).state.goals[0].title,'Unsaved offline change');await t.healthy();
  } finally {await t.close();}
});

test('unavailable service worker leaves browser workflows and backup access usable',{timeout:60000},async()=>{
  const server=await serve(),context=await browser.newContext(),page=await context.newPage();
  try {
    await page.addInitScript(()=>{navigator.serviceWorker.register=async()=>{throw new DOMException('Blocked','SecurityError');};});
    await page.goto(server.url+'/goal-quest/');await page.locator('#main h1').waitFor();
    await page.waitForFunction(()=>!document.querySelector('#pwa-notice').hidden);
    assert.match(await page.locator('#pwa-notice').textContent(),/could not finish/);
    await page.locator('#sidebar-nav [data-nav="goals"]').click();await page.locator('.data-toolbar [data-act="data-menu"]').click();
    assert.equal(await page.locator('[data-act="backup"]').isVisible(),true);
  } finally {await context.close();await server.close();}
});

test('browser cache quota failure leaves the online app usable with an honest setup warning',{timeout:60000,skip:engine!=='chromium'},async()=>{
  const server=await serve(),context=await browser.newContext(),page=await context.newPage();
  try {
    const cdp=await context.newCDPSession(page);
    await cdp.send('Storage.overrideQuotaForOrigin',{origin:server.url,quotaSize:1});
    await page.goto(server.url+'/goal-quest/');await page.locator('#main h1').waitFor();
    await page.waitForFunction(()=>document.querySelector('#pwa-notice').textContent.includes('could not finish'));
    assert.equal(await page.evaluate(()=>caches.keys()).then(keys=>keys.length),0,'failed staging cache is removed');
    await page.locator('#sidebar-nav [data-nav="goals"]').click();
    await page.locator('.data-toolbar [data-act="data-menu"]').click();assert.ok(await page.locator('[data-act="backup"]').isVisible());
    await cdp.send('Storage.overrideQuotaForOrigin',{origin:server.url});
  } finally {await context.close();await server.close();}
});

test('Chromium installability diagnostics pass at root and project URL in a disposable regular profile',{timeout:60000,skip:engine!=='chromium'},async()=>{
  const server=await serve(),profile=await mkdtemp(join(tmpdir(),'h4-pwa-install-'));
  let context;
  try {
    context=await engines.chromium.launchPersistentContext(profile,{headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
    const page=await context.newPage(),cdp=await context.newCDPSession(page);
    for(const base of ['/goal-quest/','/']) {
      await page.goto(server.url+base);await page.locator('#main h1').waitFor();
      await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
      const manifest=await cdp.send('Page.getAppManifest');assert.ok(manifest.data.includes('H4 Goal Quest'));
      assert.deepEqual((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors,[],base);
    }
  } finally {
    await context?.close();await server.close();
    // Delete only the freshly created, task-specific directory inside temp.
    assert.ok(resolve(profile).startsWith(resolve(tmpdir())+sep) && basename(profile).startsWith('h4-pwa-install-'));
    await rm(profile,{recursive:true,force:true});
  }
});

const release=sw.match(/const RELEASE = '([^']+)'/)[1];
const cacheName=base=>`h4-goal-quest-shell:${base}:${release}`;
async function evict(page,base,paths) {
  await page.evaluate(async({name,paths,base})=>{
    const cache=await caches.open(name);
    for(const path of paths)await cache.delete(new URL(base+path,location.origin).href);
  },{name:cacheName(base),base,paths});
}
async function snapshot(page) {
  return page.evaluate(async()=>{
    const result={};
    for(const name of (await caches.keys()).sort()) {
      const cache=await caches.open(name),files={};
      for(const request of await cache.keys()) {
        const hash=await crypto.subtle.digest('SHA-256',await (await cache.match(request)).arrayBuffer());
        files[request.url]=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
      }
      result[name]=files;
    }
    return result;
  });
}
async function backupAndGuard(t,base) {
  await t.menu();const event=t.page.waitForEvent('download');await t.act('backup');
  const raw=await readFile(await (await event).path(),'utf8');
  await t.page.locator('#backup-file').setInputFiles({name:'preserve.json',mimeType:'application/json',buffer:Buffer.from(raw)});await t.act('confirm-restore');
  // A complete, valid previous cache must also survive every repair attempt.
  await t.page.evaluate(async name=>{
    const cache=await caches.open(name),previous=await caches.open(name+'-previous');
    for(const request of await cache.keys())await previous.put(request,await cache.match(request));
  },cacheName(base));
  const disk=()=>t.page.evaluate(({key,recovery})=>({primary:localStorage.getItem(key),recovery:localStorage.getItem(recovery)}),{key:KEY,recovery:RECOVERY_KEY});
  return {disk,before:await disk(),state:parseBackup(raw).state,caches:await snapshot(t.page)};
}
for(const base of ['/','/goal-quest/']) {
  test(`lost index/module fail offline, recover on reconnect and share simultaneous downloads at ${base}`,{timeout:60000},async()=>{
    let offline=false,gate,heldPath;const requests=[];
    const t=await open({base,transform:async path=>{
      requests.push(path);if(offline)return {status:503};if(path===heldPath)await gate;
    }}),{page}=t;
    let releaseDownload;
    try {
      const guard=await backupAndGuard(t,base);
      const keeper=await t.context.newPage();await keeper.goto(t.server.url+base);await keeper.locator('#main h1').waitFor();
      await evict(keeper,base,['index.html','js/planner.js']);
      offline=true;await t.context.setOffline(true);
      await assert.rejects(page.reload(),/ERR_|NS_ERROR|Load failed|Navigation/);
      assert.equal(await keeper.evaluate(async url=>fetch(url).then(()=>false,()=>true),t.server.url+base+'js/planner.js'),true);
      const missing=await snapshot(keeper);assert.equal(Object.keys(missing[cacheName(base)]).length,Object.keys(assets).length-2);
      offline=false;await t.context.setOffline(false);
      await page.goto(t.server.url+base);await page.locator('#main h1').waitFor();
      await page.waitForFunction(()=>document.querySelector('[data-act="pwa-help"]').textContent.includes('ready'));
      assert.deepEqual(await snapshot(keeper),guard.caches,'exact files repaired; every other cached byte retained');
      assert.deepEqual(await guard.disk(),guard.before);
      // Force overlap at the server; all eight fetch bodies must be independently readable.
      await evict(keeper,base,['js/planner.js']);heldPath='/js/planner.js';
      gate=new Promise(resolve=>{releaseDownload=resolve;});const count=requests.filter(p=>p===heldPath).length;
      const responses=keeper.evaluate(async url=>Promise.all(Array.from({length:8},async()=>await (await fetch(url)).text())),t.server.url+base+'js/planner.js');
      await until(()=>requests.filter(p=>p===heldPath).length>count);
      await new Promise(resolve=>setTimeout(resolve,100));
      assert.equal(requests.filter(p=>p===heldPath).length,count+1);
      releaseDownload();heldPath=null;
      for(const body of await responses)assert.equal(digest(body),assets['./js/planner.js']);
      assert.deepEqual(await snapshot(keeper),guard.caches);
      offline=true;await t.context.setOffline(true);await page.reload();await page.locator('#main h1').waitFor();
      assert.deepEqual(await guard.disk(),guard.before);assert.deepEqual(await t.state(),guard.state);
      await t.menu();const downloaded=page.waitForEvent('download');await t.act('backup');
      assert.deepEqual(parseBackup(await readFile(await (await downloaded).path(),'utf8')).state,guard.state);
    } finally {releaseDownload?.();await t.close();}
  });

  test(`mismatched newer release and failed recovery never replace existing caches or student data at ${base}`,{timeout:60000},async()=>{
    let mode='good',target;const t=await open({base,transform:path=>{
      if(path!==target)return;
      if(mode==='mismatch')return {body:Buffer.from('globalThis.unverifiedNewerRelease = true;')};
      if(mode==='missing')return {status:404};
    }}),{page}=t;
    try {
      const guard=await backupAndGuard(t,base);
      for(const path of ['index.html','js/planner.js']) {
        target='/'+path;await evict(page,base,[path]);const before=await snapshot(page);
        for(const failure of ['mismatch','missing']) {
          mode=failure;
          assert.equal(await page.evaluate(async url=>fetch(url).then(()=>false,()=>true),t.server.url+base+path),true);
          assert.deepEqual(await snapshot(page),before);assert.deepEqual(await guard.disk(),guard.before);
        }
        mode='good';const body=await page.evaluate(async url=>(await fetch(url)).text(),t.server.url+base+path);
        assert.equal(digest(body),assets['./'+path]);assert.deepEqual(await snapshot(page),guard.caches);
      }
      await page.reload();await page.locator('#main h1').waitFor();assert.deepEqual(await guard.disk(),guard.before);
    } finally {await t.close();}
  });

  test(`repair quota failure keeps verified online use, reports incomplete offline files and retries at ${base}`,{timeout:60000,skip:engine!=='chromium'},async()=>{
    const t=await open({base}),{page}=t;
    try {
      const guard=await backupAndGuard(t,base),keeper=await t.context.newPage();
      await keeper.goto(t.server.url+base);await keeper.locator('#main h1').waitFor();
      await evict(keeper,base,['index.html','js/planner.js']);const before=await snapshot(keeper);
      const cdp=await t.context.newCDPSession(page);await cdp.send('Storage.overrideQuotaForOrigin',{origin:t.server.url,quotaSize:1});
      await page.reload();await page.locator('#main h1').waitFor();
      await page.waitForFunction(()=>document.querySelector('#pwa-notice').textContent.includes('Some offline files'));
      assert.equal(await page.locator('#pwa-notice').isVisible(),true);
      assert.ok(!(await page.locator('[data-act="pwa-help"]').textContent()).includes('ready'));
      assert.deepEqual(await snapshot(keeper),before);assert.deepEqual(await guard.disk(),guard.before);
      await t.menu();const event=page.waitForEvent('download');await t.act('backup');
      assert.deepEqual(parseBackup(await readFile(await (await event).path(),'utf8')).state,guard.state);
      await t.context.setOffline(true);await assert.rejects(page.reload(),/ERR_|NS_ERROR|Load failed|Navigation/);
      assert.deepEqual(await snapshot(keeper),before);
      await cdp.send('Storage.overrideQuotaForOrigin',{origin:t.server.url});await t.context.setOffline(false);
      await page.goto(t.server.url+base);await page.locator('#main h1').waitFor();
      await page.waitForFunction(()=>document.querySelector('[data-act="pwa-help"]').textContent.includes('ready'));
      assert.deepEqual(await snapshot(keeper),guard.caches);
      await t.context.setOffline(true);await page.reload();await page.locator('#main h1').waitFor();assert.deepEqual(await guard.disk(),guard.before);
    } finally {await t.close();}
  });
}
