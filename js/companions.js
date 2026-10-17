import { esc, clamp, showModal } from './ui.js';
import { today, localISO, shift } from './state.js';
const worlds = [{
  id: 'school',
  label: 'School & Future',
  icon: '🎓',
  name: 'Astri',
  color: '#aea2ff',
  dark: '#6965b7',
  task: ['Review notes for 15 minutes', 'Ask a teacher for feedback', 'Complete one practice activity'],
  sample: ['Improve my math grade', 'Finish my science project', 'Prepare for a career']
}, {
  id: 'money',
  label: 'Money & Independence',
  icon: '💰',
  name: 'Coino',
  color: '#ffe097',
  dark: '#b98630',
  task: ['Write down what I spent today', 'Put aside a small amount', 'Compare two prices'],
  sample: ['Save $200', 'Build a weekly budget', 'Learn how interest works']
}, {
  id: 'health',
  label: 'Health & Fitness',
  icon: '💪',
  name: 'Embi',
  color: '#ffb8a6',
  dark: '#d36e5e',
  task: ['Move for 20 minutes', 'Prepare a healthy snack', 'Plan a bedtime routine'],
  sample: ['Exercise three times a week', 'Improve my running endurance', 'Get more consistent sleep']
}, {
  id: 'learning',
  label: 'Learning & Growth',
  icon: '📚',
  name: 'Glimo',
  color: '#a5dafb',
  dark: '#6293c6',
  task: ['Practise my skill for 15 minutes', 'Learn one new technique', 'Show someone what I learned'],
  sample: ['Learn a breaking routine', 'Read five books', 'Learn basic coding']
}, {
  id: 'family',
  label: 'Family & Relationships',
  icon: '🏡',
  name: 'Hugo',
  color: '#ffc2d8',
  dark: '#d47b9d',
  task: ['Plan a shared activity', 'Ask how someone is doing', 'Have a screen-free conversation'],
  sample: ['Spend more time with family', 'Improve how I listen', 'Be more helpful at home']
}, {
  id: 'community',
  label: 'Friends & Community',
  icon: '🤝',
  name: 'Sprig',
  color: '#a2edb2',
  dark: '#47a97a',
  task: ['Contact one person', 'Research a club or volunteer opportunity', 'Plan a small group activity'],
  sample: ['Join a new school club', 'Volunteer in my community', 'Organize a school event']
}, {
  id: 'purpose',
  label: 'Purpose & Values',
  icon: '🧭',
  name: 'Luma',
  color: '#e8c0ff',
  dark: '#a47bce',
  task: ['Write one meaningful reflection', 'Choose one helpful action', 'Spend 10 quiet minutes reflecting'],
  sample: ['Build a gratitude habit', 'Explore what matters to me', 'Make time for an important value']
}];
const world = k => worlds.find(w => w.id === k) || worlds[0];
function taskCount(g) {
  const n = g.tasks.filter(t => t.doneAt).length;
  return {
    n,
    total: g.tasks.length,
    pct: g.tasks.length ? Math.round(100 * n / g.tasks.length) : 0
  };
}
function gxp(g) {
  const task = Math.min(g.tasks.filter(t => t.doneAt).length, 300) * 35;
  const acts = Math.min(g.checkins.length, 100) * 10;
  const woop = g.woop?.plan ? 25 : 0;
  const smart = g.plus?.contract ? 20 : 0;
  return task + acts + woop + smart;
}
function stage(g) {
  return clamp(1 + Math.floor(gxp(g) / 145), 1, 4);
}
function allXP(state) {
  return state.goals.reduce((n, g) => n + gxp(g), 0);
}
function playerLevel(state) {
  return 1 + Math.floor(allXP(state) / 170);
}
function xpToNext(g) {
  let x = gxp(g);
  let next = stage(g) * 145;
  return stage(g) === 4 ? 100 : Math.min(100, Math.floor(x / next * 100));
}
function momentumPanel(state) {
  const start = shift(today(), -6),
    now = today();
  let done = 0,
    overdue = 0;
  for (const g of state.goals) for (const t of g.tasks) {
    if (t.doneAt && localISO(t.doneAt) >= start && localISO(t.doneAt) <= now) done++;else if (!t.doneAt && t.due < now) overdue++;
  }
  const checks = state.journal.filter(x => x.date >= start && x.date <= now).length;
  const rating = clamp(700 + 22 * done + 10 * checks - 9 * overdue, 600, 1100);
  return `<section class="card"><div class="flex between"><div><div class="eyebrow">PERSONAL MOMENTUM</div><h2 style="font-size:29px;margin:0;letter-spacing:-1.2px">${rating} <span class="small muted" style="font-weight:600">/ 1100</span></h2></div><span style="font-size:34px">📈</span></div><div class="progress" style="margin:11px 0"><div style="width:${(rating - 600) / 5}%"></div></div><div class="small muted">Your own recent follow-through, not a public leaderboard. Real progress moves your rating; you can always recover after a hard week.</div></section>`;
}
function mascot(g, size = 140) {
  const w = world(g.category),
    s = stage(g),
    a = esc(w.name),
    hex = w.color,
    shade = w.dark,
    ears = s > 1 ? `<path d="M61 84Q32 51 47 29q24-2 43 34M136 65q20-44 45-34 5 34-21 54" fill="${hex}" stroke="${shade}" stroke-width="5" stroke-linejoin="round"/>` : `<path d="M99 55Q82 34 97 24Q111 36 109 58" fill="#8de1a9" stroke="#4d9a75" stroke-width="4"/>`;
  const wings = s > 2 ? `<path d="M65 117Q11 71 23 129q9 37 60 28M155 117q53-46 42 12-8 34-56 28" fill="${s === 4 ? '#f8e3a6' : '#d3c7ff'}" stroke="${shade}" stroke-width="3"/>` : '';
  const crown = s === 4 ? `<path d="M87 50L78 26L103 40L115 17L129 40L152 26L143 51" fill="#ffdf78" stroke="#dbab48" stroke-width="4" stroke-linejoin="round"/>` : '';
  return `<svg class="mascot" style="width:${size}px;height:${size}px" viewBox="0 0 230 230" role="img" aria-label="${a} companion evolution stage ${s}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="gr${esc(g.id)}" cx="34%" cy="19%"><stop stop-color="#fff" stop-opacity=".67"/><stop offset=".62" stop-color="${hex}"/><stop offset="1" stop-color="${shade}"/></radialGradient></defs><ellipse cx="115" cy="199" rx="59" ry="12" fill="#141934" opacity=".16"/>${wings}${ears}${crown}<path d="M58 136Q53 79 87 65Q118 45 149 69Q183 94 175 149Q175 195 118 197Q58 198 58 136Z" fill="url(#gr${esc(g.id)})" stroke="${shade}" stroke-width="4"/><ellipse cx="90" cy="127" rx="10" ry="13" fill="#202747"/><ellipse cx="143" cy="127" rx="10" ry="13" fill="#202747"/><circle cx="93" cy="122" r="3.4" fill="white"/><circle cx="146" cy="122" r="3.4" fill="white"/><path d="M107 150Q116 162 126 150" fill="none" stroke="#3b4057" stroke-width="4" stroke-linecap="round"/><ellipse cx="78" cy="145" rx="12" ry="6" fill="#f67e9a" opacity=".6"/><ellipse cx="157" cy="145" rx="12" ry="6" fill="#f67e9a" opacity=".6"/><path d="M78 180q-13 9-2 17M151 180q13 9 2 17" stroke="${shade}" stroke-width="8" stroke-linecap="round"/>${s > 2 ? '<path d="M105 168l12 9 12-9" fill="none" stroke="#fdf3ff" stroke-width="4"/>' : ''}<circle cx="48" cy="95" r="5" fill="#fff2ab" opacity=".8"/><path d="M192 76l4-10 4 10 10 4-10 4-4 10-4-10-10-4z" fill="#fff5ab" opacity="${s > 1 ? 1 : 0}"/></svg>`;
}
function tagGoal(g) {
  return `<span class="pill">${world(g.category).icon} ${esc(world(g.category).label)}</span>`;
}
;
function progress(g) {
  let t = taskCount(g);
  return `<div class="flex between small muted"><span>Action progress</span><b>${t.n}/${t.total} done</b></div><div class="progress"><div style="width:${t.pct}%"></div></div>`;
}
function quest(g) {
  if (!g) return '';
  return `<div class="companion"><div class="flex between"><span class="micro" style="color:#a9ffee">YOUR GOAL COMPANION</span><span class="pill">Stage ${stage(g)}/4</span></div>${mascot(g, 140)}<div class="flex between"><div><b style="font-size:18px">${esc(world(g.category).name)}</b><div class="small muted">${['', 'New adventurer', 'Growing stronger', 'Explorer', 'Guardian'][stage(g)]}</div></div><span class="pill green">${gxp(g)} XP</span></div><div style="height:9px"></div><div class="progress"><div style="width:${xpToNext(g)}%"></div></div><div class="tiny muted" style="margin-top:8px">${stage(g) === 4 ? 'Final form unlocked!' : 'Complete meaningful actions to unlock the next form.'}</div></div>`;
}
function evolve(g) {
  const s = stage(g);
  showModal(`<h2>✦ Meet ${esc(world(g.category).name)}</h2><p>Each goal grows one companion. Every real action helps its own character evolve.</p><div class="flex wrap" style="justify-content:center">${[1, 2, 3, 4].map(i => {
    let mock = {
      ...g,
      tasks: Array.from({
        length: Math.ceil((i - 1) * 145 / 35)
      }, (_, j) => ({
        doneAt: new Date().toISOString()
      }))
    };
    mock.plus = {};
    mock.woop = {};
    mock.checkins = [];
    return `<div style="text-align:center;padding:5px;border:${i === s ? '2px solid #7464e4' : '1px solid #e8ebf3'};border-radius:12px;min-width:90px">${mascot(mock, 85)}<div class="small"><b>Stage ${i}</b></div><div class="tiny muted">${i === s ? 'Current' : i < s ? 'Unlocked' : 'To discover'}</div></div>`;
  }).join('')}</div><div class="helper">Your companion's progress comes from its goal's completed actions and reflections, not idle app time.</div>`);
}

// Retain V4's evolution-path button in the companion card.
const oldQuest = quest;
quest = function (g) {
  return oldQuest(g).replace('</div></div></div>', '</div></div></div>').replace('<div class="tiny muted" style="margin-top:8px">', '<button class="btn sm light" style="margin-top:13px;width:100%" data-act="evolution">See my evolution path ✦</button><div class="tiny muted" style="margin-top:8px">');
};
export { worlds, world, taskCount, gxp, stage, allXP, playerLevel, xpToNext, momentumPanel, mascot, tagGoal, progress, quest, evolve };
