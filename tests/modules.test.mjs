import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import * as companions from '../js/companions.js';
import { KEY, createStore, initial, localISO, shift, week } from '../js/state.js';
import { esc } from '../js/ui.js';
import { DATA_VERSION } from '../js/data-safety.js';

const reference = readFileSync(new URL('../reference/capstone_quest_v4.html', import.meta.url), 'utf8');
const script = reference.match(/<script>([\s\S]*?)<\/script>/)[1];
const baseline = createContext({
  document: { addEventListener() {} }, localStorage: { getItem() { return null; } },
});
new Script(script.replace(/screenRoute\(\);\s*\}\)\(\);\s*$/, `globalThis.oracle = {
  initial, localISO, shift, week, esc, worlds, world, taskCount, gxp, stage,
  xpToNext, mascot, quest, progress, tagGoal,
  allXP: value => { state=value; return allXP(); },
  playerLevel: value => { state=value; return playerLevel(); },
  momentumPanel: value => { state=value; return momentumPanel(); }
};})();`)).runInContext(baseline);
const oracle = baseline.oracle;
const plain = value => JSON.parse(JSON.stringify(value));

test('V4 shell and CSS remain intact around the explicit data-safety additions', () => {
  const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(source, /id="storage-warning"[^>]*role="alert" hidden/);
  assert.match(source, /data-act="data-menu"/);
  const html = source.replace(/<div class="data-toolbar">[\s\S]*?<\/div><div id="storage-warning"[\s\S]*?<\/div>/, '')
    .replace('class="savepill" role="status">Loading saved progress…', 'class="savepill">● Saved on this device');
  const original = reference.replace(/\r\n/g, '\n');
  assert.equal(html.trimEnd(), original.replace(/<style>[\s\S]*?<\/style>/,
    '<link rel="stylesheet" href="./styles.css">').replace(/<script>[\s\S]*?<\/script>/,
    '<script type="module" src="./js/app.js"></script>').trimEnd());
  assert.equal(readFileSync(new URL('../styles.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n').split('\n/* Data safety controls')[0],
    original.match(/<style>([\s\S]*?)<\/style>/)[1]);
});

test('module imports stay relative, acyclic, and rooted only at app.js', () => {
  const files = ['app', 'state', 'companions', 'creator-smart', 'planner', 'academy-coach', 'ui', 'data-safety', 'data-controls', 'goal-status', 'goal-collection', 'gameplay', 'companion-controls'];
  const graph = new Map(files.map(name => {
    const text = readFileSync(new URL(`../js/${name}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /\bon(?:click|input|change)=/);
    const imports = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
    for (const path of imports) assert.match(path, /^\.\/[^/]+\.js$/);
    if (name !== 'app') assert.doesNotMatch(text, /document\.addEventListener|createStore\(\)/);
    return [name, imports.map(path => path.slice(2, -3))];
  }));
  function visit(name, stack = []) {
    assert.ok(!stack.includes(name), `circular import: ${[...stack, name].join(' -> ')}`);
    for (const dep of graph.get(name)) visit(dep, [...stack, name]);
  }
  visit('app');
});

test('legacy XP, stage boundaries and all 28 default SVGs retain V4 parity', () => {
  for (const category of companions.worlds.map(w => w.id)) {
    for (const done of [0, 1, 4, 5, 8, 9, 12, 13, 299, 300, 301]) {
      for (const boosts of [false, true]) {
        const g = { id:'fixture', category, tasks:Array.from({length:done}, () => ({doneAt:'2026-10-17T12:00:00Z'})),
          checkins:Array.from({length:boosts ? 101 : 0}, () => ({})), plus:{contract:boosts}, woop:{plan:boosts ? 'If distracted, then practise.' : ''} };
        for (const name of ['gxp', 'stage', 'mascot', 'progress', 'tagGoal']) {
          assert.equal(companions[name](g), oracle[name](g), `${name}/${category}/${done}/${boosts}`);
        }
        assert.deepEqual(companions.taskCount(g), plain(oracle.taskCount(g)));
        if (g.tasks.length) {
          const xp = companions.gxp(g);
          g.tasks[0].doneAt = null;
          assert.equal(companions.gxp(g), oracle.gxp(g));
          g.tasks[0].doneAt = '2026-10-17T12:00:00Z';
          assert.equal(companions.gxp(g), xp);
        }
      }
    }
  }
});

test('legacy overall level, local dates and escaping match V4', () => {
  const state = initial();
  assert.deepEqual(plain(companions.worlds), plain(oracle.worlds));
  assert.equal(companions.world('unknown').id, oracle.world('unknown').id);
  for (const name of ['allXP', 'playerLevel']) assert.equal(companions[name](state), oracle[name](state));
  for (const date of ['2024-02-28', '2024-12-31', '2026-03-08', '2026-11-01']) {
    for (const days of [-30,-1,0,1,7,35]) assert.equal(shift(date, days), oracle.shift(date, days));
    assert.equal(localISO(date+'T12:00:00'), oracle.localISO(date+'T12:00:00'));
  }
  assert.deepEqual(week(), plain(oracle.week()));
  for (const value of [null, undefined, '<img src=x onerror="alert(1)">', "&'", 42]) assert.equal(esc(value), oracle.esc(value));
});

test('existing state, unknown fields and non-demo empty goals survive load/save', () => {
  const record = { ...initial(), demo:false, unknown:{ keep:['private',42] } };
  record.goals[0].futureField = { preserved:true };
  let saved = JSON.stringify(record);
  const storage = { getItem(key) { return key === KEY ? saved : null; }, setItem(key, value) { if (key === KEY) saved=value; } };
  const status = {};
  globalThis.document = { querySelector() { return status; } };
  try {
    const store = createStore(storage, value => { status.textContent = value.message; });
    const migrated = { ...record, version: DATA_VERSION };
    assert.deepEqual(store.state, migrated);
    store.persist();
    assert.deepEqual(JSON.parse(saved), migrated);
    assert.equal(store.current().id, record.selected);
    assert.equal(status.textContent, 'Saved on this device');
    saved=JSON.stringify({...record,goals:[],selected:null});
    const empty=createStore(storage);
    assert.equal(empty.state.goals.length,0);
    empty.persist();
    assert.deepEqual(JSON.parse(saved).unknown, record.unknown);
    // Reload after the test's external disk change before an explicit reset.
    const resetStore = createStore(storage);
    resetStore.reset(true);
    assert.equal(resetStore.state.goals.length,2);
    assert.equal(resetStore.state.demo,true);
  } finally { delete globalThis.document; }
});

test('initial persisted structures retain all V4 fields', () => {
  const schema = value => Array.isArray(value) ? value.map(schema) : value && typeof value==='object'
    ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,schema(v)])) : typeof value;
  assert.deepEqual(schema(initial()), schema(plain(oracle.initial())));
});

test('blocked access to localStorage warns and never seeds demo content', () => {
  const status = {};
  globalThis.document = { querySelector() { return status; } };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable:true, get() { throw new Error('Browser storage is blocked'); },
  });
  try {
    const store=createStore();
    assert.equal(store.state.goals.length,0);
    assert.equal(store.state.demo,false);
    assert.doesNotThrow(()=>store.persist());
    assert.equal(store.status.kind,'blocked');
    assert.match(store.status.message,/Browser saving is blocked/);
  } finally { delete globalThis.localStorage; delete globalThis.document; }
});
