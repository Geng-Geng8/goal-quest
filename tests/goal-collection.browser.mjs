// Uses the existing Playwright runtime only; the application has no dependencies.
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { serve } from './support/server.mjs';
import { KEY, RECOVERY_KEY, today, shift } from '../js/state.js';
import { migrateState, parseBackup } from '../js/data-safety.js';
import { goalStatus, activeGoals, achieveGoal } from '../js/goal-status.js';
import { gxp, stage } from '../js/companions.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const v4 = JSON.parse(await readFile(new URL('./fixtures/v4-save.json', import.meta.url), 'utf8'));
let server, browser;
before(async () => {
  server = await serve();
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });
function fixture() {
  const state = migrateState(v4);
  state.demo = false; state.screen = 'goals';
  state.goals = Array.from({ length: 5 }, (_, i) => {
    const g = structuredClone(state.goals[0]);
    g.id = `goal-${i}`; g.title = `My goal ${i}`; g.goalStatus = i < 3 ? 'active' : 'parked';
    g.tasks = g.tasks.slice(0, 2); g.tasks.forEach((t, j) => { t.id = `task-${i}-${j}`; t.due = today(); t.doneAt = null; });
    g.notes = [{ date: today(), text: 'My earlier reflection', evidence: 'Notebook' }];
    return g;
  });
  delete state.goals[4].goalStatus; state.goals[4].archived = true;
  state.selected = 'goal-3';
  return state;
}
async function open(width = 390, seed = fixture(), reducedMotion = 'reduce') {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion, timezoneId: 'America/Toronto', acceptDownloads: true });
  const page = await context.newPage(), errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  page.on('request', r => { if (!r.url().startsWith(server.url) && !/^(blob:|data:)/.test(r.url())) external.push(r.url()); });
  await page.addInitScript(({ seed, key }) => {
    if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, JSON.stringify(seed)); sessionStorage.setItem('seeded', 'yes'); }
  }, { seed, key: KEY });
  await page.goto(server.url + '/goal-quest/');
  await page.locator('#main h1').waitFor();
  const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  const act = name => page.locator(`:is(#main,#modalhost) [data-act="${name}"]`).click();
  const nav = name => page.locator(`${width < 670 ? '#bottom-nav' : '#sidebar-nav'} [data-nav="${name}"]`).click();
  const goal = async id => { await nav('goals'); await page.locator(`[data-goal="${id}"]`).click(); };
  const healthy = async () => {
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator(`${width < 670 ? '#bottom-nav' : '#sidebar-nav'} [data-nav]`).count(), 5);
  };
  const shot = async label => {
    const dir = process.env.COLLECTION_SCREENSHOT_DIR || join(tmpdir(), 'goal-quest-collection');
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `${width}-${label}.png`), fullPage: true, animations: 'disabled' });
  };
  const backupMenu = () => page.locator('.data-toolbar [data-act="data-menu"]').click();
  return { context, page, state, act, nav, goal, healthy, shot, backupMenu };
}

