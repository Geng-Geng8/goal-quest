import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createStore, KEY, RECOVERY_KEY } from '../js/state.js';
import { DATA_VERSION, MAX_BACKUP_BYTES, emptyState, migrateState, parseSavedState, parseBackup, serializeBackup } from '../js/data-safety.js';
import { gxp, stage } from '../js/companions.js';
import { nearLimitState } from './support/near-limit.mjs';

// These two fixtures were captured from the unchanged V4 initial()/backup(),
// using only synthetic demo goals. The second is V4's real partial export.
const v4 = JSON.parse(readFileSync(new URL('./fixtures/v4-save.json', import.meta.url), 'utf8'));
const partial = readFileSync(new URL('./fixtures/v4-backup.json', import.meta.url), 'utf8');
const clone = v => JSON.parse(JSON.stringify(v));
function memory(raw = JSON.stringify(v4)) {
  const data = new Map(raw === null ? [] : [[KEY, raw]]), writes = [];
  const storage = {
    data, writes, fail: null, readFail: false,
    getItem(key) { if (this.readFail) throw new Error('Storage blocked'); return data.get(key) ?? null; },
    removeItem(key) { if (this.fail === key || this.fail === '*') throw new Error('Storage blocked'); data.delete(key); },
    setItem(key, value) { if (this.fail === key || this.fail === '*') throw new Error('QuotaExceededError'); writes.push(key); data.set(key, value); }
  };
  return storage;
}
function complete() {
  const state = clone(v4);
  state.demo = false;
  state.lessons = { smart: true, woop: true, future: { visited: true } };
  state.wheel = { school: 8, money: 3 };
  state.journal = [{ date: '2026-10-17', mood: 'rest', note: 'Rest and reflect.' }];
  state.goals[0].notes = [{ date: '2026-10-17', text: '<b>My reflection</b>', evidence: 'Notebook' }];
  state.goals[0].checkins = [{ date: '2026-10-17', mood: 'progress' }];
  state.goals[0].plus.future = { keep: true };
  state.goals[0].woop.future = ['keep'];
  state.goals[0].companion = { xp: 80, nickname: 'My buddy' };
  state.preferences = { reducedMotion: true, future: { keep: 9 } };
  state.format = 'a future state field';
  state.backupVersion = 'a future state field';
  state.future = { deep: [null, true, 'private', 123] };
  state.draft = { step: 3, category: 'school', title: 'Draft', why: 'For me', success: 'Try', agree: 'yes', realistic: 'Time', date: '2026-12-01', dateType: 'review', tasks: [{ id: 'draft-task', title: 'Start' }], schedule: { 'draft-task': '2026-10-18' }, future: 'keep' };
  return state;
}

test('full backup round trip retains every field, draft, preference and companion progress', () => {
  const before = complete();
  const raw = serializeBackup(before), envelope = JSON.parse(raw), after = parseBackup(raw).state;
  assert.equal(envelope.format, 'h4-goal-quest'); assert.equal(envelope.backupVersion, 1);
  assert.deepEqual(after, { ...before, version: DATA_VERSION });
  assert.equal(before.version, 4, 'migration never mutates the input');
  assert.deepEqual(after.goals.map(gxp), before.goals.map(gxp));
  assert.deepEqual(after.goals.map(stage), before.goals.map(stage));
  assert.deepEqual(parseBackup(serializeBackup(after)).state, after);
  assert.deepEqual(parseBackup(JSON.stringify(after)).state, after);
});

test('export rejects excess data without trimming or modifying the working record', () => {
  const disk = memory(), store = createStore(disk);
  store.state.future = Array(12).fill('x'.repeat(190000));
  const before = clone(store.state), raw = disk.data.get(KEY);
  assert.throws(() => store.backup(), /too large/);
  assert.deepEqual(store.state, before); assert.equal(disk.data.get(KEY), raw);
  assert.deepEqual(disk.writes, []);
});

