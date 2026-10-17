// Optional real-browser data-safety tests; no app or installed test dependencies.
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { serve } from './support/server.mjs';
import { KEY, RECOVERY_KEY } from '../js/state.js';
import { DATA_VERSION, MAX_BACKUP_BYTES, migrateState, parseBackup, serializeBackup } from '../js/data-safety.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const v4 = JSON.parse(await readFile(new URL('./fixtures/v4-save.json', import.meta.url), 'utf8'));
let server, browser;
before(async () => {
  server = await serve();
  try { browser = await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})}); }
  catch(e) { await server.close(); throw e; }
});
after(async () => { await browser?.close(); await server?.close(); });

async function open({ width = 390, raw = JSON.stringify(migrateState(v4)), fail = null, blocked = false, reference = false } = {}) {
  const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',acceptDownloads:true,timezoneId:'America/Toronto'});
  const page = await context.newPage(), errors = [], external = [];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(!r.url().startsWith(server.url) && !/^(blob:|data:)/.test(r.url()))external.push(r.url());});
  await page.addInitScript(({raw, key, fail, blocked}) => {
    if (!sessionStorage.getItem('seeded')) {
      if(raw !== null) localStorage.setItem(key,raw);
      sessionStorage.setItem('seeded','yes');
    }
    window.savedBefore = localStorage.getItem(key);
    window.testFailKey = fail;
    const native = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k,v) {
      if(this===localStorage && (window.testFailKey===k || window.testFailKey==='*')) throw new DOMException('Storage is full','QuotaExceededError');
      return native.call(this,k,v);
    };
    if(blocked) Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});
  },{raw,key:KEY,fail,blocked});
  await page.goto(server.url + (reference ? '/reference/capstone_quest_v4.html' : '/goal-quest/'));
  await page.waitForSelector('#main h1');
  const disk = () => page.evaluate(key=>localStorage.getItem(key),KEY);
  const state = async () => JSON.parse(await disk());
  const menu = () => page.locator('.data-toolbar [data-act="data-menu"]').click();
  const upload = async raw => {
    await page.locator('#backup-file').setInputFiles({name:'Student-backup.json',mimeType:'application/json',buffer:Buffer.from(raw)});
    await page.locator('[data-act="confirm-restore"], #modalhost [role="alert"]').waitFor();
  };
  const act = name => page.locator(`#modalhost [data-act="${name}"]`).click();
  const healthy = async () => {
    assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no overflow at ${width}`);
  };
  return {context,page,disk,state,menu,upload,act,healthy};
}

for(const width of [375,390,1365]) {
  test(`full backup/import, cancellation, recovery and refresh at ${width}px`,{timeout:60000},async()=>{
    const seed = migrateState(v4);
    seed.lessons.smart = true; seed.wheel.money = 7;
    seed.preferences = {future:'keep'};
    seed.goals[0].companion = {nickname:'Glimo friend',xp:60};
    seed.goals[0].plus.future = 'keep'; seed.goals[0].woop.future = ['keep'];
    seed.draft = {step:1,category:'money',title:'My next goal',why:'',success:'',agree:'',realistic:'',date:'2026-12-01',dateType:'target',tasks:[],schedule:{},future:'keep'};
    const t=await open({width,raw:JSON.stringify(seed)});
    try {
      assert.deepEqual(await t.state(),seed);
      await t.menu();
      assert.equal(await t.page.locator('[data-initial-focus]').evaluate(e=>e===document.activeElement),true);
      const event=t.page.waitForEvent('download'); await t.act('backup');
      const download=await event;
      assert.equal(download.suggestedFilename(),'H4-Goal-Quest-Backup.json');
      const raw=await readFile(await download.path(),'utf8');
      assert.deepEqual(parseBackup(raw).state,seed);
      const target=structuredClone(seed); target.goals[0].title='<b>Restored goal</b>'; target.preferences.future='restored';
      for(const dismiss of ['cancel','escape','backdrop','close']) {
        if(dismiss!=='cancel') await t.menu();
        const before=await t.disk();
        const recoveryBefore=await t.page.evaluate(key=>localStorage.getItem(key),RECOVERY_KEY);
        await t.upload(serializeBackup(target));
        assert.equal(await t.page.locator('[data-initial-focus]').textContent(),'Cancel');
        if(dismiss==='cancel') await t.page.getByRole('button',{name:'Cancel',exact:true}).click();
        if(dismiss==='escape') await t.page.keyboard.press('Escape');
        if(dismiss==='backdrop') await t.page.locator('#backdrop').click({position:{x:1,y:1}});
        if(dismiss==='close') await t.page.getByRole('button',{name:'Close dialog'}).click();
        assert.equal(await t.disk(),before);
        assert.equal(await t.page.evaluate(key=>localStorage.getItem(key),RECOVERY_KEY),recoveryBefore);
      }
      await t.menu(); await t.upload(serializeBackup(target));
      await t.act('confirm-restore'); assert.deepEqual(await t.state(),target);
      await t.page.reload(); await t.page.waitForSelector('#main h1'); assert.deepEqual(await t.state(),target);
      await t.menu();
      await t.page.locator('#modalhost summary').click();
      const recoveryEvent=t.page.waitForEvent('download'); await t.act('download-recovery');
      const recoveryDownload=await recoveryEvent;
      assert.deepEqual(parseBackup(await readFile(await recoveryDownload.path(),'utf8')).state,seed);
      await t.act('recover-progress'); await t.act('confirm-restore'); assert.deepEqual(await t.state(),seed);
      await t.menu();
      await t.page.locator('#modalhost summary').click();
      // Focus stays inside the backup dialog in both directions.
      await t.page.getByRole('button',{name:'Close dialog'}).focus(); await t.page.keyboard.press('Shift+Tab');
      assert.equal(await t.page.evaluate(()=>document.activeElement.dataset.act),'reload-storage');
      await t.page.keyboard.press('Tab');
      assert.equal(await t.page.evaluate(()=>document.activeElement.dataset.act),'close');
      await t.healthy();
      if(width===390 || width===1365) {
        const dir=join(tmpdir(),'goal-quest-data-safety'); await mkdir(dir,{recursive:true});
        await t.page.screenshot({path:join(dir,`backups-${width}.png`),fullPage:true});
        console.log(`Backup UI screenshot: ${dir}/backups-${width}.png`);
      }
    } finally {await t.context.close();}
  });
}

test('download from the actual frozen V4 app restores after explicit partial-backup warning',{timeout:60000},async()=>{
  const source=await open({raw:JSON.stringify(v4),reference:true}); let raw;
  try {
    await source.page.locator('#bottom-nav [data-nav="goals"]').click();
    const event=source.page.waitForEvent('download'); await source.page.locator('[data-act="backup"]').click();
    raw=await readFile(await (await event).path(),'utf8');
  } finally {await source.context.close();}
  const t=await open();
  try {
    const before=await t.disk(); await t.menu(); await t.upload(raw);
    assert.match(await t.page.locator('.data-notice').textContent(),/Lessons, drafts, and settings/);
    assert.equal(await t.disk(),before);
    await t.act('confirm-restore');
    const restored=await t.state(); assert.deepEqual(restored.goals,v4.goals);
    assert.equal(restored.version,DATA_VERSION);
    const recovery=JSON.parse(await t.page.evaluate(key=>localStorage.getItem(key),RECOVERY_KEY));
    assert.equal(recovery.raw,before); await t.healthy();
  } finally {await t.context.close();}
});

test('invalid, oversized, unsafe and unsupported files leave all saved progress untouched',{timeout:60000},async()=>{
  const t=await open();
  try {
    const before=await t.disk();
    const unsafe=JSON.stringify({...v4,selected:'x" onfocus="alert(1)'});
    for(const raw of ['{bad',JSON.stringify({...v4,version:999}),unsafe,' '.repeat(MAX_BACKUP_BYTES+1)]) {
      await t.menu(); await t.upload(raw);
      assert.equal(await t.page.locator('[data-act="confirm-restore"]').count(),0);
      assert.equal(await t.disk(),before);
      assert.equal(await t.page.evaluate(key=>localStorage.getItem(key),RECOVERY_KEY),null);
      await t.page.keyboard.press('Escape');
    }
    // Cancelling the chooser (no file) cannot prepare a restore.
    await t.menu(); await t.page.locator('#backup-file').setInputFiles([]);
    assert.equal(await t.page.locator('[data-act="confirm-restore"]').count(),0);
    assert.equal(await t.disk(),before); await t.healthy();
  } finally {await t.context.close();}
});

test('file read failure and closing a dialog during a file read never stage a late restore',{timeout:60000},async()=>{
  const t=await open();
  try {
    const before=await t.disk();
    await t.page.evaluate(()=>{File.prototype.text=()=>Promise.reject(new Error('We could not read this file. Choose it again.'));});
    await t.menu(); await t.upload(serializeBackup(v4));
    assert.match(await t.page.locator('#modalhost [role="alert"]').textContent(),/could not read/);
    await t.page.keyboard.press('Escape');
    await t.page.evaluate(()=>{File.prototype.text=()=>new Promise(resolve=>{window.finishFileRead=resolve;});});
    await t.menu();
    await t.page.locator('#backup-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(serializeBackup(v4))});
    await t.page.keyboard.press('Escape');
    await t.page.evaluate(raw=>window.finishFileRead(raw),serializeBackup(v4));
    assert.equal(await t.page.locator('[data-act="confirm-restore"]').count(),0);
    assert.equal(await t.page.locator('#modalhost .modal').count(),0);
    assert.equal(await t.disk(),before);
    assert.equal(await t.page.evaluate(key=>localStorage.getItem(key),RECOVERY_KEY),null);
    await t.healthy();
  } finally {await t.context.close();}
});

test('another tab changing saved progress during preview prevents a stale restore',{timeout:60000},async()=>{
  const t=await open();
  try {
    await t.menu(); await t.upload(serializeBackup(v4));
    const other=await t.context.newPage(); await other.goto(server.url+'/goal-quest/');
    const raw=JSON.stringify({...migrateState(v4),future:'New work from another tab'});
    await other.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:KEY,raw});
    await t.act('confirm-restore');
    assert.equal(await t.disk(),raw);
    assert.match(await t.page.locator('#storage-message').textContent(),/another tab/);
    assert.equal(await t.page.evaluate(key=>localStorage.getItem(key),RECOVERY_KEY),null);
    await t.healthy();
  } finally {await t.context.close();}
});

for(const fail of [KEY,RECOVERY_KEY]) {
  test(`real localStorage ${fail} write failure keeps old progress and shows a warning`,{timeout:60000},async()=>{
    const t=await open();
    try {
      const before=await t.disk();
      await t.page.evaluate(key=>window.testFailKey=key,fail);
      await t.menu(); await t.upload(serializeBackup({...v4,preferences:{new:true}}));
      await t.act('confirm-restore');
      assert.equal(await t.disk(),before);
      assert.match(await t.page.locator('#modalhost [role="alert"]').textContent(),/Nothing was restored/);
      assert.equal(await t.page.locator('#storage-warning').isVisible(),true);
      assert.equal(await t.page.locator('#saved-status').textContent(),'⚠ Not saved');
      await t.page.keyboard.press('Escape'); await t.healthy();
    } finally {await t.context.close();}
  });
}

test('corrupt saved data remains untouched and downloadable until a confirmed restore',{timeout:60000},async()=>{
  const t=await open({raw:'{broken original'});
  try {
    assert.equal(await t.page.locator('#storage-warning').isVisible(),true);
    assert.equal(await t.disk(),'{broken original');
    for(const screen of ['week','goals','path','coach','home']) await t.page.locator(`#bottom-nav [data-nav="${screen}"]`).click();
    assert.equal(await t.disk(),'{broken original');
    await t.menu();
    await t.page.locator('#modalhost summary').click();
    const event=t.page.waitForEvent('download'); await t.act('download-original');
    assert.equal(await readFile(await (await event).path(),'utf8'),'{broken original');
    await t.upload(serializeBackup(v4)); await t.act('confirm-restore');
    assert.deepEqual((await t.state()).goals,v4.goals);
    assert.equal(JSON.parse(await t.page.evaluate(key=>localStorage.getItem(key),RECOVERY_KEY)).raw,'{broken original');
    await t.healthy();
  } finally {await t.context.close();}
});

