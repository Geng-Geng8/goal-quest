import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { createFocusTimer } from '../js/focus-timer.js';
import { emptyState, migrateState, parseBackup, serializeBackup, DATA_VERSION } from '../js/data-safety.js';
import { createStore, KEY, RECOVERY_KEY, initial } from '../js/state.js';
import { toggleTask, gxp } from '../js/gameplay.js';
import { momentum } from '../js/companions.js';

function timerHarness(focus = { minutes: 25 }, clock = 1000000) {
  let state = focus, now = clock, completions = 0, writes = 0;
  const intervals = new Set();
  const timer = createFocusTimer({ read: () => state, write: f => { state = f; writes++; }, now: () => now,
    schedule: callback => { intervals.add(callback); return callback; }, unschedule: callback => intervals.delete(callback),
    complete: () => completions++ });
  timer.reload();
  return { timer, intervals, get state() { return state; }, get writes() { return writes; }, get completions() { return completions; }, advance: ms => { now += ms; } };
}
test('timer pauses exactly, resumes, resets selected duration, and never overlaps intervals', () => {
  const h = timerHarness();
  h.timer.toggle(); h.advance(1234); h.timer.toggle();
  assert.equal(h.state.remainingMs, 1500000 - 1234);
  assert.equal(h.state.status, 'paused'); assert.equal(h.intervals.size, 0);
  h.advance(99999); assert.equal(h.timer.remaining(), 1498766);
  h.timer.toggle(); assert.equal(h.intervals.size, 1);
  h.timer.reload(); h.timer.reload(); assert.equal(h.intervals.size, 1);
  h.advance(8766); assert.equal(h.timer.remaining(), 1490000);
  h.timer.reset(5); assert.equal(h.timer.remaining(), 300000); assert.equal(h.intervals.size, 0);
  h.timer.toggle(); h.advance(4000); h.timer.reset(); assert.equal(h.timer.remaining(), 300000);
});
test('timer catches up after suspended callbacks and reload, persists completion once, and awards no XP', () => {
  const h = timerHarness(); h.timer.toggle(); h.advance(60000);
  const restored = timerHarness(structuredClone(h.state), 1060000);
  assert.equal(restored.timer.remaining(), 1440000);
  restored.advance(2000000); restored.timer.refresh();
  assert.equal(restored.state.status, 'complete'); assert.equal(restored.completions, 1);
  for (let i = 0; i < 10; i++) { restored.timer.refresh(); restored.timer.reload(); restored.timer.toggle(); }
  assert.equal(restored.completions, 1); assert.equal(restored.intervals.size, 0);
  assert.equal(timerHarness(restored.state).completions, 0);
  assert.equal(h.writes, 1, 'refresh ticks do not persist');
  assert.equal(Object.hasOwn(restored.state, 'xp'), false);
});
test('paused timer reload ignores time away; overdue running reload announces once', () => {
  const h = timerHarness(); h.timer.reset(15); h.timer.toggle(); h.advance(550); h.timer.toggle();
  const paused = timerHarness(h.state, 90000000);
  assert.equal(paused.timer.remaining(), 899450); assert.equal(paused.intervals.size, 0);
  const late = timerHarness({ minutes:5, status:'running', remainingMs:300000, deadline:999999 });
  assert.equal(late.completions, 1); assert.equal(late.state.status, 'complete');
});
test('V4–V7 migrate additively to V8 without injecting timer or local-day metadata', () => {
  for (const version of [4,5,6,7]) {
    const state = { ...initial(), version }; const before = structuredClone(state);
    const migrated = migrateState(state);
    assert.deepEqual(state, before);
    assert.deepEqual(migrated, { ...before, version: DATA_VERSION });
    assert.deepEqual(migrateState(migrated), migrated);
  }
});
test('undoing a legacy re-completion preserves its original reward day and cannot refresh momentum', () => {
  const state = migrateState(initial()), g = state.goals[1], t = g.tasks[0];
  t.rewardedAt = new Date('2026-01-01T12:00:00').toISOString();
  t.doneAt = new Date('2026-10-17T12:00:00').toISOString();
  const xp = gxp(g);
  toggleTask(g, t, '2026-10-17T14:00:00.000Z');
  assert.equal(t.rewardedDate, '2026-01-01');
  toggleTask(g, t, '2026-10-17T14:00:00.000Z');
  assert.equal(t.rewardedDate, '2026-01-01'); assert.equal(gxp(g), xp);
  // Remove unrelated demo actions; this first credit is outside the seven-day window.
  state.goals = [g]; g.tasks = [t]; state.journal = [];
  assert.equal(momentum(state, '2026-10-17').actions, 0);
});
test('validated timer and local-day metadata round-trip with unknown fields; invalid snapshots reject', () => {
  const state = migrateState(initial());
  state.focus = { minutes:5, status:'running', remainingMs:300000, deadline:123456789, extra:{keep:true} };
  state.goals[0].tasks[0].completedDate = '2026-10-17';
  state.goals[0].tasks[0].rewardedDate = '2026-10-17';
  assert.deepEqual(parseBackup(serializeBackup(state)).state, state);
  for (const patch of [{status:'bogus'}, {remainingMs:-1}, {remainingMs:300001}, {deadline:NaN}, {deadline:null}, {remainingMs:0}, {status:'paused'}, {status:'complete',deadline:null,remainingMs:1}]) {
    assert.throws(() => migrateState({ ...state, focus:{...state.focus, ...patch} }));
  }
  for (const focus of [{minutes:5,deadline:123}, {minutes:5,remainingMs:100}, {minutes:5,status:'paused',remainingMs:NaN,deadline:null}]) assert.throws(() => migrateState({...state,focus}));
  const bad = structuredClone(state); bad.goals[0].tasks[0].completedDate = '2026-02-30'; assert.throws(() => migrateState(bad));
});
test('timer storage failure keeps progress and timer exportable; restore retains recovery and selected timer', () => {
  const disk = new Map([[KEY, JSON.stringify(emptyState())]]); let fail = false;
  const store = createStore({getItem:k=>disk.get(k)??null, setItem:(k,v)=>{if(fail) throw Error('full');disk.set(k,v);},removeItem:k=>disk.delete(k)});
  const before = disk.get(KEY);
  const timer = createFocusTimer({read:()=>store.state.focus,write:f=>{store.state.focus=f;store.persist();},schedule:()=>1,unschedule:()=>{}});
  fail = true; timer.toggle();
  assert.equal(store.status.kind, 'warning'); assert.equal(disk.get(KEY), before);
  const backup = store.backup(); assert.equal(parseBackup(backup).state.focus.status, 'running');
  fail = false; const prepared = store.prepareRestore(backup); assert.equal(store.restore(prepared,true),true);
  assert.equal(JSON.parse(disk.get(RECOVERY_KEY)).raw,before);
  assert.deepEqual(createStore({getItem:k=>disk.get(k)??null}).state.focus,store.state.focus);
  timer.stop();
});
for (const tz of ['America/Toronto', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Kathmandu', 'UTC']) {
  test(`local days, midnight, DST, check-ins, momentum, achievement and calendar in ${tz}`, () => {
    // Separate processes ensure host timezone cannot make the test pass accidentally.
    const source = `
      import assert from 'node:assert/strict';
      import {localISO,shift,week,initial} from './js/state.js';
      import {toggleTask,saveCheckin,gxp} from './js/gameplay.js';
      import {momentum} from './js/companions.js';
      import {achieveGoal} from './js/goal-status.js';
      import {calendarContent} from './js/planner.js';
      for (const date of ['2026-03-07','2026-03-08','2026-03-09','2026-10-31','2026-11-01','2026-11-02','2024-02-29','2026-12-31']) {
        assert.equal(localISO(date),date);
        assert.equal(shift(shift(date,1),-1),date);
        const before=new Date(date+'T23:59:59'), after=new Date(before.getTime()+2000);
        assert.equal(localISO(before),date); assert.equal(localISO(after),shift(date,1));
        const state=initial(),g=state.goals[1],t=g.tasks[0],due=t.due;
        toggleTask(g,t,before.toISOString()); assert.equal(t.completedDate,date); assert.equal(t.rewardedDate,date); assert.equal(t.due,due);
        saveCheckin(state,g,date,'rest','Rest');const xp=gxp(g);
        saveCheckin(state,state.goals[0],localISO(before.toISOString()),'progress','Edited');
        assert.equal(state.journal.length,1);assert.equal(gxp(g),xp); assert.equal(momentum(state,date).checkins,1);
        achieveGoal(g,{reflection:'Finished',howKnow:'Result'},before);assert.equal(g.goalAchievement.date,date);
        const text=calendarContent('19:00',before,'test');
        assert.ok(text.includes('DTSTART:'+shift(date,1).replaceAll('-','')+'T190000\\r\\n'));
        assert.ok(text.includes('DTSTAMP:'+before.toISOString().replace(/[-:]/g,'').replace(/\\.\\d{3}Z$/,'Z')+'\\r\\n'));
        assert.ok(text.includes('DURATION:PT10M\\r\\n'));assert.ok(text.endsWith('END:VCALENDAR\\r\\n'));
      }
      assert.equal(week().length,7);
      if (['America/Toronto','America/Los_Angeles'].includes(process.env.TZ)) {
        assert.equal((new Date('2026-03-08T12:00:00')-new Date('2026-03-07T12:00:00'))/3600000,23);
        assert.equal((new Date('2026-11-01T12:00:00')-new Date('2026-10-31T12:00:00'))/3600000,25);
      }
      const travel=initial(),task=travel.goals[1].tasks[0];
      toggleTask(travel.goals[1],task,new Date('2026-10-17T23:59:59').toISOString());
      const recorded=task.completedDate;
      process.env.TZ=process.env.TZ==='Pacific/Kiritimati'?'America/Los_Angeles':'Pacific/Kiritimati';
      assert.equal(task.completedDate,recorded);assert.equal(task.rewardedDate,recorded);
      assert.ok(momentum(travel,recorded).actions>=1);
      process.env.TZ=${JSON.stringify(tz)};
      const content=calendarContent('02:30',new Date('2026-03-07T23:00:00'),'dst');
      assert.ok(content.includes('DTSTART:20260308T033000') || content.includes('DTSTART:20260308T023000'));
      assert.throws(()=>calendarContent('24:00'));
    `;
    execFileSync(process.execPath, ['--input-type=module','-e',source], {cwd:new URL('../',import.meta.url),env:{...process.env,TZ:tz},stdio:'pipe'});
  });
}