test('every successful boundary save exports and restores, including a full 2 MiB saved record', () => {
  for (const offset of [-512, -128, -1, 0, 1]) {
    const disk = memory(JSON.stringify(emptyState())), store = createStore(disk), previous = disk.data.get(KEY);
    const state = nearLimitState(migrateState(complete()), MAX_BACKUP_BYTES + offset);
    assert.equal(Buffer.byteLength(JSON.stringify(state)), MAX_BACKUP_BYTES + offset);
    Object.assign(store.state, state);
    const saved = store.persist();
    assert.equal(saved, offset <= 0);
    if (!saved) { assert.equal(disk.data.get(KEY), previous); continue; }
    for (const source of [store, createStore(disk)]) {
      const backup = source.backup();
      assert.ok(Buffer.byteLength(backup) <= MAX_BACKUP_BYTES);
      assert.deepEqual(parseBackup(backup).state, state);
      const restored = createStore(memory(null));
      assert.equal(restored.restore(restored.prepareRestore(backup), true), true);
      assert.deepEqual(restored.state, state);
    }
  }
});

test('a saved record at the nesting limit remains exportable without envelope overhead', () => {
  const disk = memory(JSON.stringify(emptyState())), store = createStore(disk);
  let extension = 'end'; for (let i = 0; i < 31; i++) extension = { next: extension };
  store.state.future = extension;
  assert.equal(store.persist(), true);
  assert.deepEqual(parseBackup(store.backup()).state, store.state);
});

test('actual V4 full save and actual partial backup migrate without dropping their fields', () => {
  assert.deepEqual(parseSavedState(JSON.stringify(v4)), { ...v4, version: DATA_VERSION });
  const result = parseBackup(partial), original = JSON.parse(partial);
  assert.deepEqual(result.state.goals, original.goals);
  assert.deepEqual(result.state.wheel, original.wheel);
  assert.deepEqual(result.state.journal, original.journal);
  assert.equal(result.state.exportedAt, original.exportedAt);
  assert.match(result.warning, /Lessons, drafts, and settings.*cannot be recovered/);
  assert.deepEqual(result.state.lessons, {});
  assert.equal(result.state.demo, false, 'never seeds demo goals during migration');
});

test('additive migration is idempotent, retains unknown fields, and fills only absent defaults', () => {
  const state = complete();
  delete state.goals[0].plus.challenge; delete state.lessons; delete state.focus;
  const migrated = migrateState(state);
  assert.equal(migrated.goals[0].plus.challenge, 5);
  assert.deepEqual(migrateState(migrated), migrated);
  assert.deepEqual(migrated.future, state.future);
  assert.deepEqual(migrated.goals[0].companion, state.goals[0].companion);
  for (const key of ['lessons', 'wheel', 'focus', 'journal']) {
    const bad = complete(); bad[key] = null;
    assert.throws(() => migrateState(bad), /format/);
  }
});

test('malformed JSON, byte limits, deep nesting and unsafe values are rejected', () => {
  for (const raw of ['', '{', 'null', '[]', 'true', '42', '"hello"', '{"goals":[]}']) assert.throws(() => parseBackup(raw));
  assert.throws(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1)), /too large/);
  assert.throws(() => parseBackup('💜'.repeat(MAX_BACKUP_BYTES / 4 + 1)), /too large/);
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const s = JSON.stringify(v4).replace('"version":4', `"version":4,"${key}":{}`);
    assert.throws(() => parseBackup(s), /unsafe/);
  }
  assert.equal({}.polluted, undefined);
  assert.throws(() => parseBackup(JSON.stringify({ ...v4, future: '\u0000' })), /safely/);
  assert.throws(() => parseBackup(JSON.stringify(v4).replace('"momentum":0', '"momentum":1e999')));
  assert.throws(() => migrateState({ ...v4, future: NaN }));
  let deep = {}; for (let i=0; i<35; i++) deep = { deeper: deep };
  assert.throws(() => migrateState({ ...v4, deep }), /complicated/);
  assert.throws(() => migrateState({ ...v4, future: Array(10001).fill(0) }));
});