test('blocked storage renders empty student UI with a clear persistent warning',{timeout:60000},async()=>{
  const t=await open({blocked:true});
  try {
    assert.match(await t.page.locator('#storage-message').textContent(),/Browser saving is blocked/);
    assert.equal(await t.page.locator('#main h1').textContent(),'Begin your adventure');
    await t.menu(); await t.upload(serializeBackup(v4)); await t.act('confirm-restore');
    assert.match(await t.page.locator('#modalhost [role="alert"]').textContent(),/Nothing was restored/);
    await t.healthy();
  } finally {await t.context.close();}
});

test('quota failure keeps draft exportable and never claims the draft was saved',{timeout:60000},async()=>{
  const t=await open();
  try {
    const before=await t.disk(); await t.page.evaluate(()=>window.testFailKey='*');
    await t.page.locator('#bottom-nav [data-nav="goals"]').click();
    await t.page.locator('#main [data-act="new-goal"]').click();
    await t.page.locator('[data-draft="title"]').fill('Keep my unsaved idea');
    await t.page.locator('[data-act="wizard-exit"]').click();
    assert.match(await t.page.locator('#toast').textContent(),/could not be saved/);
    assert.equal(await t.disk(),before);
    await t.menu(); const event=t.page.waitForEvent('download'); await t.act('backup');
    const backup=parseBackup(await readFile(await (await event).path(),'utf8'));
    assert.equal(backup.state.draft.title,'Keep my unsaved idea');
    await t.healthy();
  } finally {await t.context.close();}
});

