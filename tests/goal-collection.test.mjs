import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { goalStatus, isAchieved, activeGoals, dailyGoal, parkGoal, activateGoal, achieveGoal } from '../js/goal-status.js';
import { migrateState, parseBackup, serializeBackup, DATA_VERSION } from '../js/data-safety.js';
import { createStore, KEY, RECOVERY_KEY } from '../js/state.js';
import { gxp, stage, allXP } from '../js/companions.js';
const v4 = JSON.parse(readFileSync(new URL('./fixtures/v4-save.json', import.meta.url), 'utf8'));
const clone = v => structuredClone(v);
function fixture() {
  const state = migrateState(v4);
  state.goals = Array.from({ length: 5 }, (_, i) => {
    const g = clone(state.goals[0]);
    g.id = `goal-${i}`; g.title = `Goal ${i}`;
    g.tasks.forEach((t, j) => t.id = `task-${i}-${j}`);
    g.goalStatus = i < 3 ? 'active' : 'parked';
    return g;
  });
  state.selected = state.goals[3].id;
  return state;
}
const reflection = { reflection: 'I performed my whole routine.', howKnow: 'The recording is 60 seconds long.', evidence: 'Private practice video', milestone: 'Performed for a friend' };
function memory(state) {
  const data = new Map([[KEY, JSON.stringify(state)]]);
  return { data, fail: null, getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key),
    setItem(key, value) { if (key === this.fail) throw new Error('Full'); data.set(key, value); } };
}

test('V4 and V5 migration preserves every goal field, unknown data and archived meaning', () => {
  for (const version of [4, 5]) {
    const input = { ...clone(v4), version };
    input.goals[0].archived = true;
    input.goals[0].companion = { name: 'My friend', customXP: 19 };
    input.goals[0].future = { preserve: ['private'] };
    const before = clone(input), migrated = migrateState(input);
    assert.deepEqual(input, before);
    assert.deepEqual(migrated, { ...before, version: DATA_VERSION });
    assert.deepEqual(migrateState(migrated), migrated);
    assert.equal(goalStatus(migrated.goals[0]), 'archived');
    assert.equal(isAchieved(migrated.goals[0]), false);
    assert.equal(goalStatus(migrated.goals[1]), 'active');
    assert.deepEqual(parseBackup(serializeBackup(input)).state, migrated);
  }
});

test('parking/reactivating preserves tasks, reflections, companion, archived source and XP', () => {
  const state = fixture(), g = state.goals[0];
  g.archived = true; g.companion = { nickname: 'Keep me' };
  const before = clone(g), xp = gxp(g), evolution = stage(g);
  assert.equal(parkGoal(g), true);
  assert.deepEqual(g, { ...before, goalStatus: 'parked' });
  assert.equal(activateGoal(state, g), true);
  assert.deepEqual(g, before);
  assert.equal(gxp(g), xp); assert.equal(stage(g), evolution);
  assert.equal(g.archived, true, 'explicit choice supersedes but never deletes legacy field');
});

test('a fourth active goal requires an atomic valid parking choice', () => {
  const state = fixture(), target = state.goals[3], before = clone(state);
  for (const ids of [[], ['missing'], [target.id], [state.goals[4].id]]) {
    assert.equal(activateGoal(state, target, ids), false);
    assert.deepEqual(state, before);
  }
  assert.equal(activateGoal(state, target, [state.goals[0].id]), true);
  assert.equal(activeGoals(state).length, 3);
  assert.equal(goalStatus(state.goals[0]), 'parked');
  assert.equal(goalStatus(target), 'active');
});

test('legacy collections above three are never auto-parked; new activation needs enough room', () => {
  const state = fixture(); state.goals.forEach(g => delete g.goalStatus);
  const migrated = migrateState(state);
  assert.equal(activeGoals(migrated).length, 5);
  const target = migrated.goals[4]; parkGoal(target);
  const before = clone(migrated);
  assert.equal(activateGoal(migrated, target, [migrated.goals[0].id]), false);
  assert.deepEqual(migrated, before);
  assert.equal(activateGoal(migrated, target, [migrated.goals[0].id, migrated.goals[1].id]), true);
  assert.equal(activeGoals(migrated).length, 3);
});