test('unsupported versions are never guessed or downgraded', () => {
  for (const version of [null, '4', 0, 3, DATA_VERSION + 1, 999]) assert.throws(() => parseBackup(JSON.stringify({ ...v4, version })), /version/);
  const backup = JSON.parse(serializeBackup(v4));
  for (const change of [{ backupVersion: 2 }, { format: 'other-app' }, { state: { ...v4, version: DATA_VERSION + 1 } }]) assert.throws(() => parseBackup(JSON.stringify({ ...backup, ...change })), /version/);
  assert.throws(() => parseBackup(JSON.stringify({ ...backup, exportedAt: 'yesterday' })));
});

test('invalid records, attribute-injection IDs, dates, enums and ratings are rejected', () => {
  const changes = [s => s.goals = {}, s => s.goals[0] = null, s => s.goals[0].tasks = {},
    s => s.goals[0].id = 'x" onclick="alert(1)', s => s.goals[0].category = 'unknown',
    s => s.goals[0].date = '2026-02-30', s => s.goals[0].tasks[0].due = 'javascript:alert(1)',
    s => s.goals[0].tasks[0].doneAt = 'tomorrow', s => s.goals[0].plus.challenge = '5',
    s => s.goals[0].plus.contract = 1, s => s.goals[0].woop.plan = {},
    s => s.goals[0].checkins = [{ date: '2026-10-17', mood: 'fake' }],
    s => s.goals[0].notes = [{ date: 'wrong', text: 'Note' }],
    s => s.wheel = { school: 11 }, s => s.lessons = { smart: 'true' },
    s => s.focus = { minutes: -2 }, s => s.screen = 'invalid', s => s.draft.step = 5,
    s => s.draft.title = null, s => s.draft.schedule['x"'] = '2026-10-17',
    s => s.goals.push(clone(s.goals[0])), s => s.goals[1].tasks[0].id = s.goals[0].tasks[0].id];
  for (const change of changes) { const s = complete(); change(s); assert.throws(() => parseBackup(JSON.stringify(s)), change.toString()); }
});

test('migration preserves the exact V4 disk record before saving V5 on the same key', () => {
  const disk = memory(); const raw = disk.data.get(KEY), store = createStore(disk);
  assert.equal(disk.writes.length, 0);
  assert.equal(store.persist(), true);
  assert.deepEqual(disk.writes, [RECOVERY_KEY, KEY]);
  assert.equal(JSON.parse(disk.data.get(RECOVERY_KEY)).raw, raw);
  assert.deepEqual(JSON.parse(disk.data.get(KEY)), { ...v4, version: DATA_VERSION });
  assert.deepEqual(createStore(disk).state, store.state);
});

test('preview and all cancellation paths perform no writes or state mutations', () => {
  const disk = memory(), store = createStore(disk), before = clone(store.state), raw = disk.data.get(KEY);
  const preview = store.prepareRestore(partial);
  assert.equal(store.restore(preview), false);
  assert.equal(store.restore(preview, false), false);
  assert.equal(store.reset(), false);
  assert.throws(() => store.prepareRestore('{'));
  assert.deepEqual(store.state, before); assert.equal(disk.data.get(KEY), raw);
  assert.deepEqual(disk.writes, []);
});

test('restore commits the full state only after recovery succeeds, including unsaved work', () => {
  const disk = memory(), store = createStore(disk), oldRaw = disk.data.get(KEY);
  store.state.preferences = { unsaved: 'keep this' };
  const before = clone(store.state), prepared = store.prepareRestore(serializeBackup(complete()));
  assert.equal(store.restore(prepared, true), true);
  const recovery = store.recovery();
  assert.deepEqual(disk.writes, [RECOVERY_KEY, KEY]);
  assert.equal(recovery.raw, oldRaw);
  assert.deepEqual(recovery.workingState, before);
  assert.deepEqual(store.state, prepared.state);
  assert.deepEqual(createStore(disk).state, prepared.state);
  assert.deepEqual(parseBackup(store.recoveryRaw()).state, before, 'downloaded recovery data is importable');
  assert.equal(store.restore(store.prepareRestore(JSON.stringify(recovery.workingState)), true), true);
  assert.deepEqual(store.state, before, 'recovery uses the same validated confirmation path');
});

