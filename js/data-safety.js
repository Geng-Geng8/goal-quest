// Pure backup parsing and additive migrations. No storage or DOM writes here.
export const DATA_VERSION = 6;
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
const areas = ['school', 'money', 'health', 'learning', 'family', 'community', 'purpose'];
const screens = ['home', 'week', 'goals', 'detail', 'path', 'coach', 'wizard'];
const own = (o, k) => Object.hasOwn(o, k);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function requireValue(ok, message = 'Some information in this file is not in the right format. Choose an H4 Goal Quest backup.') {
  if (!ok) throw new Error(message);
}
const text = v => typeof v === 'string';
const identifier = v => text(v) && /^[a-zA-Z0-9_-]{1,100}$/.test(v) && !['__proto__', 'prototype', 'constructor'].includes(v);
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
function date(v) {
  if (!text(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v.startsWith('0000')) return false;
  const d = new Date(v + 'T12:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
const timestamp = v => text(v) && date(v.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(v) && Number.isFinite(Date.parse(v));
function optional(o, k, check) {
  if (own(o, k)) requireValue(check(o[k]));
}
function strings(o, keys) {
  for (const k of keys) optional(o, k, text);
}
function scan(value, depth = 0, count = { n: 0 }) {
  requireValue(depth <= 32 && ++count.n <= 100000, 'This backup is too complicated to open safely. Choose a smaller backup.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') return requireValue(Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER);
  if (text(value)) return requireValue(value.length <= 200000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), 'This file contains text that cannot be opened safely. Your progress has not changed.');
  requireValue(object(value) || Array.isArray(value));
  if (Array.isArray(value)) requireValue(value.length <= 10000);
  for (const [k, v] of Object.entries(value)) {
    requireValue(!['__proto__', 'prototype', 'constructor'].includes(k) && k.length <= 200 && !/[\u0000-\u001f\u007f]/.test(k), 'This file contains unsafe information. Your progress has not changed.');
    scan(v, depth + 1, count);
  }
}
const defaults = (o, fields) => {
  for (const [k, v] of Object.entries(fields)) if (!own(o, k)) o[k] = v;
};
function records(value, check) {
  requireValue(Array.isArray(value));
  for (const entry of value) { requireValue(object(entry)); check(entry); }
}
function checkin(c, journal = false) {
  requireValue(date(c.date) && ['progress', 'stuck', 'rest'].includes(c.mood));
  if (journal) strings(c, ['note']);
}
function tasks(value, ids, draft = false) {
  records(value, t => {
    requireValue(identifier(t.id) && !ids.has(t.id) && text(t.title));
    ids.add(t.id);
    if (!draft) {
      requireValue(date(t.due));
      optional(t, 'doneAt', v => v === null || timestamp(v));
      optional(t, 'createdAt', timestamp);
      defaults(t, { doneAt: null });
    }
  });
}
export function emptyState() {
  return { goals: [], selected: null, screen: 'home', draft: null, wheel: {}, lessons: {}, journal: [], momentum: 0, notesViewed: false, focus: { minutes: 25 }, demo: false, version: DATA_VERSION };
}

export function migrateState(input, { legacyExport = false } = {}) {
  scan(input);
  requireValue(object(input) && Array.isArray(input.goals));
  requireValue(legacyExport ? !own(input, 'version') : [4, 5, DATA_VERSION].includes(input.version), 'This save uses a version this app cannot open. Keep the file and try the app version it came from.');
  const state = JSON.parse(JSON.stringify(input));
  const goalIds = new Set(), taskIds = new Set();
  requireValue(state.goals.length <= 1000);
  records(state.goals, g => {
    requireValue(identifier(g.id) && !goalIds.has(g.id) && areas.includes(g.category) && text(g.title) && text(g.success) && date(g.date));
    goalIds.add(g.id);
    strings(g, ['why', 'realistic']);
    optional(g, 'agree', v => ['yes', 'group', 'reconsider', ''].includes(v));
    optional(g, 'createdAt', timestamp);
    optional(g, 'dateType', v => ['target', 'review'].includes(v));
    optional(g, 'archived', v => typeof v === 'boolean');
    optional(g, 'goalStatus', v => ['active', 'parked', 'achieved', 'archived'].includes(v));
    if (own(g, 'goalAchievement')) {
      const a = g.goalAchievement;
      requireValue(g.goalStatus === 'achieved' && object(a) && timestamp(a.achievedAt) && date(a.date));
      requireValue(text(a.reflection) && a.reflection.trim().length > 0 && a.reflection.length <= 700);
      requireValue(text(a.howKnow) && a.howKnow.trim().length > 0 && a.howKnow.length <= 700);
      optional(a, 'evidence', v => text(v) && v.length <= 260);
      optional(a, 'milestone', v => text(v) && v.length <= 700);
    }
    requireValue(g.goalStatus !== 'achieved' || own(g, 'goalAchievement'));
    tasks(g.tasks, taskIds);
    defaults(g, { plus: {}, woop: {}, notes: [], checkins: [], milestones: [], archived: false, why: '', dateType: 'target' });
    requireValue(object(g.plus) && object(g.woop));
    optional(g.plus, 'challenge', v => integer(v, 1, 10));
    optional(g.plus, 'contract', v => typeof v === 'boolean');
    strings(g.plus, ['primer', 'partner']);
    strings(g.woop, ['wish', 'opportunity', 'obstacle', 'plan']);
    defaults(g.plus, { challenge: 5, primer: '', partner: '', contract: false });
    defaults(g.woop, { wish: '', opportunity: '', obstacle: '', plan: '' });
    records(g.notes, n => { requireValue(date(n.date) && text(n.text)); strings(n, ['evidence']); });
    records(g.checkins, c => checkin(c));
    requireValue(Array.isArray(g.milestones));
  });
  defaults(state, emptyState());
  optional(state, 'selected', v => v === null || identifier(v));
  requireValue(screens.includes(state.screen) && (state.screen !== 'wizard' || state.draft !== null));
  requireValue(object(state.wheel) && object(state.lessons) && object(state.focus));
  for (const k of areas) optional(state.wheel, k, v => integer(v, 1, 10));
  for (const k of ['wheel', 'smart', 'smartplus', 'woop', 'planner', 'partner']) optional(state.lessons, k, v => typeof v === 'boolean');
  records(state.journal, c => checkin(c, true));
  requireValue(typeof state.demo === 'boolean' && typeof state.notesViewed === 'boolean' && integer(state.momentum, 0, Number.MAX_SAFE_INTEGER));
  optional(state.focus, 'minutes', v => integer(v, 1, 180));
  defaults(state.focus, { minutes: 25 });
  if (state.draft !== null) {
    const d = state.draft;
    requireValue(object(d) && integer(d.step, 0, 4) && areas.includes(d.category));
    for (const k of ['title', 'why', 'success', 'realistic']) requireValue(text(d[k]));
    requireValue(['', 'yes', 'group', 'reconsider'].includes(d.agree) && ['target', 'review'].includes(d.dateType) && (d.date === '' || date(d.date)));
    const ids = new Set();
    tasks(d.tasks, ids, true);
    requireValue(object(d.schedule));
    for (const [k, v] of Object.entries(d.schedule)) requireValue(identifier(k) && (v === '' || date(v)));
  }
  // V4/V5 -> V6 is additive. Absent goalStatus keeps its legacy meaning:
  // archived:true remains a separately labelled legacy archive, never an achievement.
  // No per-goal defaults are added, keeping byte-limit saves exportable too.
  state.version = DATA_VERSION;
  return state;
}

function parseJSON(raw) {
  requireValue(text(raw) && new TextEncoder().encode(raw).length <= MAX_BACKUP_BYTES, 'This file is too large. Choose a backup smaller than 2 MB.');
  try { return JSON.parse(raw); } catch { throw new Error('This file is not readable JSON. Choose an H4 Goal Quest .json backup.'); }
}
export function parseSavedState(raw) {
  return migrateState(parseJSON(raw));
}
export function parseBackup(raw) {
  const value = parseJSON(raw);
  scan(value);
  requireValue(object(value));
  let state, warning = '';
  if (own(value, 'goals') && own(value, 'version')) {
    // Full saved records may themselves contain future fields named format or
    // backupVersion. Their own state version takes priority over envelope names.
    state = migrateState(value);
  } else if (value.format === 'h4-goal-quest-recovery') {
    requireValue(value.version === 1 && timestamp(value.savedAt), 'This recovery file uses a version this app cannot open.');
    state = value.workingState ? migrateState(value.workingState) : parseSavedState(value.raw);
  } else if (own(value, 'format') || own(value, 'backupVersion')) {
    requireValue(value.format === 'h4-goal-quest' && value.backupVersion === BACKUP_VERSION, 'This backup uses a version this app cannot open. Keep the file and try the app version it came from.');
    requireValue(timestamp(value.exportedAt));
    state = migrateState(value.state);
  } else if (!own(value, 'version') && timestamp(value.exportedAt) && own(value, 'wheel') && own(value, 'journal')) {
    state = migrateState(value, { legacyExport: true });
    warning = 'This older V4 backup only includes goals, Wheel ratings, and check-ins. Lessons, drafts, and settings that were not in the file cannot be recovered. Restoring replaces your current progress.';
  } else {
    state = migrateState(value);
  }
  return { state, warning };
}
export function serializeBackup(state) {
  const migrated = migrateState(state);
  const raw = JSON.stringify({ format: 'h4-goal-quest', backupVersion: BACKUP_VERSION, exportedAt: new Date().toISOString(), state: migrated });
  try {
    parseBackup(raw);
    return raw;
  } catch {
    // The envelope adds bytes, a nesting level and several values. At a limit,
    // use the already-supported full versioned state format without truncation.
    const compact = JSON.stringify(migrated);
    parseBackup(compact);
    return compact;
  }
}
