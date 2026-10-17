import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { legacyXP, gxp, toggleTask, rewardPlan, saveCheckin } from '../js/gameplay.js';
import { stage, xpToNext, mascot, companionName, momentum, quest, evolutionHTML } from '../js/companions.js';
import { migrateState, parseBackup, serializeBackup, DATA_VERSION, MAX_BACKUP_BYTES } from '../js/data-safety.js';
import { nearLimitState } from './support/near-limit.mjs';
import { createStore, KEY, RECOVERY_KEY } from '../js/state.js';
import { parkGoal, activateGoal, achieveGoal } from '../js/goal-status.js';
const v4 = JSON.parse(readFileSync(new URL('./fixtures/v4-save.json', import.meta.url), 'utf8'));
const fixture = () => migrateState(v4);
const at = '2026-10-17T12:00:00Z';
const plan = { wish: 'Learn a routine', opportunity: 'Feel proud', obstacle: 'Distraction', plan: 'If distracted, then practise five minutes.' };

test('V4/V5/V6 migration preserves exact legacy XP/stages, caps and unknown fields without per-goal overhead', () => {
  for (const version of [4, 5, 6]) for (const count of [0, 4, 9, 13, 301]) {
    const input = structuredClone(v4); input.version = version;
    const g = input.goals[0];
    g.tasks = Array.from({ length: count }, (_, i) => ({ id: `legacy-${i}`, title: 'Practice', due: '2026-10-17', doneAt: at }));
    g.checkins = Array.from({ length: 101 }, () => ({ date: '2026-10-16', mood: 'rest' }));
    g.companion = { nickname: 'Nova', future: { keep: true } };
    const xp = legacyXP(g), before = structuredClone(input), migrated = migrateState(input);
    assert.deepEqual(input, before);
    assert.deepEqual(migrated, { ...before, version: DATA_VERSION });
    assert.equal(gxp(migrated.goals[0]), xp); assert.equal(stage(migrated.goals[0]), Math.min(4, 1 + Math.floor(xp / 145)));
    assert.deepEqual(migrateState(migrated), migrated);
    assert.deepEqual(parseBackup(serializeBackup(input)).state, migrated);
  }
});
test('one-time task credit survives undo, repeated completion and reload without taking XP away', () => {
  const state = fixture(), g = state.goals[0], t = g.tasks.find(t => !t.doneAt), base = gxp(g);
  assert.equal(toggleTask(g, t, at), 35);
  for (let i = 0; i < 5; i++) { assert.equal(toggleTask(g, t, at), 0); assert.equal(toggleTask(g, t, at), 0); }
  assert.equal(gxp(g), base + 35);
  const reload = parseBackup(serializeBackup(state)).state.goals[0];
  assert.equal(toggleTask(reload, reload.tasks.find(x => x.id === t.id), at), 0);
  assert.equal(gxp(reload), base + 35);
  const legacy = g.tasks[0];
  if (legacy) { toggleTask(g, legacy, at); toggleTask(g, legacy, at); assert.equal(gxp(g), base + 35); }
});
test('legacy task above the old cap cannot re-earn; additional real tasks and days have no old caps', () => {
  const state = fixture(), g = state.goals[0];
  g.tasks = Array.from({ length: 301 }, (_, i) => ({ id: `done-${i}`, title: 'Practice', due: '2026-10-17', doneAt: at }));
  g.checkins = Array.from({ length: 101 }, () => ({ date: '2026-10-16', mood: 'progress' }));
  const base = gxp(g);
  toggleTask(g, g.tasks[300], at); toggleTask(g, g.tasks[300], at);
  assert.equal(gxp(g), base);
  const t = { id: 'next-action', title: 'A new real action', due: '2026-10-17', doneAt: null }; g.tasks.push(t);
  assert.equal(toggleTask(g, t, at), 35);
  assert.equal(saveCheckin(state, g, '2026-10-17', 'rest', ''), 10);
  assert.equal(gxp(g), base + 45);
});
test('WOOP needs four answers and plan/commitment edits or repeated submissions cannot farm rewards', () => {
  const g = fixture().goals[1], base = gxp(g);
  assert.equal(rewardPlan(g, 'woop', { plan: 'Just tapping save' }), 0);
  assert.equal(rewardPlan(g, 'woop', plan), 25); g.woop = plan;
  for (const next of [{}, plan, { ...plan, plan: 'Updated plan' }]) { assert.equal(rewardPlan(g, 'woop', next), 0); g.woop = next; }
  assert.equal(rewardPlan(g, 'commitment', { contract: true }), 20); g.plus.contract = true;
  assert.equal(rewardPlan(g, 'commitment', { contract: false }), 0); g.plus.contract = false;
  assert.equal(rewardPlan(g, 'commitment', { contract: true }), 0);
  assert.equal(gxp(g), base + 45);
});