for (const failureKey of [RECOVERY_KEY, KEY]) {
  test(`restore failure writing ${failureKey} leaves primary and working state unchanged`, () => {
    const disk = memory(), store = createStore(disk), before = clone(store.state), raw = disk.data.get(KEY);
    const prepared = store.prepareRestore(serializeBackup(complete()));
    disk.fail = failureKey;
    assert.equal(store.restore(prepared, true), false);
    assert.equal(disk.data.get(KEY), raw); assert.deepEqual(store.state, before);
    assert.match(store.status.message, /Nothing was restored/);
    assert.equal(disk.writes.includes(KEY), false);
    assert.equal(disk.data.get(RECOVERY_KEY), undefined, 'failed replacement must leave no new recovery slot');
  });
}

test('a subsequent failed restore preserves the exact earlier recovery and its undo path', () => {
  const disk = memory(), store = createStore(disk), original = clone(store.state);
  assert.equal(store.restore(store.prepareRestore(serializeBackup(complete())), true), true);
  const primary = disk.data.get(KEY), recovery = disk.data.get(RECOVERY_KEY), working = clone(store.state);
  disk.fail = KEY;
  assert.equal(store.restore(store.prepareRestore(partial), true), false);
  assert.equal(disk.data.get(KEY), primary); assert.deepEqual(store.state, working);
  assert.equal(disk.data.get(RECOVERY_KEY), recovery, 'keep the earlier recovery byte for byte');
  disk.fail = null;
  assert.equal(store.restore(store.prepareRestore(JSON.stringify(store.recovery().workingState)), true), true);
  assert.deepEqual(store.state, original, 'undo of the earlier successful restore still works');
});

test('failure saving the next recovery leaves an existing recovery untouched', () => {
  const disk = memory(), store = createStore(disk);
  assert.equal(store.restore(store.prepareRestore(partial), true), true);
  const primary = disk.data.get(KEY), recovery = disk.data.get(RECOVERY_KEY);
  disk.fail = RECOVERY_KEY;
  assert.equal(store.restore(store.prepareRestore(serializeBackup(complete())), true), false);
  assert.equal(disk.data.get(KEY), primary); assert.equal(disk.data.get(RECOVERY_KEY), recovery);
});

test('failed migration primary write also puts the existing recovery back', () => {
  const disk = memory(), primary = disk.data.get(KEY), recovery = 'an earlier recovery original';
  disk.data.set(RECOVERY_KEY, recovery); disk.fail = KEY;
  const store = createStore(disk);
  assert.equal(store.persist(), false);
  assert.equal(disk.data.get(KEY), primary); assert.equal(disk.data.get(RECOVERY_KEY), recovery);
});

test('blocked rollback warns explicitly while primary and working progress stay unchanged', () => {
  for (const existing of [null, 'earlier recovery']) {
    const disk = memory(); if (existing !== null) disk.data.set(RECOVERY_KEY, existing);
    const store = createStore(disk), primary = disk.data.get(KEY), working = clone(store.state);
    const setItem = disk.setItem.bind(disk); let primaryFailed = false;
    disk.setItem = (key, value) => {
      if (key === KEY) { primaryFailed = true; throw new Error('Primary blocked'); }
      if (primaryFailed) throw new Error('Rollback blocked');
      setItem(key, value);
    };
    disk.removeItem = () => { throw new Error('Rollback removal blocked'); };
    assert.equal(store.restore(store.prepareRestore(partial), true), false);
    assert.equal(disk.data.get(KEY), primary); assert.deepEqual(store.state, working);
    assert.match(store.status.message, /earlier recovery copy could not be put back/);
    assert.deepEqual(store.recovery().workingState, working, 'newly staged recovery still contains current progress');
  }
});

test('rollback never overwrites a recovery changed by another tab', () => {
  const disk = memory(), store = createStore(disk), primary = disk.data.get(KEY);
  const setItem = disk.setItem.bind(disk), other = 'recovery written by another tab';
  disk.setItem = (key, value) => {
    if (key === KEY) { disk.data.set(RECOVERY_KEY, other); throw new Error('Primary blocked'); }
    setItem(key, value);
  };
  assert.equal(store.restore(store.prepareRestore(partial), true), false);
  assert.equal(disk.data.get(KEY), primary); assert.equal(disk.data.get(RECOVERY_KEY), other);
  assert.match(store.status.message, /recovery copy changed in another tab/);
});

