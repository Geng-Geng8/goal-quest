// Uses the supplied Playwright runtime; no install or app dependency.
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { serve } from './support/server.mjs';
import { initial, KEY } from '../js/state.js';
import { migrateState } from '../js/data-safety.js';
const require = createRequire(import.meta.url);
const engines = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const engine = process.env.BROWSER_ENGINE || 'chromium';
let browser, server;
before(async () => {
  server = await serve();
  browser = await engines[engine].launch({headless:true,...(engine === 'chromium' ? {channel:process.env.BROWSER_CHANNEL || 'msedge'} : {})});
});
after(async () => { await browser?.close(); await server?.close(); });
async function open({width=390,height=900,seed=migrateState(initial()),time='2026-10-17T16:00:00Z',timezoneId='America/Toronto',blocked=false}={}) {
  const context = await browser.newContext({viewport:{width,height},timezoneId,reducedMotion:'reduce',acceptDownloads:true});
  const page = await context.newPage(), errors=[], requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(!r.url().startsWith(server.url) && !/^(blob:|data:)/.test(r.url())) requests.push(r.url());});
  await page.clock.install({time:new Date(time)}); await page.clock.pauseAt(new Date(time));
  await page.addInitScript(({seed,key,blocked})=>{
    if(!sessionStorage.getItem('seeded')) { localStorage.setItem(key,JSON.stringify(seed));sessionStorage.setItem('seeded','yes'); }
    if(blocked) Storage.prototype.setItem=function(){throw new DOMException('Blocked','QuotaExceededError');};
  },{seed,key:KEY,blocked});
  await page.goto(server.url+'/goal-quest/');
  try { await page.waitForSelector('#main h1'); }
  catch(error) { await context.close(); throw new Error(error.message+'; browser errors: '+JSON.stringify(errors)); }
  const nav = name => page.locator(`${width<=670?'#bottom-nav':'#sidebar-nav'} [data-nav="${name}"]`).click();
  const act = name => page.locator(`:is(#main,#modalhost) [data-act="${name}"]`).first().click();
  const state = () => page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  async function healthy() {
    assert.deepEqual(errors,[]); assert.deepEqual(requests,[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');
    const missing = await page.locator('input,select,textarea').evaluateAll(controls=>controls.filter(e=>
      !e.labels?.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).map(e=>e.outerHTML));
    assert.deepEqual(missing,[],'all fields have programmatic names');
    const duplicateIds=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i);});
    assert.deepEqual(duplicateIds,[]);
  }
  return {page,context,nav,act,state,healthy};
}
async function trap(page) {
  assert.equal(await page.locator('.app').evaluate(e=>e.inert),true);
  const controls=page.locator('.modal').locator('button,input,select,textarea,summary,a[href]').filter({visible:true});
  await controls.first().focus(); await page.keyboard.press('Shift+Tab');
  assert.equal(await controls.last().evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Tab'); assert.equal(await controls.first().evaluate(e=>e===document.activeElement),true);
}
for (const [width,height] of [[320,900],[375,900],[390,900],[430,900],[768,1024],[1365,900],[844,390]]) {
  test(`five tabs, labelled dialogs, touch targets and reduced motion at ${width}×${height}`,{timeout:60000},async()=>{
    const t=await open({width,height}); const {page,nav,act}=t;
    try {
      for(const screen of ['home','week','goals','path','coach']) {
        await nav(screen); await t.healthy();
        assert.equal(await page.locator(`${width<=670?'#bottom-nav':'#sidebar-nav'} [aria-current="page"]`).count(),1);
      }
      await nav('week'); await act('add-task'); await t.healthy(); await trap(page);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#main [data-act="add-task"]').evaluate(e=>e===document.activeElement),true);
      await nav('home'); await act('checkin');
      await t.healthy(); await trap(page); await page.keyboard.press('Escape');
      await act('partner'); await t.healthy(); await trap(page); await page.keyboard.press('Escape');
      await nav('goals'); await page.locator('.goalcard').first().click();
      for(const action of ['edit-goal','evidence','customize-companion','evolution','achieve-goal']) {
        await act(action); await t.healthy(); await trap(page); await page.keyboard.press('Escape');
        assert.equal(await page.locator(`#main [data-act="${action}"]`).evaluate(e=>e===document.activeElement),true);
      }
      await nav('path');
      for(const lesson of ['wheel','smart','smartplus','woop','planner','partner']) {
        await page.locator(`[data-lesson="${lesson}"]`).click();await t.healthy();await trap(page);await page.keyboard.press('Escape');
      }
      await nav('coach');await page.locator('[data-prompt-view]').first().click();await t.healthy();await page.keyboard.press('Escape');
      await page.locator('.data-toolbar button').click();await t.healthy();await trap(page);await page.keyboard.press('Escape');
      await nav('home');
      const smallTargets=await page.locator('#main button').evaluateAll(buttons=>buttons.filter(b=>{const r=b.getBoundingClientRect();return r.height<44||r.width<24;}).map(b=>b.outerHTML));
      assert.deepEqual(smallTargets,[]);
      assert.equal(await page.locator('.hero .mascot').evaluate(e=>getComputedStyle(e).animationName),'none');
      const dir=process.env.STABILITY_SCREENSHOT_DIR||join(tmpdir(),'goal-quest-stability');await mkdir(dir,{recursive:true});
      await page.screenshot({path:join(dir,`${width}-${height}-today.png`),fullPage:true,animations:'disabled'});
      await nav('goals'); await act('new-goal');
      await page.locator('[data-draft="title"]').fill('Read a short story');await act('wizard-next');await t.healthy();
      await page.locator('[data-draft="success"]').fill('Finish and discuss the story');
      await page.locator('[data-draft="agree"]').selectOption('yes');
      await page.locator('[data-draft="realistic"]').fill('Read ten minutes daily');await act('wizard-next');
      await page.locator('#w-action').fill('Read the first page');await act('w-add');await t.healthy();await act('wizard-next');
      await page.locator('[data-date-task]').selectOption({index:1});await act('wizard-next');await t.healthy();
      await page.screenshot({path:join(dir,`${width}-${height}-creator.png`),fullPage:true,animations:'disabled'});
      await act('wizard-next');assert.equal((await t.state()).goals.length,3);await t.healthy();
    } finally {await t.context.close();}
  });
}
test('keyboard alone creates a SMART goal and first action with inline validation and retained focus',{timeout:60000},async()=>{
  const seed=migrateState(initial());seed.goals=[];seed.selected=null;
  const t=await open({seed});const {page}=t;
  // Find controls by tabbing through the real focus order, then activate natively.
  async function keyTo(selector) {
    for(let i=0;i<100;i++) {
      if(await page.locator(selector).evaluate(e=>e===document.activeElement))return;
      await page.keyboard.press('Tab');
    }
    assert.fail('Keyboard could not reach '+selector);
  }
  async function press(selector) {await keyTo(selector);await page.keyboard.press('Enter');}
  try {
    await press('#main [data-act="new-goal"]');await press('[data-act="wizard-next"]');
    assert.match(await page.locator('#wizard-error').textContent(),/goal idea/);
    assert.equal(await page.locator('#w-title').getAttribute('aria-invalid'),'true');
    await page.keyboard.type('Read five books');await press('[data-act="wizard-next"]');await t.healthy();
    await press('[data-act="wizard-next"]');
    assert.equal(await page.locator('[data-draft="success"]').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.type('Finish five books and discuss them');
    await keyTo('[data-draft="agree"]');await page.keyboard.press('ArrowDown');
    await keyTo('[data-draft="realistic"]');await page.keyboard.type('Read ten minutes a day');
    await press('[data-act="wizard-next"]');await t.healthy();
    await keyTo('#w-action');await page.keyboard.type('Read chapter one');await page.keyboard.press('Enter');
    await press('[data-act="wizard-next"]');await t.healthy();
    await press('[data-act="wizard-next"]');assert.match(await page.locator('#wizard-error').textContent(),/schedule/);
    await keyTo('[data-date-task]');await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');
    await press('[data-act="wizard-next"]');await press('[data-act="wizard-next"]');
    assert.equal((await t.state()).goals.length,1);assert.equal((await t.state()).goals[0].tasks[0].title,'Read chapter one');
    await t.healthy();
  } finally {await t.context.close();}
});
test('200%/400% desktop reflow equivalents retain navigation, forms and scrolling',{timeout:60000},async()=>{
  // A 1365px desktop at these zoom levels has approximately 683px/341px CSS width.
  // Actual browser zoom and physical device keyboards remain manual checks.
  for(const width of [683,341]) {
    const t=await open({width,height:450});
    try {
      for(const screen of ['home','week','goals','path','coach']) {await t.nav(screen);await t.healthy();}
      await t.nav('week');await t.act('add-task');await t.healthy();await trap(t.page);
      await t.page.getByLabel('What will you actually do?').fill('Reflow test');
      await t.page.locator('#task-form button').click();await t.healthy();
    } finally {await t.context.close();}
  }
});
test('text contrast and focus indicators on representative light/dark controls',{timeout:60000},async()=>{
  const t=await open();const {page}=t;
  const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  try {
    const pairs=await page.locator('.taskmeta,.task.done .tasktitle,.metric span,.lead,.daytile,.savepill,.bottomnav button,.eyebrow,.hint').evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length && !e.closest('.hero,.companion')).map(e=>{
      const fg=getComputedStyle(e).color;
      let p=e,bg='';while(p){const s=getComputedStyle(p);if(s.backgroundColor!=='rgba(0, 0, 0, 0)'){bg=s.backgroundColor;break;}p=p.parentElement;}
      return {fg,bg,text:e.textContent};
    }));
    for(const pair of pairs) {
      const fg=luminance(pair.fg.match(/[\d.]+/g).slice(0,3).map(Number));
      const bg=luminance(pair.bg.match(/[\d.]+/g).slice(0,3).map(Number));
      assert.ok((Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)>=4.5,JSON.stringify(pair));
    }
    await page.keyboard.press('Tab');assert.equal(await page.locator('.skip-link').evaluate(e=>e===document.activeElement),true);
    const focus=await page.locator('.skip-link').evaluate(e=>({width:getComputedStyle(e).outlineWidth,style:getComputedStyle(e).outlineStyle}));
    assert.equal(focus.style,'solid');assert.equal(focus.width,'3px');
    await page.keyboard.press('Enter');assert.equal(await page.locator('#main').evaluate(e=>e===document.activeElement),true);
  } finally {await t.context.close();}
});
test('timer deadline survives navigation, pause, reload, suspended callbacks and completion exactly once',{timeout:60000},async()=>{
  const t=await open();const {page,nav,act,state}=t;
  try {
    const goals=(await state()).goals;
    await nav('week');await page.locator('[data-minutes="5"]').click();await act('timer-toggle');
    await page.clock.runFor(1234);await act('timer-toggle');
    const paused=(await state()).focus;
    await page.reload();await page.clock.runFor(60000);assert.equal((await state()).focus.remainingMs,paused.remainingMs);
    assert.equal(await page.locator('#timer-toggle').textContent(),'Resume focus');
    await act('timer-toggle');await nav('coach');await page.clock.setSystemTime(new Date('2026-10-17T16:10:00Z'));
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    assert.equal((await state()).focus.status,'complete');assert.match(await page.locator('#toast').textContent(),/Session complete/);
    await nav('week');assert.equal(await page.locator('#timer-display').textContent(),'00:00');
    assert.equal(await page.locator('#timer-toggle').isDisabled(),true);
    await page.evaluate(()=>document.querySelector('#toast').textContent='sentinel');
    await page.evaluate(()=>{window.dispatchEvent(new Event('pageshow'));document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await page.locator('#toast').textContent(),'sentinel');
    await page.reload();assert.equal(await page.locator('#timer-status').textContent(),'Session complete · 5-minute break');
    await act('timer-reset');assert.equal(await page.locator('#timer-display').textContent(),'05:00');
    await act('timer-toggle');await page.clock.runFor(2000);await page.reload();assert.equal(await page.locator('#timer-display').textContent(),'04:58');
    assert.deepEqual((await state()).goals,goals);await t.healthy();
  } finally {await t.context.close();}
});
test('running timer backup restore replaces old interval and storage failure remains exportable',{timeout:60000},async()=>{
  const t=await open();const {page,nav,act}=t;
  try {
    await nav('week');await act('timer-toggle');
    await page.locator('.data-toolbar button').click();
    const download=page.waitForEvent('download');await act('backup');const backup=await download;
    const raw=await readFile(await backup.path(),'utf8');
    assert.equal(JSON.parse(raw).state.focus.status,'running');
    await page.keyboard.press('Escape');await page.locator('[data-minutes="5"]').click();
    await page.locator('.data-toolbar button').click();await page.locator('#backup-file').setInputFiles({name:'timer.json',mimeType:'application/json',buffer:Buffer.from(raw)});
    await act('confirm-restore');assert.equal(await page.locator('#timer-display').textContent(),'25:00');
    await page.clock.runFor(2000);assert.equal(await page.locator('#timer-display').textContent(),'24:58');
    await page.evaluate(()=>Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError');});
    await act('timer-toggle');assert.equal(await page.locator('#storage-warning').isVisible(),true);
    await page.locator('.data-toolbar button').click();const unsaved=page.waitForEvent('download');await act('backup');
    assert.equal(JSON.parse(await readFile(await (await unsaved).path(),'utf8')).state.focus.status,'paused');
    await t.healthy();
  } finally {await t.context.close();}
});
test('return across local midnight refreshes planner and assigns completion/check-in to the new day',{timeout:60000},async()=>{
  const t=await open({time:'2026-11-02T04:59:59Z'});const {page,nav,act,state}=t;
  try {
    await nav('home');await page.clock.setSystemTime(new Date('2026-11-02T05:00:01Z'));
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    assert.match(await page.locator('.daytile.today').getAttribute('aria-label'),/Nov 2/);
    const task=page.locator('.task [data-done]').first(),tid=await task.getAttribute('data-done');await task.click();
    const done=(await state()).goals.flatMap(g=>g.tasks).find(t=>t.id===tid);
    assert.equal(done.completedDate,'2026-11-02');assert.equal(done.doneAt,'2026-11-02T05:00:01.000Z');
    await act('checkin');await page.locator('#checkin-form button').click();await act('checkin');await page.locator('#checkin-form button').click();
    assert.equal((await state()).journal.filter(c=>c.date==='2026-11-02').length,1);await t.healthy();
  } finally {await t.context.close();}
});
test('a foreground planner rolls over at local midnight without requiring a tab switch',async()=>{
  const t=await open({time:'2026-03-08T04:59:59Z'});
  try {
    await t.nav('week');await t.page.clock.runFor(2000);
    assert.match(await t.page.locator('.daytile.today').getAttribute('aria-label'),/Mar 8/);
    await t.healthy();
  } finally {await t.context.close();}
});
test('legacy first-credit day survives keyboard undo/re-completion and reload',async()=>{
  const seed=migrateState(initial()),g=seed.goals[1],task=g.tasks[0];
  seed.goals=[g];seed.selected=g.id;seed.screen='detail';
  task.doneAt='2026-10-17T16:00:00.000Z';task.rewardedAt='2026-01-01T17:00:00.000Z';
  const t=await open({seed});
  try {
    const control=t.page.locator(`[data-done="${task.id}"]`);
    await control.focus();await t.page.keyboard.press('Enter');await t.page.keyboard.press('Enter');
    const saved=(await t.state()).goals[0];
    assert.equal(saved.tasks[0].rewardedDate,'2026-01-01');assert.equal(saved.rewards.xp,35);
    await t.page.reload();assert.equal((await t.state()).goals[0].tasks[0].rewardedDate,'2026-01-01');
    await t.nav('home');assert.match(await t.page.locator('.momentum-panel').textContent(),/0 actions recorded/);
    await t.healthy();
  } finally {await t.context.close();}
});
