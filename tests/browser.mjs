// Optional browser regression suite. Uses an already installed Playwright; no app dependency.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initial, KEY, shift } from '../js/state.js';
import { serve } from './support/server.mjs';
import { DATA_VERSION } from '../js/data-safety.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fixedTime = new Date('2026-10-17T16:00:00Z');
const fixture = initial();
fixture.goals.forEach((g,i) => {
  g.id=`existing-goal-${i}`;
  g.tasks.forEach((t,j) => { t.id=`existing-task-${i}-${j}`; });
});
fixture.selected=fixture.goals[0].id;
fixture.demo=false;
fixture.privateExtension={keep:'unknown student fields'};
fixture.goals[0].privateExtension={keep:true};

async function exercise(browser, url, width, seed) {
  const modular = !url.includes('/reference/');
  const context = await browser.newContext({ viewport:{width,height:900}, reducedMotion:'reduce', timezoneId:'America/Toronto', locale:'en-CA', acceptDownloads:true });
  const page = await context.newPage();
  const errors=[], external=[], checkpoints=[], screenshots=[];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type()==='error') errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(new URL(url).origin) && !/^(blob:|data:)/.test(request.url())) external.push(request.url()); });
  await page.clock.install({time:fixedTime});
  await page.clock.pauseAt(fixedTime);
  await page.addInitScript(({seed,key}) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(seed));
    let randomSeed=12345;
    Math.random=()=>((randomSeed=(randomSeed*16807)%2147483647)-1)/2147483646;
    window.copied=[];
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied.push(text);}}});
  }, {seed,key:KEY});
  // Normalize only the explicit Phase 4A/4B schema additions for parity. Full live backups are
  // separately asserted below, and collection state transitions have their own suite.
  const actualState=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  const legacyGoals=goals=>goals.map(g=>{ const copy=structuredClone(g); delete copy.rewards; copy.tasks.forEach(t=>{delete t.rewardedAt;delete t.completedDate;delete t.rewardedDate;}); if(copy.goalStatus==='active') delete copy.goalStatus; return copy; });
  const state=async()=>{const s=await actualState();return {...s,focus:{minutes:seed.focus.minutes},journal:s.journal.map(({goalId,...c})=>c),goals:legacyGoals(s.goals),version:4};};
  const click=selector=>page.locator(selector).click();
  const act=name=>click(`:is(#main,#modalhost) [data-act="${name}"]`);
  const nav=screen=>click(`${width<670?'#bottom-nav':'#sidebar-nav'} [data-nav="${screen}"]`);
  const fill=(name,value)=>page.locator(`[name="${name}"]`).fill(value);
  const submit=id=>click(`#${id} button[type="submit"], #${id} > button.btn`);
  const checkpoint=async label=>{
    assert.deepEqual(errors,[],`${label}: JavaScript/console errors`);
    assert.deepEqual(external,[],`${label}: external requests`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${label}: overflow at ${width}`);
    checkpoints.push({label,state:await state(),html:await page.evaluate(()=>
      ['#main','#sidebar-nav','#bottom-nav','#player-level','#modalhost'].map(selector=> {
        const node=document.querySelector(selector).cloneNode(true);
        // Phase 5 deliberately changes names, focus semantics and timer UI.
        // Compare all other V4 DOM; test new accessibility contracts directly.
        node.querySelectorAll('[aria-current],[aria-pressed],[tabindex]').forEach(e=>{
          for(const attr of ['aria-current','aria-pressed','tabindex']) e.removeAttribute(attr);
        });
        node.querySelectorAll('label[for]').forEach(e=>e.removeAttribute('for'));
        node.querySelectorAll('[id]').forEach(e=>{if(/^(creator-smart|planner|academy-coach)-field-/.test(e.id))e.removeAttribute('id');});
        node.querySelectorAll('[data-date-task],[data-draft="date"],.daytile').forEach(e=>e.removeAttribute('aria-label'));
        node.querySelectorAll('[data-move]').forEach(e=>e.setAttribute('aria-label','Reschedule task'));
        node.querySelectorAll('[data-remove-wtask]').forEach(e=>e.setAttribute('aria-label','Remove'));
        node.querySelector('#wizard-error')?.remove();
        node.querySelectorAll('h2').forEach(e=>{if(e.textContent==='Pomodoro timer')e.closest('section').remove();});
        node.querySelectorAll('svg [id],svg [fill]').forEach(e=>{
          for(const attr of ['id','fill']) if(e.hasAttribute(attr))e.setAttribute(attr,e.getAttribute(attr).replace('-hero',''));
        });
        // Explicitly exclude the replaced backup/reset footer, not goal content.
        if(selector==='#main') {
          node.querySelector(':scope > .card > div[style*="border-top"]')?.remove();
          // Phase 4A intentionally replaces collection sections; the existing active
          // goal artwork, category, title and action progress still compare exactly.
          // New stage/name/XP captions are directly tested in companion-gameplay.
          node.querySelectorAll('.companion').forEach(e=>e.remove());
          // Phase 4B replaces momentum with an activity summary. Test it directly
          // in companion-gameplay; keep all other Today content compared to V4.
          node.querySelectorAll('.eyebrow').forEach(e=>{ if(e.textContent==='PERSONAL MOMENTUM') e.closest('section').remove(); });
          node.querySelectorAll('.goalcard').forEach(card=>{ card.querySelector('.mini .pill')?.remove(); card.querySelectorAll('.tiny').forEach(e=>e.remove()); });
          if(node.querySelector('.goalcard')) return JSON.stringify({title:node.querySelector('h1').textContent,cards:[...node.querySelectorAll('.goalcard')].map(e=>e.outerHTML)});
          node.querySelector('.goal-state-controls')?.remove();
          node.querySelector('h1[tabindex]')?.removeAttribute('tabindex');
          node.querySelectorAll('.pill').forEach(e=>e.textContent=e.textContent.replace('actions finished','completed'));
        }
        return node.innerHTML.replace(/ oninput="[^"]*"/g,' data-challenge=""');
      }))});
  };
  const shot=async label=>{
    // Screenshots document the retained flows; Phase 5 intentionally changes
    // contrast, touch sizes and wrapping. Responsive assertions live in the new suite.
    if(['tab-home','tab-goals','goal-detail'].includes(label)) return;
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    // The persistent backup toolbar and replaced footer are tested separately.
    // Normalize their intentional layout changes to retain V4 visual assertions.
    const bytes=await page.screenshot({fullPage:true,animations:'disabled',caret:'hide',style:'.data-toolbar{display:none!important}#main > .card > div[style*="border-top"]{display:none!important}.main{padding-top:34px!important}@media(max-width:670px){.main{padding-top:23px!important}}'});
    screenshots.push({label,bytes});
    if (process.env.PARITY_SCREENSHOT_DIR) {
      await mkdir(process.env.PARITY_SCREENSHOT_DIR,{recursive:true});
      await writeFile(join(process.env.PARITY_SCREENSHOT_DIR,`${width}-${label}-${url.includes('/reference/')?'v4':'modules'}.png`),bytes);
    }
  };
  try {
    await page.goto(url);
    await page.waitForSelector('#main h1');
    assert.deepEqual(await state(),seed,'existing V4 state must load without loss or demo seeding');
    for (const screen of ['home','week','goals','path','coach']) {
      await nav(screen); await checkpoint(`tab ${screen}`); await shot(`tab-${screen}`);
    }
    const persisted=await state();
    await page.reload(); await page.waitForSelector('#main h1');
    assert.deepEqual(await state(),persisted,'navigation and state survive refresh');

    await nav('goals'); await act('new-goal');
    await act('wizard-next'); // Required title validation.
    assert.equal((await state()).draft.step,0);
    await click('[data-category="money"]');
    await click('[data-example="Save $200"]');
    await page.locator('[data-draft="title"]').fill('Save for a school trip');
    await page.locator('[data-draft="why"]').fill('Practise managing money.');
    await act('wizard-exit'); await page.reload(); await page.waitForSelector('#main h1');
    await act('new-goal'); await act('resume-wizard');
    assert.equal(await page.locator('[data-draft="title"]').inputValue(),'Save for a school trip');
    await act('wizard-next'); await act('wizard-next');
    assert.equal((await state()).draft.step,1);
    await page.locator('[data-draft="success"]').fill('Put aside $200 by the review date');
    await page.locator('[data-draft="agree"]').selectOption('reconsider');
    await page.locator('[data-draft="realistic"]').fill('Save a small amount each week');
    await page.locator('[data-draft="dateType"]').selectOption('review');
    await act('wizard-next'); assert.equal((await state()).draft.step,1);
    await page.locator('[data-draft="agree"]').selectOption('yes');
    await act('wizard-next'); await act('wizard-next');
    assert.equal((await state()).draft.step,2);
    await page.locator('#w-action').fill('Track spending for ten minutes');
    await page.locator('#w-action').press('Enter');
    await click('[data-suggest="Compare two prices"]');
    await click('[data-suggest="Compare two prices"]');
    assert.equal((await state()).draft.tasks.length,2);
    await page.locator('[data-remove-wtask]').first().click();
    await page.locator('#w-action').fill('Put coins in the savings jar'); await act('w-add');
    await act('wizard-next'); await act('wizard-next');
    assert.equal((await state()).draft.step,3);
    const options=await page.locator('[data-date-task]').first().locator('option').evaluateAll(items=>items.map(x=>x.value));
    await page.locator('[data-date-task]').first().selectOption(options[1]);
    await checkpoint('scheduled draft');
    await page.reload(); await page.waitForSelector('[data-date-task]');
    await act('wizard-next'); await checkpoint('wizard review'); await shot('wizard-review');
    await act('wizard-next');
    let saved=await state();
    assert.equal(saved.goals.length,3); assert.equal(saved.demo,false); assert.equal(saved.draft,null);
    const newGoal=saved.goals.find(g=>g.id===saved.selected);
    const goalId=newGoal.id, taskId=newGoal.tasks[0].id;
    assert.equal(newGoal.category,'money'); assert.equal(newGoal.agree,'yes');
    assert.equal(newGoal.dateType,'review'); assert.equal(newGoal.tasks[0].due,options[1]);
    assert.equal(newGoal.tasks[1].due,shift(options[1],7));
    const xp=()=>page.locator('#main > .flex > .pill').textContent();
    assert.equal(await xp(),'0 companion XP');
    for (const expected of (modular ? [35,35,35] : [35,0,35])) {
      await click(`[data-done="${taskId}"]`); assert.equal(await xp(),`${expected} companion XP`);
    }
    await checkpoint('created goal completion undo');
    await act('evolution'); assert.equal(await page.locator('#modalhost svg').count(),4); await act('close');
    await act('edit-goal'); await fill('title','Save for the spring school trip');
    await fill('success','Save $200 and record the total'); await submit('edit-form');
    await click('[data-lesson="smartplus"]');
    await fill('primer',seed.goals[0].plus.primer); await submit('plus-form');
    assert.equal(await page.locator('#plus-form').count(),1,'duplicate primer is rejected');
    await fill('primer','Savings jar beside my backpack'); await fill('partner','A trusted adult');
    await page.locator('[name="challenge"]').fill('8');
    assert.equal(await page.locator('#challenge-value').textContent(),'8/10');
    await page.locator('[name="contract"]').check(); await submit('plus-form');
    assert.equal(await xp(),'55 companion XP');
    await click('[data-lesson="woop"]');
    for (const [name,value] of Object.entries({wish:'Save for the trip',opportunity:'Feel prepared',obstacle:'Impulse buys',plan:'If I want a snack, then I will check my budget first.'})) await fill(name,value);
    await submit('woop-form'); assert.equal(await xp(),'80 companion XP');
    await act('evidence'); await fill('text','Recorded spending <b>honestly</b> & reviewed it.'); await fill('evidence','Budget notebook page 1');
    await submit('evidence-form');
    assert.equal(await page.locator('#main .preview b').count(),1,'journal text stays escaped');
    await checkpoint('SMART WOOP evidence'); await shot('goal-detail');
    await nav('home'); await act('checkin');
    await page.locator('[name="mood"]').selectOption('rest'); await fill('note','A planned rest day.'); await submit('checkin-form');
    await act('checkin'); await page.locator('[name="mood"]').selectOption('progress');
    await fill('note','Reviewed my budget.'); await submit('checkin-form');
    saved=await state(); assert.equal(saved.journal.length,1);
    assert.equal(saved.goals.find(g=>g.id===goalId).checkins.length,1);
    await act('partner');
    const share=await page.locator('#share-text').inputValue();
    assert.ok(share.includes('Save for the spring school trip')); assert.ok(!share.includes(seed.goals[0].title));
    await act('copy-share'); assert.equal(await page.evaluate(()=>window.copied.at(-1)),share);

    await nav('week'); assert.equal(await page.locator('.daygroup').count(),7);
    await page.locator('[data-add-date]').nth(2).click(); await fill('title','Review my savings total'); await submit('task-form');
    saved=await state(); const added=saved.goals.find(g=>g.id===goalId).tasks.at(-1);
    assert.equal(added.due,options[3]);
    await click(`[data-move="${added.id}"]`); await fill('date',options[5]); await submit('move-form');
    const beforeTimer=await state();
    await click('[data-minutes="15"]'); assert.equal(await page.locator('#timer-display').textContent(),'15:00');
    await act('timer-toggle'); await page.clock.runFor(2000); await act('timer-toggle');
    assert.equal(await page.locator('#timer-display').textContent(),'14:58');
    await nav('goals'); await nav('week'); assert.equal(await page.locator('#timer-display').textContent(),'14:58');
    await act('timer-reset'); assert.equal(await page.locator('#timer-display').textContent(),modular?'15:00':'25:00');
    await click('[data-minutes="5"]'); await act('timer-toggle'); await page.clock.runFor(300000);
    assert.equal(await page.locator('#timer-display').textContent(),'00:00');
    assert.deepEqual((await state()).goals,beforeTimer.goals,'timer must not award XP');
    await act('timer-reset');
    await act('reminder'); const calendarEvent=page.waitForEvent('download'); await submit('reminder-form');
    const calendar=await calendarEvent; assert.equal(calendar.suggestedFilename(),'H4-Goal-Quest-Reminder.ics');
    const calendarText=await readFile(await calendar.path(),'utf8');
    assert.match(calendarText,/RRULE:FREQ=DAILY;COUNT=30\r\n/); assert.match(calendarText,/BEGIN:VALARM/);
    await checkpoint('planner timer calendar');

    await nav('path');
    await click('[data-lesson="wheel"]');
    assert.equal(await page.locator('[data-wheel]').count(),7);
    await page.locator('[data-wheel="money"]').fill('8'); await act('wheel-finish');
    await click('[data-lesson="smart"]'); await act('learn-done');
    await click('[data-lesson="planner"]'); await act('learn-done');
    await nav('path'); await click('[data-lesson="partner"]'); await act('learn-done'); await page.keyboard.press('Escape');
    await click('[data-lesson="wheel"]'); assert.equal(await page.locator('[data-wheel="money"]').inputValue(),'8');
    await page.locator('#backdrop').click({position:{x:1,y:1}});
    assert.equal(await page.locator('#backdrop').count(),0);
    await checkpoint('six lessons and wheel');
    await nav('coach');
    const promptCopies=[];
    for (const key of ['clarify','woop','checkin','weekly']) {
      await click(`[data-prompt-view="${key}"]`);
      const preview=await page.locator('#coach-preview').inputValue();
      await page.locator(`#modalhost [data-prompt="${key}"]`).click();
      assert.equal(await page.evaluate(()=>window.copied.at(-1)),preview);
      assert.ok(preview.includes('Save for the spring school trip')); promptCopies.push(preview);
      await act('close');
    }
    // Exercise the original manual-copy fallback, too.
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true}));
    await click('[data-prompt="clarify"]'); await act('select-copy');
    assert.equal(await page.locator('#manual-copy').evaluate(e=>e.selectionEnd-e.selectionStart),promptCopies[0].length);
    await page.keyboard.press('Escape');
    await checkpoint('external prompts and copy fallback');

    await nav('goals');
    if(modular) await act('data-menu');
    const backupEvent=page.waitForEvent('download'); await act('backup');
    const backup=await backupEvent; assert.equal(backup.suggestedFilename(),'H4-Goal-Quest-Backup.json');
    const downloaded=JSON.parse(await readFile(await backup.path(),'utf8'));
    if(modular) {
      assert.equal(downloaded.backupVersion,1);
      assert.equal(downloaded.state.version,DATA_VERSION);
      assert.deepEqual(downloaded.state,await actualState(),'complete backup matches the full live record');
      await act('close');
    } else assert.deepEqual(Object.keys(downloaded),['exportedAt','goals','wheel','journal']);
    const backupData=modular ? {exportedAt:downloaded.exportedAt,goals:downloaded.state.goals,wheel:downloaded.state.wheel,journal:downloaded.state.journal} : downloaded;
    if(modular) { backupData.goals=legacyGoals(backupData.goals); backupData.journal=backupData.journal.map(({goalId,...c})=>c); }
    saved=await state(); assert.deepEqual(backupData.goals,saved.goals);
    await page.reload(); await page.waitForSelector('#main h1'); assert.deepEqual(await state(),saved);
    assert.deepEqual(saved.privateExtension,seed.privateExtension);
    assert.deepEqual(saved.goals[0].privateExtension,seed.goals[0].privateExtension);
    assert.deepEqual(saved.goals.slice(0,2),seed.goals,'other goals and their companion progress stay independent');
    await checkpoint('export and refresh');

    await act('new-goal'); await page.locator('[data-draft="title"]').fill('Temporary draft'); await act('wizard-exit');
    await act('new-goal'); await act('restart-wizard'); assert.equal(await page.locator('[data-draft="title"]').inputValue(),'');
    await act('wizard-exit');
    page.once('dialog',dialog=>dialog.dismiss()); await act('reset-demo');
    assert.equal((await state()).goals.length,3,'cancel preserves goals');
    page.once('dialog',dialog=>dialog.accept()); await act('reset-demo');
    saved=await state(); assert.equal(saved.demo,true); assert.equal(saved.goals.length,2); assert.equal(saved.draft,null);
    await checkpoint('demo reset');
    return {checkpoints,screenshots,calendarText,backupData,promptCopies};
  } finally { await context.close(); }
}