test('Today chooses an active companion even with a parked or achieved selection', () => {
  const state = fixture();
  assert.equal(dailyGoal(state), state.goals[0]);
  achieveGoal(state.goals[3], reflection);
  assert.equal(dailyGoal(state), state.goals[0]);
  state.goals.filter(g => !isAchieved(g)).forEach(parkGoal);
  assert.equal(dailyGoal(state), undefined);
});

test('task completion does not achieve a goal; achievement also permits unfinished actions', () => {
  const state = fixture(), g = state.goals[0];
  g.tasks.forEach(t => t.doneAt = new Date().toISOString());
  assert.equal(isAchieved(migrateState(state).goals[0]), false);
  g.tasks[0].doneAt = null;
  const before = clone(g), xp = gxp(g), total = allXP(state);
  const now = new Date('2026-10-17T16:00:00Z');
  assert.equal(achieveGoal(g, reflection, now), true);
  assert.equal(g.goalAchievement.achievedAt, now.toISOString());
  assert.deepEqual(g.tasks, before.tasks); assert.deepEqual(g.notes, before.notes);
  assert.equal(gxp(g), xp); assert.equal(allXP(state), total);
  const completed = clone(g);
  assert.equal(achieveGoal(g, { ...reflection, reflection: 'Duplicate' }), false);
  assert.equal(parkGoal(g), false); assert.equal(activateGoal(state, g), false);
  assert.deepEqual(g, completed);
});

test('empty/invalid reflections never create an achievement or change progress', () => {
  for (const data of [{ ...reflection, reflection: ' ' }, { ...reflection, howKnow: '' }, { ...reflection, evidence: null }]) {
    const g = fixture().goals[0], before = clone(g);
    assert.equal(achieveGoal(g, data), false); assert.deepEqual(g, before);
  }
});

test('invalid goal states and incomplete achievement records are rejected before any restore', () => {
  const valid = fixture(); achieveGoal(valid.goals[0], reflection);
  for (const change of [g => g.goalStatus = 'done', g => g.goalStatus = null,
    g => delete g.goalAchievement, g => g.goalAchievement = null,
    g => g.goalAchievement.howKnow = ' ', g => g.goalAchievement.reflection = 'x'.repeat(701),
    g => g.goalAchievement.date = '2026-02-30', g => g.goalAchievement.achievedAt = 'today',
    g => g.goalStatus = 'parked', g => g.goalAchievement.evidence = 123]) {
    const s = clone(valid); change(s.goals[0]);
    assert.throws(() => parseBackup(JSON.stringify(s)));
  }
});

test('mixed states round-trip through backup, restore, reload and recovery with unknown fields', () => {
  const state = fixture(); achieveGoal(state.goals[0], reflection);
  state.goals[0].goalAchievement.future = { keep: true };
  state.goals[4].archived = true; delete state.goals[4].goalStatus;
  const raw = serializeBackup(state), disk = memory(v4), store = createStore(disk), original = clone(store.state);
  assert.equal(store.restore(store.prepareRestore(raw), true), true);
  assert.deepEqual(store.state, state);
  assert.deepEqual(createStore(disk).state, state);
  assert.deepEqual(parseBackup(store.backup()).state, state);
  assert.deepEqual(store.recovery().workingState, original);
  assert.equal(store.restore(store.prepareRestore(JSON.stringify(original)), true), true);
  assert.deepEqual(store.state, original);
  assert.deepEqual(store.recovery().workingState, state);
});

test('V5 migration retains raw recovery and does not commit if either storage write fails', () => {
  for (const fail of [null, KEY, RECOVERY_KEY]) {
    const state = { ...clone(v4), version: 5 }, disk = memory(state), original = disk.data.get(KEY);
    disk.data.set(RECOVERY_KEY, 'earlier recovery'); disk.fail = fail;
    const store = createStore(disk);
    assert.equal(store.persist(), fail === null);
    if (fail) { assert.equal(disk.data.get(KEY), original); assert.equal(disk.data.get(RECOVERY_KEY), 'earlier recovery'); }
    else { assert.equal(store.recovery().raw, original); assert.deepEqual(store.state, { ...state, version: DATA_VERSION }); }
  }
});
