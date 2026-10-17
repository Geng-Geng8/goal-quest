// Existing test runtime only. No application dependencies or real student data.
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { serve } from './support/server.mjs';
import { KEY, today } from '../js/state.js';
import { migrateState, parseBackup } from '../js/data-safety.js';
import { gxp, stage } from '../js/companions.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const v4 = JSON.parse(await readFile(new URL('./fixtures/v4-save.json', import.meta.url), 'utf8'));
let server, browser;
before(async () => { server = await serve(); browser = await chromium.launch({ headless:true, channel:process.env.BROWSER_CHANNEL || 'msedge' }); });
after(async () => { await browser?.close(); await server?.close(); });
function fixture() {
  const state = migrateState(v4); state.version = 6; state.demo = false; state.screen = 'detail';
  state.goals.forEach((g,i) => {
    g.category = 'learning'; g.goalStatus = 'active'; g.plus.contract = false; g.woop = { ...g.woop, wish:'', opportunity:'', obstacle:'', plan:'' }; g.checkins = [];
    g.tasks.forEach((t,j) => { t.id = `action-${i}-${j}`; t.due = today(); t.doneAt = null; });
  });
  state.selected = state.goals[0].id; state.journal = [];
  return state;
}
async function open(width, reducedMotion = 'reduce', seed = fixture()) {
  const context = await browser.newContext({ viewport:{width,height:900}, reducedMotion, timezoneId:'America/Toronto', acceptDownloads:true });
  const page = await context.newPage(), errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  page.on('request', r => { if (!r.url().startsWith(server.url) && !/^(blob:|data:)/.test(r.url())) external.push(r.url()); });
  await page.addInitScript(({seed,key}) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key,JSON.stringify(seed)); sessionStorage.setItem('seeded','yes'); } },{seed,key:KEY});
  await page.goto(server.url+'/goal-quest/'); await page.locator('#main h1').waitFor();
  const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)),KEY);
  const act = a => page.locator(`:is(#main,#modalhost) [data-act="${a}"]`).click();
  const nav = a => page.locator(`${width < 670 ? '#bottom-nav' : '#sidebar-nav'} [data-nav="${a}"]`).click();
  const goal = async id => { await nav('goals'); await page.locator(`[data-goal="${id}"]`).click(); };
  const submit = id => page.locator(`#${id} [type="submit"]`).click();
  const shot = async label => { const dir = process.env.COMPANION_SCREENSHOT_DIR || join(tmpdir(),'goal-quest-companions'); await mkdir(dir,{recursive:true}); await page.screenshot({path:join(dir,`${width}-${label}.png`),fullPage:true,animations:'disabled'}); };
  const healthy = async () => { assert.deepEqual(errors,[]); assert.deepEqual(external,[]); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false); assert.equal(await page.locator(`${width < 670 ? '#bottom-nav' : '#sidebar-nav'} [data-nav]`).count(),5); };
  return {context,page,state,act,nav,goal,submit,shot,healthy,seed};
}
for (const width of [375,390,1365]) {
  test(`independent companion identity, keyboard preview, lifecycle and restore at ${width}px`,{timeout:60000},async () => {
    const t = await open(width), {page,seed} = t, [a,b] = seed.goals;
    try {
      const original = await t.state();
      await t.act('customize-companion');
      assert.equal(await page.getByRole('dialog',{name:'Make this companion yours'}).count(),1);
      await page.keyboard.press('Shift+Tab'); assert.equal(await page.locator('#companion-form [type="submit"]').evaluate(e => e === document.activeElement),true);
      await page.keyboard.press('Tab'); assert.equal(await page.getByRole('button',{name:'Close dialog'}).evaluate(e => e === document.activeElement),true);
      await page.getByLabel('Nickname (optional)').fill('Nova <&>');
      await page.getByLabel('Accent colour').selectOption('mint'); await page.getByLabel('Accessory',{exact:true}).selectOption('scarf');
      assert.equal(await page.locator('#companion-preview b').textContent(),'Nova <&>');
      assert.equal(await page.locator('#companion-preview script').count(),0);
      await t.shot('customize'); await t.healthy();
      await page.keyboard.press('Escape'); assert.deepEqual(await t.state(),original);
      assert.equal(await page.locator('[data-act="customize-companion"]').evaluate(e => e === document.activeElement),true);
      await t.act('customize-companion'); await page.getByLabel('Nickname (optional)').fill('Nova');
      await page.getByLabel('Accent colour').selectOption('mint'); await page.getByLabel('Accessory',{exact:true}).selectOption('scarf'); await t.submit('companion-form');
      assert.equal(await page.locator('.companion-name').textContent(),'Nova');
      const appearance = await page.locator('.companion-art svg').innerHTML();
      await t.goal(b.id); await t.act('customize-companion'); await page.getByLabel('Nickname (optional)').fill('Pip');
      await page.getByLabel('Accent colour').selectOption('sunset'); await page.getByLabel('Accessory',{exact:true}).selectOption('star'); await t.submit('companion-form');
      await t.goal(a.id); assert.equal(await page.locator('.companion-name').textContent(),'Nova');
      await t.nav('home'); assert.equal(await page.locator('.companion-name').textContent(),'Nova');
      assert.equal(await page.locator('.companion-art svg').innerHTML(),appearance);
      await t.shot('today'); await t.healthy();
      await t.goal(a.id); await t.act('evolution');
      for (const i of [1,2,3,4]) assert.equal(await page.locator('#modalhost').getByRole('img',{name:`Nova companion evolution stage ${i}`}).count(),1);
      assert.equal(await page.locator('.evolution-step.current').getByText('Stage 1',{exact:true}).count(),1);
      await t.shot('evolution'); await t.healthy(); await page.keyboard.press('Escape');
      await t.act('park-goal'); assert.equal((await t.state()).goals[0].goalStatus,'parked');
      assert.equal(await page.locator('.companion-name').textContent(),'Nova');
      await t.act('activate-goal');
      await t.act('achieve-goal'); await page.locator('[name="reflection"]').fill('Performed my routine'); await page.locator('[name="howKnow"]').fill('Recorded it'); await t.submit('achieve-goal-form'); await t.act('view-achievements');
      assert.match(await page.locator('#hall-achievements').textContent(),/Nova/);
      assert.match(await page.locator('#hall-achievements svg').getAttribute('aria-label'),/^Nova/);
      await t.shot('hall'); await t.healthy();
      const saved = await t.state();
      await page.locator('.data-toolbar [data-act="data-menu"]').click();
      const event = page.waitForEvent('download'); await page.locator('#modalhost [data-act="backup"]').click();
      const download = await event, raw = await readFile(await download.path(),'utf8'); assert.deepEqual(parseBackup(raw).state,saved);
      await page.locator('#modalhost [data-act="close"]').click();
      await page.reload(); assert.deepEqual(await t.state(),saved);
      await t.goal(b.id); await t.act('customize-companion'); await page.getByLabel('Nickname (optional)').fill('Changed'); await t.submit('companion-form');
      await page.locator('.data-toolbar [data-act="data-menu"]').click();
      await page.locator('#backup-file').setInputFiles({name:'companions.json',mimeType:'application/json',buffer:Buffer.from(raw)});
      await page.locator('#modalhost [data-act="confirm-restore"]').click();
      assert.deepEqual((await t.state()).goals,saved.goals);
      await page.reload(); assert.deepEqual((await t.state()).goals,saved.goals);
      await page.locator('.data-toolbar [data-act="data-menu"]').click();
      await page.locator('#modalhost [data-act="recover-progress"]').click();
      await page.locator('#modalhost [data-act="confirm-restore"]').click();
      assert.equal((await t.state()).goals[1].companion.nickname,'Changed','recovery retains the pre-import identity');
      await t.healthy();
    } finally { await t.context.close(); }
  });
  test(`task reward integrity, check-in goal switching and evolution with reduced motion at ${width}px`,{timeout:60000},async () => {
    const seed = fixture(), [a,b] = seed.goals;
    // One task crosses 145, making the unlock deterministic.
    a.tasks.slice(0,3).forEach(t => t.doneAt = new Date().toISOString()); a.plus.contract = true;
    const t = await open(width,'reduce',seed), {page} = t;
    try {
      const task = a.tasks[3], base = gxp(a);
      await page.locator(`[data-done="${task.id}"]`).click();
      assert.equal(gxp((await t.state()).goals[0]),base+35); assert.equal(stage((await t.state()).goals[0]),2);
      assert.match(await page.locator('#companion-heading').textContent(),/Stage 2 unlocked/);
      await t.act('celebrate-evolution'); assert.equal(await page.locator('.evolution-step.current svg').evaluate(e => e.getAnimations().length),0);
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),'auto');
      await t.shot('unlock'); await t.healthy(); await page.keyboard.press('Escape');
      assert.equal(await page.locator(`[data-done="${task.id}"]`).evaluate(e => e === document.activeElement),true,'unlock dismissal returns keyboard focus to its task');
      await page.locator(`[data-done="${task.id}"]`).click(); assert.equal(gxp((await t.state()).goals[0]),base+35);
      await page.locator(`[data-done="${task.id}"]`).click(); assert.equal(gxp((await t.state()).goals[0]),base+35);
      assert.equal(await page.locator('#modalhost .modal').count(),0,'repeat completion does not celebrate again');
      await page.reload(); assert.equal(gxp((await t.state()).goals[0]),base+35);
      await t.nav('home'); await t.act('checkin'); await page.locator('[name="mood"]').selectOption('rest'); await t.submit('checkin-form');
      assert.equal(gxp((await t.state()).goals[0]),base+45);
      await t.goal(b.id); await t.nav('home'); await t.act('checkin'); await t.submit('checkin-form');
      assert.equal(gxp((await t.state()).goals[1]),gxp(b)); assert.equal((await t.state()).journal.length,1);
      assert.match(await page.locator('.momentum-panel').textContent(),/including choosing rest/);
      await t.healthy();
    } finally { await t.context.close(); }
  });
}
test('evolution animation is opt-in, short and finite with normal motion',{timeout:30000},async () => {
  const seed = fixture(), a = seed.goals[0]; a.tasks.slice(0,3).forEach(t => t.doneAt = new Date().toISOString()); a.plus.contract = true;
  const t = await open(390,'no-preference',seed);
  try {
    await t.page.locator(`[data-done="${a.tasks[3].id}"]`).click();
    const art = t.page.locator('.evolution-step.current svg');
    assert.equal(await art.evaluate(e => e.getAnimations().length),0);
    await t.act('celebrate-evolution');
    const timing = await art.evaluate(e => e.getAnimations().map(a => a.effect.getTiming()));
    assert.equal(timing.length,1); assert.equal(timing[0].duration,600); assert.equal(timing[0].iterations,1);
    await t.healthy();
  } finally { await t.context.close(); }
});