for (const status of ['parked', 'legacy archived']) {
  test(`${status} planning earns once, preserves focus and survives restore/reactivation`, () => {
    const state = fixture(), g = state.goals[0];
    if (status === 'parked') g.goalStatus = 'parked'; else { delete g.goalStatus; g.archived = true; }
    g.plus.contract = false; g.woop = { ...g.woop, plan:'' };
    g.companion = { nickname:'Nova', accent:'mint', accessory:'scarf', future:{ kept:true } };
    g.tasks.slice(0,4).forEach(t => t.doneAt = at);
    // Three other active goals: planning must not bypass the focus choice.
    for (let i = 0; i < 2; i++) {
      const other = structuredClone(state.goals[1]); other.id = `other-${i}`;
      other.tasks.forEach((t,j) => t.id = `other-${i}-${j}`); state.goals.push(other);
    }
    const before = structuredClone(g), base = gxp(g), evolution = stage(g);
    const activeIds = () => state.goals.filter(x => !x.archived && (!x.goalStatus || x.goalStatus === 'active')).map(x => x.id);
    const activeBefore = activeIds();
    assert.equal(rewardPlan(g,'woop',plan),25); g.woop = { ...g.woop, ...plan };
    assert.equal(rewardPlan(g,'commitment',{contract:true}),20); g.plus.contract = true;
    assert.equal(gxp(g),base+45); assert.ok(stage(g) >= evolution);
    assert.deepEqual(activeIds(),activeBefore); assert.deepEqual(g.tasks,before.tasks); assert.deepEqual(g.companion,before.companion);
    assert.equal(toggleTask(g,g.tasks[4],at),0);
    for (let i = 0; i < 3; i++) {
      assert.equal(rewardPlan(g,'woop',plan),0);
      assert.equal(rewardPlan(g,'commitment',{contract:false}),0); g.plus.contract = false;
      assert.equal(rewardPlan(g,'commitment',{contract:true}),0); g.plus.contract = true;
    }
    const restored = parseBackup(serializeBackup(state)).state, target = restored.goals[0];
    assert.deepEqual(target,g);
    assert.equal(activateGoal(restored,target),false,'three active goals still require a parking choice');
    assert.equal(activateGoal(restored,target,[restored.goals[1].id]),true);
    assert.equal(rewardPlan(target,'woop',plan),0); assert.equal(rewardPlan(target,'commitment',{contract:true}),0);
    assert.equal(gxp(target),base+45); assert.deepEqual(target.companion,before.companion);
  });
  test(`${status} can claim a previously withheld plan reward once without changing existing progress`, () => {
    const state = fixture(), g = state.goals[0];
    if (status === 'parked') g.goalStatus = 'parked'; else { delete g.goalStatus; g.archived = true; }
    g.woop = { ...g.woop, ...plan }; g.plus.contract = true;
    g.rewards = { xp:150, woop:false, commitment:false, future:{ keep:true } };
    const before = structuredClone(g);
    assert.equal(rewardPlan(g,'woop',plan),25); assert.equal(rewardPlan(g,'commitment',g.plus),20);
    assert.equal(gxp(g),195); assert.equal(stage(g),stage(before));
    assert.deepEqual(g,{ ...before, rewards:{ ...before.rewards, xp:195, woop:true, commitment:true } });
    assert.equal(rewardPlan(g,'woop',plan),0); assert.equal(rewardPlan(g,'commitment',g.plus),0);
    assert.deepEqual(parseBackup(serializeBackup(state)).state,state);
  });
}
test('achieved plan rewards are rejected before initializing or changing reward metadata', () => {
  for (const existing of [false,true]) {
    const g = fixture().goals[0];
    achieveGoal(g,{reflection:'Performed it',howKnow:'My recording'});
    if (existing) g.rewards = { xp:gxp(g), woop:false, commitment:false };
    const before = structuredClone(g);
    assert.equal(rewardPlan(g,'woop',plan),0); assert.equal(rewardPlan(g,'commitment',{contract:true}),0);
    assert.deepEqual(g,before);
  }
});
test('check-in updates and switching goals keep one daily reward on the original companion, including rest', () => {
  const state = fixture(), [a,b] = state.goals, xa = gxp(a), xb = gxp(b);
  state.journal = []; a.checkins = []; b.checkins = [];
  assert.equal(saveCheckin(state, a, '2026-10-17', 'rest', 'Recovering'), 10);
  assert.equal(saveCheckin(state, a, '2026-10-17', 'progress', 'Updated'), 0);
  assert.equal(saveCheckin(state, b, '2026-10-17', 'stuck', 'Changed selection'), 0);
  assert.equal(state.journal.length, 1); assert.equal(state.journal[0].goalId, a.id);
  assert.equal(gxp(a), xa + 10); assert.equal(gxp(b), xb);
  assert.equal(b.checkins.length, 0);
  assert.equal(saveCheckin(state, b, '2026-10-18', 'progress', ''), 10);
});
test('independent identity, appearance, rewards and lifecycle survive backup, restore, recovery and reload', () => {
  const state = fixture(), [a,b] = state.goals; b.category = a.category;
  a.companion = { nickname: 'Nova <&>', accent: 'mint', accessory: 'scarf', future: { keep: true } };
  b.companion = { nickname: 'Pip', accent: 'sunset', accessory: 'star' };
  toggleTask(a, a.tasks.find(t => !t.doneAt), at);
  const identity = structuredClone(a.companion), xp = gxp(a), evolution = stage(a);
  parkGoal(a); assert.equal(activateGoal(state, a), true);
  assert.equal(achieveGoal(a, { reflection: 'Performed it', howKnow: 'My recording' }), true);
  assert.deepEqual(a.companion, identity); assert.equal(gxp(a), xp); assert.equal(stage(a), evolution);
  assert.equal(companionName(b), 'Pip'); assert.notEqual(mascot(a), mascot(b));
  assert.match(quest(a), /Nova &lt;&amp;&gt;/); assert.match(evolutionHTML(a), /Nova &lt;&amp;&gt;/);
  const raw = JSON.stringify(state), disk = new Map([[KEY, raw]]);
  const storage = { getItem: k => disk.get(k) ?? null, setItem: (k,v) => disk.set(k,v), removeItem: k => disk.delete(k) };
  const store = createStore(storage); assert.equal(store.persist(), true);
  assert.equal(store.restore(store.prepareRestore(serializeBackup(fixture())), true), true);
  assert.ok(disk.has(RECOVERY_KEY));
  const recovery = store.prepareRestore(serializeBackup(store.recovery().workingState)); assert.equal(store.restore(recovery, true), true);
  const reloaded = createStore(storage);
  assert.deepEqual(reloaded.state.goals[0], a);
  assert.equal(gxp(reloaded.state.goals[0]), xp);
});
test('schema 6 migration preserves exact original disk text before the first write', () => {
  const state = fixture(); state.version = 6; const raw = JSON.stringify(state);
  const disk = new Map([[KEY, raw]]), store = createStore({ getItem:k => disk.get(k) ?? null, setItem:(k,v) => disk.set(k,v), removeItem:k => disk.delete(k) });
  assert.equal(store.persist(), true);
  assert.equal(JSON.parse(disk.get(RECOVERY_KEY)).raw, raw);
  assert.equal(JSON.parse(disk.get(KEY)).version, 7);
});
test('parked, achieved and archived goals cannot reward task controls; reactivation retains one-time credits', () => {
  for (const status of ['parked', 'archived', 'achieved']) {
    const state = fixture(), g = state.goals[0], t = g.tasks.find(t => !t.doneAt);
    toggleTask(g, t, at); toggleTask(g, t, at); g.goalStatus = status;
    const before = structuredClone(g); assert.equal(toggleTask(g, t, at), 0); assert.deepEqual(g, before);
    if (status !== 'achieved') { assert.equal(activateGoal(state, g), true); assert.equal(toggleTask(g, t, at), 0); }
  }
});
test('momentum counts unique recent activity days, ignores all overdue work and keeps past wins after lifecycle changes', () => {
  const state = fixture(); state.goals.forEach(g => { g.tasks.forEach(t => { t.doneAt = null; t.due = '2020-01-01'; }); });
  state.journal = [];
  assert.deepEqual(momentum(state, '2026-10-17'), { days:0, actions:0, checkins:0 });
  const [a,b] = state.goals;
  toggleTask(a, a.tasks[0], at); toggleTask(a, a.tasks[1], at);
  saveCheckin(state, a, '2026-10-16', 'rest', 'Illness');
  state.journal.push({ date:'2026-10-16', mood:'rest' });
  const expected = { days:2, actions:2, checkins:1 };
  for (const status of ['active', 'parked', 'achieved', 'archived']) { a.goalStatus = status; b.goalStatus = status; assert.deepEqual(momentum(state, '2026-10-17'), expected); }
  assert.deepEqual(momentum(state, '2026-10-25'), { days:0, actions:0, checkins:0 });
  a.goalStatus = 'active'; toggleTask(a, a.tasks[0], '2026-10-25T12:00:00Z'); toggleTask(a, a.tasks[0], '2026-10-25T12:00:00Z');
  assert.deepEqual(momentum(state, '2026-10-25'), { days:0, actions:0, checkins:0 });
});
test('stage progress resets toward the next form and evolution previews show the correct four forms', () => {
  const g = fixture().goals[0];
  for (const [xp,s,pct] of [[0,1,0],[144,1,99],[145,2,0],[289,2,99],[290,3,0],[434,3,99],[435,4,100],[900,4,100]]) {
    g.rewards = { xp, woop:false, commitment:false };
    assert.equal(stage(g), s); assert.equal(xpToNext(g), pct);
    assert.match(quest(g), new RegExp(`aria-valuenow="${pct}"`));
    const html = evolutionHTML(g);
    for (const i of [1,2,3,4]) assert.match(html, new RegExp(`aria-label="[^"\\n]+ evolution stage ${i}"`));
    assert.equal(new Set([...html.matchAll(/radialGradient id="([^"]+)"/g)].map(m => m[1])).size, 4);
  }
});
test('invalid identity/reward data is rejected while compatible nested extension fields round-trip', () => {
  for (const extra of [{ companion:null }, { companion:{ accent:'unknown' } }, { companion:{ accessory:'shop' } }, { companion:{ nickname:4 } }, { rewards:{ xp:-1, woop:false, commitment:false } }, { rewards:{ xp:35 } }]) {
    const state = fixture(); Object.assign(state.goals[0], extra); assert.throws(() => parseBackup(JSON.stringify(state)));
  }
  const state = fixture(); state.goals[0].rewards = { xp:80, woop:true, commitment:false, future:{ kept:true } };
  assert.deepEqual(parseBackup(serializeBackup(state)).state, state);
});

test('schema 6 at the full byte limit migrates without growing; full-limit new identities and rewards restore', () => {
  for (const version of [6,7]) {
    const state = fixture(); state.version = version;
    if (version === 7) {
      state.goals[0].companion = { nickname:'Nova', accent:'mint', accessory:'scarf' };
      toggleTask(state.goals[0],state.goals[0].tasks.find(t => !t.doneAt),at);
    }
    const limit = nearLimitState(state), disk = new Map([[KEY, JSON.stringify(limit)]]);
    const store = createStore({getItem:k => disk.get(k) ?? null,setItem:(k,v) => disk.set(k,v),removeItem:k => disk.delete(k)});
    assert.equal(store.persist(),true);
    assert.equal(Buffer.byteLength(disk.get(KEY)),MAX_BACKUP_BYTES);
    const backup = store.backup(); assert.ok(Buffer.byteLength(backup) <= MAX_BACKUP_BYTES);
    assert.deepEqual(parseBackup(backup).state,{...limit,version:7});
  }
});
test('even the largest supported imported XP total stays valid and exportable after an action', () => {
  const state = fixture(), g = state.goals[0];
  g.rewards = { xp:Number.MAX_SAFE_INTEGER, woop:true, commitment:true };
  assert.equal(toggleTask(g,g.tasks.find(t => !t.doneAt),at),0);
  assert.equal(gxp(g),Number.MAX_SAFE_INTEGER);
  assert.deepEqual(parseBackup(serializeBackup(state)).state,state);
});