for (const width of [375, 390, 1365]) {
  test(`inactive task history rejects stale actions and resumes after activation at ${width}px`, { timeout: 60000 }, async () => {
    const seed = fixture();
    for (const g of [seed.goals[3], seed.goals[4], seed.goals[2]]) {
      g.tasks[0].doneAt = new Date().toISOString();
      g.companion = { nickname: 'Keep my companion' };
    }
    achieveGoal(seed.goals[2], { reflection: 'Performed my routine.', howKnow: 'Recorded the full routine.' });
    const t = await open(width, seed), { page } = t;
    try {
      for (const id of ['goal-3', 'goal-4', 'goal-2']) {
        await t.goal(id);
        const before = await t.state(), g = before.goals.find(g => g.id === id), xp = gxp(g), evolution = stage(g);
        assert.equal(await page.locator('#main [data-done], #main [data-move]').count(), 0);
        assert.equal(await page.locator('#main .task').count(), g.tasks.length);
        for (const task of g.tasks) assert.equal(await page.getByText(task.title, { exact: true }).count(), 1);
        assert.equal(await page.locator('#main .task .pill').allTextContents().then(text => text.join(',')), 'Finished,Unfinished');
        // Simulate controls/forms retained from an earlier render, independently
        // of the read-only UI. Both finished and unfinished tasks must be guarded.
        await page.evaluate(({ g, date }) => {
          for (const task of g.tasks) {
            for (const action of ['done', 'move']) {
              const button = document.createElement('button');
              button.dataset[action] = task.id; document.body.append(button); button.click(); button.remove();
            }
            const form = document.createElement('form'); form.id = 'move-form'; form.dataset.task = task.id;
            const input = document.createElement('input'); input.name = 'date'; input.value = date; form.append(input);
            document.body.append(form); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.remove();
          }
          const form = document.createElement('form'); form.id = 'task-form';
          for (const [name, value] of Object.entries({ goal: g.id, title: 'Stale new action', date })) {
            const input = document.createElement('input'); input.name = name; input.value = value; form.append(input);
          }
          document.body.append(form); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.remove();
        }, { g, date: shift(today(), 2) });
        assert.equal(await page.locator('#move-form').count(), 0, 'inactive reschedule controls cannot open a dialog');
        assert.deepEqual(await t.state(), before, 'stale events must not change any student record');
        // Notes remain available on all three inactive states without changing XP.
        await t.act('evidence'); await page.locator('[name="text"]').fill('A reflection while paused.');
        await page.locator('[name="evidence"]').fill('Private notebook');
        await page.locator('#evidence-form > button').click();
        const withNote = (await t.state()).goals.find(g => g.id === id);
        assert.deepEqual(withNote, { ...g, notes: [...g.notes, { date: today(), text: 'A reflection while paused.', evidence: 'Private notebook' }] });
        assert.equal(gxp(withNote), xp); assert.equal(stage(withNote), evolution);
        if (id !== 'goal-2') {
          await t.act('activate-goal');
          assert.deepEqual((await t.state()).goals.find(g => g.id === id), { ...withNote, goalStatus: 'active' });
          for (const task of g.tasks) assert.equal(await page.locator(`[data-done="${task.id}"]`).count(), 1);
          await page.locator(`[data-done="${g.tasks[0].id}"]`).click();
          assert.equal(gxp((await t.state()).goals.find(g => g.id === id)), xp - 35, 'undo works after activation');
          await page.locator(`[data-done="${g.tasks[1].id}"]`).click();
          assert.equal(gxp((await t.state()).goals.find(g => g.id === id)), xp, 'completion works after activation');
          await page.locator(`[data-move="${g.tasks[0].id}"]`).click();
          await page.locator('#move-form [name="date"]').fill(shift(today(), 2));
          await page.locator('#move-form > button').click();
          assert.equal((await t.state()).goals.find(g => g.id === id).tasks[0].due, shift(today(), 2));
          await t.act('park-goal');
          assert.equal(await page.locator('#main [data-done], #main [data-move]').count(), 0);
        }
        await page.reload(); await page.locator('#main h1').waitFor();
        assert.equal(await page.locator('#main [data-done], #main [data-move]').count(), 0);
        await t.healthy();
      }
    } finally { await t.context.close(); }
  });

  test(`park, swap, achieve, backup/restore and daily planner at ${width}px`, { timeout: 60000 }, async () => {
    const t = await open(width), { page } = t;
    try {
      const original = await t.state();
      assert.equal(await page.getByRole('heading', { name: 'Previously archived', exact: true }).count(), 1);
      await t.shot('collection'); await t.healthy();
      await t.goal('goal-3'); await t.act('activate-goal');
      const before = await t.state();
      assert.equal(await page.locator('[data-initial-focus]').evaluate(e => e === document.activeElement), true);
      await page.getByRole('button', { name: 'Close dialog' }).focus();
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator('#activate-goal-form [type="submit"]').evaluate(e => e === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.getByRole('button', { name: 'Close dialog' }).evaluate(e => e === document.activeElement), true);
      await page.locator('#activate-goal-form [type="submit"]').click();
      assert.match(await page.locator('#activation-error').textContent(), /Choose enough/);
      assert.deepEqual(await t.state(), before);
      await page.keyboard.press('Escape'); assert.deepEqual(await t.state(), before);
      assert.equal(await page.locator('[data-act="activate-goal"]').evaluate(e => e === document.activeElement), true);
      await t.act('activate-goal'); await t.act('keep-parked');
      assert.equal(goalStatus((await t.state()).goals[3]), 'parked');
      await t.act('activate-goal'); await page.locator('[name="park"][value="goal-0"]').check();
      await t.shot('focus-choice'); await t.healthy();
      await page.locator('#activate-goal-form [type="submit"]').click();
      assert.equal(activeGoals(await t.state()).length, 3);
      assert.equal(goalStatus((await t.state()).goals[0]), 'parked');
      assert.deepEqual((await t.state()).goals[0].tasks, original.goals[0].tasks);
      await t.act('park-goal'); await t.act('activate-goal');
      assert.equal(goalStatus((await t.state()).goals[3]), 'active');
      // An all-checked action list never auto-achieves the goal.
      for (const id of ['task-3-0', 'task-3-1']) await page.locator(`[data-done="${id}"]`).click();
      assert.equal(goalStatus((await t.state()).goals[3]), 'active');
      await page.locator('[data-done="task-3-1"]').click();
      const progress = (await t.state()).goals[3], xp = gxp(progress);
      await t.act('achieve-goal');
      await page.locator('[name="reflection"]').fill('I performed <b>my whole routine</b>.');
      await page.locator('[name="howKnow"]').fill('   ');
      await page.locator('#achieve-goal-form [type="submit"]').click();
      assert.equal(goalStatus((await t.state()).goals[3]), 'active');
      await page.locator('[name="howKnow"]').fill('The recording lasts 60 seconds.');
      await page.locator('[name="evidence"]').fill('My private video');
      await page.locator('[name="milestone"]').fill('I shared it with a friend.');
      await t.shot('achievement-form'); await t.healthy();
      await page.locator('#achieve-goal-form [type="submit"]').click();
      const achieved = (await t.state()).goals[3];
      assert.equal(goalStatus(achieved), 'achieved'); assert.equal(gxp(achieved), xp);
      assert.deepEqual(achieved.tasks, progress.tasks); assert.deepEqual(achieved.notes, progress.notes);
      await t.shot('celebration'); await t.act('celebrate-achievement');
      assert.equal(await page.locator('.achievement-art').evaluate(e => e.getAnimations().length), 0, 'reduced motion');
      await t.act('view-achievements');
      assert.equal(await page.locator('#hall-achievements [data-goal="goal-3"]').count(), 1);
      assert.match(await page.locator('#hall-achievements .pill.gold').textContent(), /\d{4}/);
      assert.equal(await page.locator('#hall-achievements .achievement-excerpt b').count(), 0, 'student HTML is escaped');
      assert.match(await page.locator('#hall-achievements .achievement-excerpt').textContent(), /<b>my whole routine<\/b>/);
      await t.shot('hall');
      await t.goal('goal-3');
      assert.equal(await page.locator('[data-act="achieve-goal"], [data-done], [data-move]').count(), 0);
      assert.match(await page.locator('.achievement-record').textContent(), /recording lasts 60 seconds/);
      await t.shot('achieved-detail');
      for (const name of ['home', 'week']) {
        await t.nav(name);
        assert.equal(await page.locator('[data-done="task-3-1"], [data-done="task-0-0"], [data-done="task-4-0"]').count(), 0);
        if (name === 'home') {
          // A previously selected achievement must not receive active-goal actions.
          assert.equal(await page.locator('.hero svg').getAttribute('aria-label'), 'Glimo companion evolution stage 1');
          await t.act('evolution');
          assert.equal(await page.locator('#modalhost svg radialGradient').first().getAttribute('id'), 'grgoal-1');
          await t.act('close'); await t.act('partner');
          assert.match(await page.locator('#share-text').inputValue(), /My goal 1/);
          await t.act('close');
        }
        await t.healthy();
      }
      await t.backupMenu();
      const downloadEvent = page.waitForEvent('download'); await t.act('backup');
      const raw = await readFile(await (await downloadEvent).path(), 'utf8');
      const full = parseBackup(raw).state;
      assert.deepEqual(full, await t.state());
      await page.locator('#backup-file').setInputFiles({ name: 'goals.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
      await page.locator('[data-act="confirm-restore"]').waitFor();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.deepEqual(await t.state(), full);
      assert.equal(await page.locator('.data-toolbar [data-act="data-menu"]').evaluate(e => e === document.activeElement), true);
      await t.backupMenu();
      await page.locator('#backup-file').setInputFiles({ name: 'goals.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
      await t.act('confirm-restore');
      assert.deepEqual(await t.state(), full);
      assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).workingState, RECOVERY_KEY), full);
      await page.reload(); await page.locator('#main h1').waitFor(); assert.deepEqual(await t.state(), full);
      await t.goal('goal-3'); assert.equal(await page.locator('.achievement-record').count(), 1);
      await t.healthy();
    } finally { await t.context.close(); }
  });
}

test('fourth newly created goal keeps its draft on cancel and can start parked or replace an active goal', { timeout: 60000 }, async () => {
  for (const parked of [true, false]) {
    const seed = fixture();
    seed.screen = 'wizard'; seed.draft = { step: 4, category: 'learning', title: 'My new goal', why: 'For me', success: 'Perform once', agree: 'yes', realistic: 'Time to practise', date: today(), dateType: 'review', tasks: [{ id: 'draft-action', title: 'Start practising' }], schedule: { 'draft-action': today() } };
    const t = await open(390, seed);
    try {
      const before = await t.state();
      await t.act('wizard-next'); await t.page.locator('#backdrop').click({ position: { x: 1, y: 1 } });
      assert.deepEqual(await t.state(), before);
      await t.act('wizard-next');
      if (parked) await t.act('keep-parked');
      else { await t.page.locator('[name="park"][value="goal-0"]').check(); await t.page.locator('#activate-goal-form [type="submit"]').click(); }
      const state = await t.state(), added = state.goals.at(-1);
      assert.equal(state.goals.length, 6); assert.equal(state.draft, null);
      assert.equal(goalStatus(added), parked ? 'parked' : 'active'); assert.equal(activeGoals(state).length, 3);
      assert.equal(added.tasks[0].due, today()); assert.equal(await t.page.locator('#backdrop').count(), 0);
      await t.healthy();
    } finally { await t.context.close(); }
  }
});

test('legacy archive is explicitly restored; an all-parked collection has a clear Today empty state', { timeout: 30000 }, async () => {
  const seed = fixture(); seed.version = 5;
  seed.goals.forEach(g => { delete g.goalStatus; g.archived = true; });
  const t = await open(375, seed);
  try {
    await t.nav('home'); assert.match(await t.page.locator('#main').textContent(), /No active goals right now/);
    await t.nav('week'); assert.equal(await t.page.locator('[data-done]').count(), 0);
    await t.act('add-task'); assert.match(await t.page.locator('#modalhost').textContent(), /Choose an active goal first/);
    await t.page.locator('#modalhost [data-nav="goals"]').click();
    assert.equal(await t.page.locator('#backdrop').count(), 0);
    await t.goal('goal-4'); await t.act('activate-goal');
    assert.equal((await t.state()).goals[4].archived, true);
    assert.equal(goalStatus((await t.state()).goals[4]), 'active');
    const recovery = await t.page.evaluate(key => JSON.parse(localStorage.getItem(key)), RECOVERY_KEY);
    assert.deepEqual(JSON.parse(recovery.raw), seed);
    await t.nav('home'); assert.equal(await t.page.locator('[data-done="task-4-0"]').count() > 0, true);
    await t.healthy();
  } finally { await t.context.close(); }
});

test('failed achievement save stays exportable, warns truthfully, and is safe to retry', { timeout: 30000 }, async () => {
  const t = await open();
  try {
    await t.goal('goal-0'); const before = await t.state();
    await t.page.evaluate(key => {
      const native = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v) { if (k === key) throw new DOMException('Full', 'QuotaExceededError'); native.call(this, k, v); };
    }, KEY);
    await t.act('achieve-goal');
    await t.page.locator('[name="reflection"]').fill('Performed my routine.');
    await t.page.locator('[name="howKnow"]').fill('Recorded it.');
    await t.page.locator('#achieve-goal-form [type="submit"]').click();
    assert.deepEqual(await t.state(), before);
    assert.match(await t.page.locator('#modalhost [role="alert"]').textContent(), /could not be saved/);
    await t.act('close'); await t.backupMenu();
    const event = t.page.waitForEvent('download'); await t.act('backup');
    const raw = await readFile(await (await event).path(), 'utf8');
    assert.equal(goalStatus(parseBackup(raw).state.goals[0]), 'achieved');
    assert.equal(gxp(parseBackup(raw).state.goals[0]), gxp(before.goals[0]));
    await t.healthy();
  } finally { await t.context.close(); }
});

test('celebration animation is finite and opt-in when motion is allowed', { timeout: 30000 }, async () => {
  const t = await open(390, fixture(), 'no-preference');
  try {
    await t.goal('goal-0'); await t.act('achieve-goal');
    await t.page.locator('[name="reflection"]').fill('I did it.'); await t.page.locator('[name="howKnow"]').fill('I checked my result.');
    await t.page.locator('#achieve-goal-form [type="submit"]').click();
    assert.equal(await t.page.locator('.achievement-art').evaluate(e => e.getAnimations().length), 0);
    await t.act('celebrate-achievement');
    assert.equal(await t.page.locator('.achievement-art').evaluate(e => e.getAnimations()[0].effect.getTiming().iterations), 1);
    await t.healthy();
  } finally { await t.context.close(); }
});