test('plan rewards are one-time and unsaved identity/XP remain backed up after a quota failure',{timeout:60000},async () => {
  const t = await open(390), {page} = t;
  try {
    for (const checked of [true,false,true]) {
      await page.locator('[data-lesson="smartplus"]').click();
      await page.locator('[name="contract"]').setChecked(checked); await t.submit('plus-form');
      assert.equal(gxp((await t.state()).goals[0]),20);
    }
    await page.locator('[data-lesson="woop"]').click();
    await page.locator('[name="plan"]').fill('If distracted, then practise five minutes.'); await t.submit('woop-form');
    assert.equal(gxp((await t.state()).goals[0]),20,'a plan alone does not reward the whole WOOP activity');
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-lesson="woop"]').click();
      for (const [key,value] of Object.entries({wish:'Learn a routine',opportunity:'Feel proud',obstacle:'Distraction',plan:'If distracted, then practise five minutes.'})) await page.locator(`[name="${key}"]`).fill(value);
      await t.submit('woop-form'); assert.equal(gxp((await t.state()).goals[0]),45);
    }
    const saved = await t.state();
    await page.evaluate(key => {
      const native = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k,v) { if (this === localStorage && k === key) throw new DOMException('Full','QuotaExceededError'); return native.call(this,k,v); };
    },KEY);
    await t.act('customize-companion'); await page.getByLabel('Nickname (optional)').fill('Still here'); await t.submit('companion-form');
    await page.locator(`[data-done="${saved.goals[0].tasks[0].id}"]`).click();
    assert.deepEqual(await t.state(),saved,'failed writes keep the last saved record');
    assert.equal(await page.locator('#storage-warning').isVisible(),true);
    assert.match(await page.locator('#toast').textContent(),/could not be saved/);
    await page.locator('.data-toolbar [data-act="data-menu"]').click();
    const event = page.waitForEvent('download'); await page.locator('#modalhost [data-act="backup"]').click();
    const download = await event, raw = await readFile(await download.path(),'utf8'), backup = parseBackup(raw).state;
    assert.equal(backup.goals[0].companion.nickname,'Still here'); assert.equal(gxp(backup.goals[0]),80);
    assert.ok(backup.goals[0].tasks[0].rewardedAt);
    await t.healthy();
  } finally { await t.context.close(); }
});

