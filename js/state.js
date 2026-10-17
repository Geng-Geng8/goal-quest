import { DATA_VERSION, emptyState, migrateState, parseSavedState, parseBackup, serializeBackup } from './data-safety.js';

// Keep the original V4 key and demo factory. New students start with an empty record.
const KEY = 'h4_goal_quest_v4';
const today = () => localISO(new Date());
function localISO(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
;
function shift(date, n) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return localISO(d);
}
;
const week = () => Array.from({
  length: 7
}, (_, i) => shift(today(), i));
const dayname = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', {
  weekday: 'short'
});
const dated = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', {
  month: 'short',
  day: 'numeric'
});
const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const goal = (category, title, success, nDays, planned, done = 0) => ({
  id: id(),
  category,
  title,
  success,
  why: '',
  date: shift(today(), nDays),
  dateType: 'target',
  createdAt: new Date().toISOString(),
  tasks: planned.map((t, i) => ({
    id: id(),
    title: t,
    due: shift(today(), i % 7),
    doneAt: i < done ? new Date().toISOString() : null,
    createdAt: new Date().toISOString()
  })),
  plus: {
    challenge: 5,
    primer: '',
    partner: '',
    contract: false
  },
  woop: {
    wish: '',
    opportunity: '',
    obstacle: '',
    plan: ''
  },
  notes: [],
  checkins: [],
  milestones: [],
  archived: false
});
function initial() {
  const a = goal('learning', 'Learn a breaking routine', 'Confidently perform a 60-second routine', 35, ['Practise two top-rock steps for 15 minutes', 'Record my first practice video', 'Learn one new move', 'Review the routine with a friend', 'Practise transitions'], 1);
  a.why = 'I want to feel confident performing in front of others.';
  a.plus.primer = 'Put my dance shoes by my bedroom door';
  a.woop = {
    wish: 'Perform a breaking routine',
    opportunity: 'I will feel more confident',
    obstacle: 'I get distracted after school',
    plan: 'If I start scrolling videos, then I will put my phone away and practise one move.'
  };
  let b = goal('school', 'Improve my math grade', 'Score at least 80% on my next test', 28, ['Review algebra notes for 15 minutes', 'Complete 10 practice questions', 'Ask my teacher one question'], 0);
  return {
    goals: [a, b],
    selected: a.id,
    screen: 'home',
    draft: null,
    wheel: {},
    lessons: {},
    journal: [],
    momentum: 0,
    notesViewed: false,
    focus: {
      minutes: 25
    },
    demo: true,
    version: 4
  };
}
// One recovery slot holds the exact previous disk record plus any unsaved work.
// localStorage.setItem is atomic for a single key: write the recovery first and
// the entire primary record last. Never remove the primary key during restore.
export const RECOVERY_KEY = KEY + '_recovery';
export function createStore(storage = {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: key => localStorage.removeItem(key)
}, notify = () => {}) {
  let state = emptyState(), lastRaw = null, locked = false, needsMigrationCopy = false;
  let status = { kind: 'ready', message: '' };
  function report(kind, message) {
    status = { kind, message };
    try { notify(status); } catch { /* Reporting must not turn a committed save into a failure. */ }
  }
  try {
    lastRaw = storage.getItem(KEY);
    if (lastRaw !== null) {
      state = parseSavedState(lastRaw);
      needsMigrationCopy = JSON.parse(lastRaw).version !== DATA_VERSION;
    }
  } catch {
    locked = true;
    report('blocked', lastRaw === null
      ? 'Browser saving is blocked. Changes will be lost when you close this page. Download a backup to keep your work. Allow browser storage, then reload.'
      : 'We could not open your saved progress. The original is untouched. Download the original data below, or import a working backup.');
  }
  function unchanged() {
    if (storage.getItem(KEY) !== lastRaw) {
      locked = true;
      throw new Error('Your saved progress changed in another tab. Download your work, then reload before saving or restoring.');
    }
  }
  function saveWithRecovery(raw) {
    const previous = storage.getItem(RECOVERY_KEY);
    const recovery = JSON.stringify({ format: 'h4-goal-quest-recovery', version: 1, savedAt: new Date().toISOString(), raw: lastRaw, workingState: state });
    storage.setItem(RECOVERY_KEY, recovery);
    try {
      unchanged();
      storage.setItem(KEY, raw);
    } catch (error) {
      let warning = '';
      try {
        // Do not overwrite a recovery copy another tab has since changed.
        if (storage.getItem(RECOVERY_KEY) !== recovery) warning = 'The recovery copy changed in another tab. Download your backups before trying again.';
        else if (previous === null) storage.removeItem(RECOVERY_KEY);
        else storage.setItem(RECOVERY_KEY, previous);
      } catch {
        warning = 'Your earlier recovery copy could not be put back. Keep this page open and download your saved progress and recovery originals before trying again.';
      }
      if (warning) throw Object.assign(new Error(error.message), { recoveryWarning: warning });
      throw error;
    }
  }
  function persist() {
    if (locked) return false;
    try {
      unchanged();
      const raw = JSON.stringify(state);
      // A successful save must have a backup our importer can restore.
      serializeBackup(state);
      if (needsMigrationCopy) saveWithRecovery(raw);
      else storage.setItem(KEY, raw);
      lastRaw = raw;
      needsMigrationCopy = false;
      report('saved', 'Saved on this device');
      return true;
    } catch (error) {
      report('warning', (locked ? error.message : 'Your latest changes could not be saved. Browser storage may be full or blocked. Keep this page open and download a backup.') + (error.recoveryWarning ? ' ' + error.recoveryWarning : ''));
      return false;
    }
  }
  function prepareRestore(raw) {
    return { ...parseBackup(raw), expectedState: JSON.stringify(state), expectedRaw: lastRaw };
  }
  function replace(next, expectedState, expectedRaw) {
    // All potentially failing validation/serialization precedes either write.
    const candidate = migrateState(next);
    const raw = JSON.stringify(candidate);
    serializeBackup(candidate);
    if (expectedState !== JSON.stringify(state) || expectedRaw !== lastRaw) throw new Error('Your progress changed while this preview was open. Choose the file again to review it.');
    unchanged();
    saveWithRecovery(raw); // Primary write is last; on failure, try to restore the old recovery slot.
    state = candidate;
    lastRaw = raw;
    locked = false;
    needsMigrationCopy = false;
    report('saved', 'Saved on this device');
    return true;
  }
  function restore(prepared, confirmed = false) {
    if (!confirmed) return false;
    try {
      return replace(prepared.state, prepared.expectedState, prepared.expectedRaw);
    } catch (error) {
      report('warning', 'Nothing was restored. ' + (/progress changed/.test(error.message) ? error.message : 'We could not safely save both your recovery copy and this backup. Your previous progress is still here. Download a backup and check browser storage.') + (error.recoveryWarning ? ' ' + error.recoveryWarning : ''));
      return false;
    }
  }
  return {
    get state() { return state; },
    get status() { return status; },
    get originalRaw() { return lastRaw; },
    persist,
    current: () => state.goals.find(g => g.id === state.selected) || state.goals[0],
    backup: () => serializeBackup(state),
    prepareRestore,
    restore,
    recovery() {
      const raw = storage.getItem(RECOVERY_KEY);
      if (raw === null) throw new Error('There is no recovery copy on this browser yet. A copy is kept before restoring, migrating, or resetting.');
      const copy = JSON.parse(raw);
      if (copy.format !== 'h4-goal-quest-recovery' || copy.version !== 1 || !Object.hasOwn(copy, 'raw')) throw new Error('The recovery copy could not be opened. Download the recovery data to keep it.');
      return copy;
    },
    recoveryRaw: () => storage.getItem(RECOVERY_KEY),
    reset(confirmed = false) {
      if (!confirmed) return false;
      return restore({ state: { ...initial(), version: DATA_VERSION }, expectedState: JSON.stringify(state), expectedRaw: lastRaw }, true);
    }
  };
}
export { KEY, today, localISO, shift, week, dayname, dated, id, goal, initial };