for (const width of [375,390,1365]) {
  test(`retained V4 workflows, copy, DOM and student-state parity at ${width}px`, {timeout:120000}, async () => {
    const server=await serve();
    const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
    try {
      const baseline=await exercise(browser,`${server.url}/reference/capstone_quest_v4.html`,width,fixture);
      // Also verifies relative module/CSS URLs under a GitHub Pages project path.
      const modular=await exercise(browser,`${server.url}/goal-quest/`,width,fixture);
      assert.equal(modular.checkpoints.length,baseline.checkpoints.length);
      for(let i=0;i<baseline.checkpoints.length;i++) {
        const a=modular.checkpoints[i], b=baseline.checkpoints[i];
        assert.equal(a.label,b.label); assert.deepEqual(a.state,b.state,a.label+' student state');
        for(let j=0;j<b.html.length;j++) {
          const first=b.html[j].split('').findIndex((c,k)=>c!==a.html[j][k]);
          assert.equal(first,-1,`${a.label} DOM ${j} at ${first}: actual ${a.html[j].slice(Math.max(0,first-60),first+180)}; expected ${b.html[j].slice(Math.max(0,first-60),first+180)}`);
          assert.equal(a.html[j].length,b.html[j].length,a.label+' DOM length');
        }
      }
      const expectedCalendar=baseline.calendarText
        .replace('BEGIN:VEVENT', 'CALSCALE:GREGORIAN\r\nBEGIN:VEVENT')
        .replace(/DTSTAMP:[^\r]+/, 'DTSTAMP:20261017T160502Z')
        .replace(/DTEND:[^\r]+/, 'DURATION:PT10M')
        .replace('TRIGGER:-PT0M','TRIGGER:PT0S');
      assert.equal(modular.calendarText,expectedCalendar);
      assert.deepEqual(modular.backupData,baseline.backupData);
      assert.deepEqual(modular.promptCopies,baseline.promptCopies);
      assert.deepEqual(modular.screenshots.map(s=>s.label),baseline.screenshots.map(s=>s.label));
      console.log(`${width}px: ${modular.checkpoints.length} paired DOM/state checkpoints, retained V4 workflows, no console errors/overflow/external requests; Phase 5 visuals verified separately`);
    } finally { await browser.close(); await server.close(); }
  });
}