for (const width of [390,1365]) for (const status of ['parked','legacy archived']) {
  test(`${status} planning rewards, focus choices and backup/reload at ${width}px`,{timeout:60000},async () => {
    const seed = fixture(), g = seed.goals[0];
    if (status === 'parked') g.goalStatus = 'parked'; else { delete g.goalStatus; g.archived = true; }
    g.tasks.slice(0,3).forEach(t => t.doneAt = new Date().toISOString());
    g.companion = { nickname:'Nova', accent:'mint', accessory:'scarf', future:{ keep:true } };
    g.plus.future = ['keep']; g.woop.future = { keep:true };
    for (let i = 0; i < 2; i++) {
      const other = structuredClone(seed.goals[1]); other.id = `other-${i}`;
      other.tasks.forEach((t,j) => t.id = `other-${i}-${j}`); seed.goals.push(other);
    }
    const t = await open(width,'reduce',seed), {page} = t, base = gxp(g);
    const activeIds = state => state.goals.filter(g => g.goalStatus === 'active').map(g => g.id);
    const original = await t.state(), activeBefore = activeIds(original);
    const check = async extra => {
      const state = await t.state(), target = state.goals[0];
      assert.equal(gxp(target),base+extra); assert.deepEqual(target.tasks,original.goals[0].tasks);
      assert.deepEqual(target.companion,g.companion); assert.deepEqual(target.plus.future,g.plus.future); assert.deepEqual(target.woop.future,g.woop.future);
      assert.deepEqual(activeIds(state),activeBefore); assert.equal(await page.locator('#main [data-done], #main [data-move]').count(),0);
    };
    const saveWOOP = async () => {
      await page.locator('[data-lesson="woop"]').click();
      for (const [key,value] of Object.entries({wish:'Learn a routine',opportunity:'Feel proud',obstacle:'Distraction',plan:'If distracted, then practise five minutes.'})) await page.locator(`[name="${key}"]`).fill(value);
      await t.submit('woop-form');
    };
    try {
      for (const checked of [true,false,true]) {
        await page.locator('[data-lesson="smartplus"]').click(); await page.locator('[name="contract"]').setChecked(checked); await t.submit('plus-form');
        await check(20);
      }
      await saveWOOP();
      assert.match(await page.locator('#companion-heading').textContent(),/Stage 2 unlocked/); await page.keyboard.press('Escape');
      await check(45); assert.equal(stage((await t.state()).goals[0]),2);
      await saveWOOP(); await check(45);
      await t.act('evolution'); assert.match(await page.locator('#modalhost').textContent(),/Planning rewards count on parked and previously archived goals too/); await page.keyboard.press('Escape');
      const saved = await t.state();
      await page.locator('.data-toolbar [data-act="data-menu"]').click();
      const event = page.waitForEvent('download'); await page.locator('#modalhost [data-act="backup"]').click();
      const download = await event, raw = await readFile(await download.path(),'utf8'); assert.deepEqual(parseBackup(raw).state,saved);
      await page.keyboard.press('Escape');
      await t.act('activate-goal'); assert.equal(await page.locator('#activate-goal-form').count(),1);
      assert.deepEqual(await t.state(),saved,'activation at capacity waits for an explicit parking choice');
      await page.locator(`[name="park"][value="${seed.goals[1].id}"]`).check(); await t.submit('activate-goal-form');
      assert.equal(activeIds(await t.state()).length,3); assert.equal((await t.state()).goals[0].goalStatus,'active');
      await saveWOOP();
      await page.locator('[data-lesson="smartplus"]').click(); await t.submit('plus-form');
      assert.equal(gxp((await t.state()).goals[0]),base+45);
      await page.locator('.data-toolbar [data-act="data-menu"]').click();
      await page.locator('#backup-file').setInputFiles({name:'planning.json',mimeType:'application/json',buffer:Buffer.from(raw)});
      await page.locator('#modalhost [data-act="confirm-restore"]').click();
      await page.reload(); assert.deepEqual(await t.state(),saved);
      await saveWOOP(); await check(45);
      await t.healthy();
    } finally { await t.context.close(); }
  });
}
