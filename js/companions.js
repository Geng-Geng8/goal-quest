import { esc, clamp } from './ui.js';
import { today, localISO, shift } from './state.js';
import { gxp } from './gameplay.js';
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
  return stage(g) === 4 ? 100 : Math.floor((gxp(g) - (stage(g) - 1) * 145) / 145 * 100);
}
const stageNames = ['New adventurer', 'Growing stronger', 'Explorer', 'Guardian'];
const companionName = g => g.companion?.nickname?.trim() || world(g.category).name;
const nextStageText = g => stage(g) === 4 ? 'Guardian · All four forms unlocked' : `${stage(g) * 145 - gxp(g)} XP to Stage ${stage(g) + 1}`;
function momentum(state, now = today()) {
  const start = shift(now, -6), days = new Set();
  let actions = 0;
  // Preserve recent real steps through parking/achievement; cycling cannot
  // move an old action's first reward date into this week.
  for (const g of state.goals) for (const t of g.tasks) {
    const at = t.rewardedAt || t.doneAt;
    if (!t.doneAt || !at) continue;
    const date = localISO(at);
    if (date >= start && date <= now) { actions++; days.add(date); }
  }
  const checks = new Set(state.journal.filter(c => c.date >= start && c.date <= now).map(c => c.date));
  checks.forEach(d => days.add(d));
  return { days: days.size, actions, checkins: checks.size };
}
function momentumPanel(state) {
  const m = momentum(state);
  return `<section class="card momentum-panel"><div class="eyebrow">PERSONAL MOMENTUM</div><h2 class="h2">${m.days ? `${m.days} ${m.days === 1 ? 'day' : 'days'} with a step forward` : 'Room for a fresh start'}</h2><p class="small muted">In the past 7 days: ${m.actions} ${m.actions === 1 ? 'action' : 'actions'} recorded · ${m.checkins} daily ${m.checkins === 1 ? 'check-in' : 'check-ins'}.</p><div class="momentum-days" aria-label="${m.days} days with an action or check-in in the past 7 days">${Array.from({length:7}, (_, i) => `<span class="${i < m.days ? 'filled' : ''}" aria-hidden="true"></span>`).join('')}</div><p class="small muted">An action or a check-in counts, including choosing rest. These days don't need to be in a row. No points lost for breaks, illness or moving a task.</p><div class="tiny muted">A personal activity summary, not a score of your ability or wellbeing. Your recent steps stay here when a goal is parked or achieved.</div></section>`;
}
function mascot(g, size = 140, previewStage) {
  const w = world(g.category),
    s = previewStage || stage(g),
    a = esc(companionName(g)),
    hex = w.color,
    shade = w.dark,
    ears = s > 1 ? `<path d="M61 84Q32 51 47 29q24-2 43 34M136 65q20-44 45-34 5 34-21 54" fill="${hex}" stroke="${shade}" stroke-width="5" stroke-linejoin="round"/>` : `<path d="M99 55Q82 34 97 24Q111 36 109 58" fill="#8de1a9" stroke="#4d9a75" stroke-width="4"/>`;
  const wings = s > 2 ? `<path d="M65 117Q11 71 23 129q9 37 60 28M155 117q53-46 42 12-8 34-56 28" fill="${s === 4 ? '#f8e3a6' : '#d3c7ff'}" stroke="${shade}" stroke-width="3"/>` : '';
  const crown = s === 4 ? `<path d="M87 50L78 26L103 40L115 17L129 40L152 26L143 51" fill="#ffdf78" stroke="#dbab48" stroke-width="4" stroke-linejoin="round"/>` : '';
  const art = `<svg class="mascot" style="width:${size}px;height:${size}px" viewBox="0 0 230 230" role="img" aria-label="${a} companion evolution stage ${s}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="gr${esc(g.id)}" cx="34%" cy="19%"><stop stop-color="#fff" stop-opacity=".67"/><stop offset=".62" stop-color="${hex}"/><stop offset="1" stop-color="${shade}"/></radialGradient></defs><ellipse cx="115" cy="199" rx="59" ry="12" fill="#141934" opacity=".16"/>${wings}${ears}${crown}<path d="M58 136Q53 79 87 65Q118 45 149 69Q183 94 175 149Q175 195 118 197Q58 198 58 136Z" fill="url(#gr${esc(g.id)})" stroke="${shade}" stroke-width="4"/><ellipse cx="90" cy="127" rx="10" ry="13" fill="#202747"/><ellipse cx="143" cy="127" rx="10" ry="13" fill="#202747"/><circle cx="93" cy="122" r="3.4" fill="white"/><circle cx="146" cy="122" r="3.4" fill="white"/><path d="M107 150Q116 162 126 150" fill="none" stroke="#3b4057" stroke-width="4" stroke-linecap="round"/><ellipse cx="78" cy="145" rx="12" ry="6" fill="#f67e9a" opacity=".6"/><ellipse cx="157" cy="145" rx="12" ry="6" fill="#f67e9a" opacity=".6"/><path d="M78 180q-13 9-2 17M151 180q13 9 2 17" stroke="${shade}" stroke-width="8" stroke-linecap="round"/>${s > 2 ? '<path d="M105 168l12 9 12-9" fill="none" stroke="#fdf3ff" stroke-width="4"/>' : ''}<circle cx="48" cy="95" r="5" fill="#fff2ab" opacity=".8"/><path d="M192 76l4-10 4 10 10 4-10 4-4 10-4-10-10-4z" fill="#fff5ab" opacity="${s > 1 ? 1 : 0}"/></svg>`;
  const accent = { original: w.dark, mint: '#278568', sunset: '#b75270' }[g.companion?.accent || 'original'];
  const accessory = g.companion?.accessory;
  const ring = g.companion?.accent && g.companion.accent !== 'original' ? `<ellipse cx="115" cy="205" rx="70" ry="14" fill="none" stroke="${accent}" stroke-width="4"/>` : '';
  const extra = accessory === 'scarf' ? `<path d="M66 159Q115 182 169 158L166 173Q115 194 69 174Z M147 177l-4 23 16-3-1-23" fill="${accent}" stroke="#fff" stroke-width="2"/>` : accessory === 'star' ? `<path d="m115 170 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill="${accent}" stroke="#fff" stroke-width="2"/>` : '';
  // Preserve the original family bodies, colours, ears, wings and crowns.
  return art.replace('</svg>', `${ring}${extra}</svg>`).replaceAll(`gr${esc(g.id)}`, `gr${esc(g.id)}${previewStage ? `-stage${previewStage}` : ''}`);

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
  return `<div class="companion"><div class="flex between wrap"><span class="micro" style="color:#a9ffee">YOUR GOAL COMPANION</span><span class="pill">Stage ${stage(g)}/4</span></div><div class="companion-art">${mascot(g, 155)}</div><h2 class="companion-name">${esc(companionName(g))}</h2><div class="small companion-family">${esc(world(g.category).name)} · ${stageNames[stage(g)-1]}</div><div class="flex between wrap companion-xp"><b>${gxp(g)} XP</b><span class="small">${nextStageText(g)}</span></div><div class="progress" role="progressbar" aria-label="Progress to next companion stage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${xpToNext(g)}" aria-valuetext="${esc(nextStageText(g))}"><div style="width:${xpToNext(g)}%"></div></div><div class="companion-buttons"><button class="btn light full" data-act="evolution">See my evolution path ✦</button><button class="btn light full" data-act="customize-companion">Name & style (optional)</button></div></div>`;
}
function evolutionHTML(g, unlocked = false) {
  return `<h2 id="companion-heading">${unlocked ? `✦ Stage ${stage(g)} unlocked!` : `Meet ${esc(companionName(g))}`}</h2><p>${unlocked ? `${esc(companionName(g))} is now ${stageNames[stage(g)-1]}. Your real effort helped this companion grow.` : `One companion for ${esc(g.title)}. It grows at your pace.`}</p><div class="evolution-grid">${[1,2,3,4].map(i => `<div class="evolution-step ${i === stage(g) ? 'current' : ''}">${mascot(g, 85, i)}<b>Stage ${i}</b><span class="small">${stageNames[i-1]}</span><span class="tiny">${(i-1)*145} XP · ${i === stage(g) ? 'Current' : i < stage(g) ? 'Unlocked' : 'To discover'}</span></div>`).join('')}</div><p><b>${gxp(g)} XP · ${nextStageText(g)}</b></p><details class="xp-guide" ${unlocked ? '' : 'open'}><summary>How does my companion earn XP?</summary><ul><li>Complete a real action: 35 XP, once per action.</li><li>Daily check-in: 10 XP for that day's companion, including rest. Editing or switching goals adds no extra XP.</li><li>Save all four WOOP answers: 25 XP once.</li><li>Affirm your SMART+ commitment: 20 XP once.</li></ul><p class="small">Undoing an action or editing a plan keeps earned XP. Repeat practice? Plan a separate real action. XP reflects what you report; it is not proof of achievement. Your earlier XP stays safe.</p></details>${unlocked ? '<button class="btn" data-act="celebrate-evolution">✦ Celebrate (optional)</button><p class="hint">A short animation, only if you choose it. Reduced motion is respected.</p>' : ''}`;
}
export { worlds, world, taskCount, gxp, stage, allXP, playerLevel, xpToNext, momentum, momentumPanel, mascot, companionName, nextStageText, tagGoal, progress, quest, evolutionHTML };
