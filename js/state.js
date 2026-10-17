import { download, toast } from './ui.js';

// Keep the storage key, V4 defaults, initialization fallbacks and export shape.
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
// Resolve browser storage inside the original try/catch, including when accessing
// localStorage itself is blocked by browser policy.
export function createStore(storage = {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value)
}) {
  let state;
  try {
    state = JSON.parse(storage.getItem(KEY)) || initial();
  } catch {
    state = initial();
  }
  if (!state || !Array.isArray(state.goals)) state = initial();
  state.lessons ||= {};
  state.wheel ||= {};
  state.journal ||= [];
  function persist() {
    try {
      storage.setItem(KEY, JSON.stringify(state));
      document.querySelector('#saved-status').textContent = '● Saved on this device';
    } catch {
      document.querySelector('#saved-status').textContent = '⚠ Local storage unavailable';
    }
  }
  function current() {
    return state.goals.find(g => g.id === state.selected) || state.goals[0];
  }
  function backup() {
    download(JSON.stringify({
      exportedAt: new Date().toISOString(),
      goals: state.goals,
      wheel: state.wheel,
      journal: state.journal
    }, null, 2), 'H4-Goal-Quest-Backup.json', 'application/json');
    toast('Backup saved to your downloads.');
  }
  return {
    get state() {
      return state;
    },
    persist,
    current,
    backup,
    reset() {
      state = initial();
    }
  };
}
export { KEY, today, localISO, shift, week, dayname, dated, id, goal, initial };