test('editing SMART+ and WOOP retains compatible future nested fields',{timeout:60000},async()=>{
  const seed=migrateState(v4); seed.goals[0].plus.future={keep:true}; seed.goals[0].woop.future=['keep'];
  const t=await open({raw:JSON.stringify(seed)});
  try {
    await t.page.locator('#bottom-nav [data-nav="goals"]').click();
    await t.page.locator('[data-goal]').first().click();
    await t.page.locator('[data-lesson="smartplus"]').click();
    await t.page.locator('#plus-form [name="partner"]').fill('Someone I trust');
    await t.page.locator('#plus-form button[type="submit"]').click();
    await t.page.locator('[data-lesson="woop"]').click();
    await t.page.locator('#woop-form [name="plan"]').fill('If I get stuck, then I will ask for help.');
    await t.page.locator('#woop-form button[type="submit"]').click();
    const saved=await t.state();
    assert.deepEqual(saved.goals[0].plus.future,{keep:true}); assert.deepEqual(saved.goals[0].woop.future,['keep']);
    await t.healthy();
  } finally {await t.context.close();}
});

test('fresh student starts without demo goals; explicit demo reset is cancellable and recoverable',{timeout:60000},async()=>{
  const t=await open({raw:null});
  try {
    assert.equal((await t.state()).goals.length,0); assert.equal((await t.state()).demo,false);
    await t.page.locator('#bottom-nav [data-nav="goals"]').click(); const before=await t.disk();
    t.page.once('dialog',d=>d.dismiss()); await t.page.locator('[data-act="reset-demo"]').click();
    assert.equal(await t.disk(),before);
    t.page.once('dialog',d=>d.accept()); await t.page.locator('[data-act="reset-demo"]').click();
    assert.equal((await t.state()).goals.length,2); assert.equal((await t.state()).demo,true);
    assert.equal(JSON.parse(await t.page.evaluate(key=>localStorage.getItem(key),RECOVERY_KEY)).raw,before);
    await t.healthy();
  } finally {await t.context.close();}
});