test('invalid or tampered previews and progress changed after preview cannot commit', () => {
  const disk = memory(), store = createStore(disk), raw = disk.data.get(KEY);
  let p = store.prepareRestore(partial); p.state.goals[0].tasks = null;
  assert.equal(store.restore(p, true), false);
  p = store.prepareRestore(partial); store.state.future = 'edited';
  assert.equal(store.restore(p, true), false);
  assert.equal(disk.data.get(KEY), raw); assert.deepEqual(disk.writes, []);
});

test('quota or blocked writes leave unsaved work exportable and never claim saved', () => {
  const disk = memory(JSON.stringify(migrateState(v4))), statuses = [], store = createStore(disk, s => statuses.push(s));
  const raw = disk.data.get(KEY); store.state.future = 'unsaved'; disk.fail = '*';
  assert.equal(store.persist(), false); assert.equal(disk.data.get(KEY), raw);
  assert.equal(statuses.at(-1).kind, 'warning');
  assert.equal(parseBackup(store.backup()).state.future, 'unsaved');
  disk.fail = null; assert.equal(store.persist(), true); assert.equal(store.status.kind, 'saved');
});

test('a failed migration recovery write never overwrites the V4 primary', () => {
  const disk = memory(), raw = disk.data.get(KEY); disk.fail = RECOVERY_KEY;
  const store = createStore(disk); assert.equal(store.persist(), false);
  assert.equal(disk.data.get(KEY), raw); assert.deepEqual(disk.writes, []);
});

test('corrupt, incompatible and empty saved values remain untouched through navigation/saves', () => {
  for (const raw of ['{broken', '', 'null', '{}', JSON.stringify({ ...v4, version: DATA_VERSION + 1 }), JSON.stringify({ ...v4, goals: [null] })]) {
    const disk = memory(raw), store = createStore(disk);
    assert.deepEqual(store.state, emptyState()); assert.equal(store.status.kind, 'blocked');
    store.state.screen = 'goals'; assert.equal(store.persist(), false);
    assert.equal(disk.data.get(KEY), raw); assert.deepEqual(disk.writes, []);
    assert.equal(store.originalRaw, raw);
    assert.equal(store.restore(store.prepareRestore(partial), true), true);
    assert.equal(store.recovery().raw, raw, 'explicit restore preserves even unreadable originals');
  }
});

test('unreadable storage never writes or seeds demos; a fresh browser starts empty', () => {
  const disk = memory(); disk.readFail = true;
  const store = createStore(disk);
  assert.deepEqual(store.state, emptyState()); assert.equal(store.persist(), false);
  assert.equal(store.restore(store.prepareRestore(partial), true), false);
  assert.deepEqual(disk.writes, []);
  const fresh = createStore(memory(null)); assert.deepEqual(fresh.state, emptyState());
  assert.equal(fresh.persist(), true);
});

test('other-tab changes cannot be overwritten by autosave or restore', () => {
  for (const action of ['persist', 'restore']) {
    const disk = memory(), store = createStore(disk), prepared = store.prepareRestore(partial);
    const other = JSON.stringify({ ...v4, future: 'other tab work' }); disk.data.set(KEY, other);
    assert.equal(action === 'persist' ? store.persist() : store.restore(prepared, true), false);
    assert.equal(disk.data.get(KEY), other); assert.deepEqual(disk.writes, []);
    assert.match(store.status.message, /another tab/);
  }
});

test('explicit demo reset uses recovery and can be cancelled or fail safely', () => {
  const disk = memory(), store = createStore(disk), raw = disk.data.get(KEY);
  assert.equal(store.reset(false), false); assert.equal(disk.writes.length, 0);
  disk.fail = RECOVERY_KEY; assert.equal(store.reset(true), false); assert.equal(disk.data.get(KEY), raw);
  disk.fail = null; assert.equal(store.reset(true), true);
  assert.equal(store.recovery().raw, raw); assert.equal(store.state.demo, true);
});
