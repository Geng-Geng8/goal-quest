import { today, shift, week, dayname, dated, id, goal } from './state.js';
import { esc, toast, showModal } from './ui.js';
import { worlds, world, taskCount, gxp, stage, mascot, tagGoal, progress, quest } from './companions.js';
export function createCreator({
  store,
  screen,
  navigate,
  taskItem
}) {
  const {
    current
  } = store;
  function goalsView() {
    const active = store.state.goals.filter(g => !g.archived);
    screen(`<div class="flex between wrap" style="margin-bottom:16px"><div><div class="eyebrow">YOUR GROWING TEAM</div><h1 class="h1">Goal collection.</h1><p class="lead" style="margin:0">Every goal grows a different companion. Choose 1–3 priority goals, and let your collection grow over time.</p></div><button class="btn" data-act="new-goal">+ Create a goal</button></div><section class="card"><div class="split-title"><h2 class="h2">Your companions</h2><span class="pill">${active.length} goals</span></div><div class="collection">${active.map(g => `<button class="goalcard" data-goal="${g.id}"><div class="mini">${mascot(g, 95)}<span class="pill">Lv ${stage(g)}</span></div>${tagGoal(g)}<h3>${esc(g.title)}</h3>${progress(g)}<span class="tiny muted">${gxp(g)} XP · ${esc(world(g.category).name)}</span></button>`).join('')}</div><div class="helper" style="margin-top:19px">✦ A companion grows when you make progress on its own goal—not when you tap random buttons.</div></section>`);
  }
  function detail() {
    const g = current();
    if (!g) {
      navigate('goals');
      return;
    }
    const t = taskCount(g),
      w = world(g.category),
      notes = g.notes || [];
    const noteHTML = notes.length ? notes.slice().reverse().map(n => `<div class="preview" style="margin-bottom:9px"><b>${dated(n.date)}</b><p>${esc(n.text)}</p><div class="tiny">${esc(n.evidence || '')}</div></div>`).join('') : '<div class="empty">Save what you tried, learned and did. These notes can support a future Capstone portfolio.</div>';
    const tasksHTML = g.tasks.length ? g.tasks.map(x => taskItem(g, x)).join('') : '<p class="small muted">No actions yet.</p>';
    screen(`<div class="flex between wrap" style="margin-bottom:17px"><button class="btn line sm" data-nav="goals">← My collection</button><span class="pill green">${gxp(g)} companion XP</span></div><div class="cols"><div class="stack"><section class="card"><div class="eyebrow">MY GOAL · ${esc(w.label)}</div><h1 class="h1">${esc(g.title)}</h1><p class="lead">${esc(g.success)}</p>${progress(g)}<div class="flex wrap" style="margin-top:15px"><span class="pill">📅 ${dated(g.date)}</span><span class="pill">${t.n} completed</span><button class="btn line sm" data-act="edit-goal">Edit goal</button></div></section><section class="card"><div class="split-title"><h2 class="h2">Action list</h2><button class="btn sm" data-act="add-task">+ Add action</button></div>${tasksHTML}<button class="btn alt full" style="margin-top:16px" data-nav="week">Open seven-day planner →</button></section><section class="card"><div class="split-title"><h2 class="h2">My progress journal</h2><button class="btn sm line" data-act="evidence">+ Add note / evidence</button></div>${noteHTML}</section></div><div class="stack">${quest(g)}<section class="card"><div class="eyebrow">SMART GOALS+</div><div class="small" style="display:grid;gap:9px"><div>Challenge level: <b>${g.plus.challenge}/10</b></div><div>Physical primer: <b>${esc(g.plus.primer || 'Not chosen')}</b></div><div>Accountability: <b>${esc(g.plus.partner || 'Not chosen')}</b></div><div>Commitment: <b>${g.plus.contract ? 'I am committed' : 'Optional'}</b></div></div><button class="btn line full" style="margin-top:16px" data-lesson="smartplus">Improve my SMART+ plan →</button></section><section class="card"><div class="eyebrow">WOOP PREPARATION</div><div class="small muted">${esc(g.woop.plan || 'Write an if–then plan to prepare for obstacles.')}</div><button class="btn alt full" style="margin-top:13px" data-lesson="woop">Practise WOOP →</button></section><button class="btn line full" data-act="partner">Invite an accountability partner</button></div></div>`);
  }
  function wizardBlank() {
    return {
      step: 0,
      category: 'learning',
      title: '',
      why: '',
      success: '',
      agree: '',
      realistic: '',
      date: shift(today(), 35),
      dateType: 'target',
      tasks: [],
      schedule: {}
    };
  }
  function wizard() {
    const d = store.state.draft || wizardBlank();
    store.state.draft = d;
    const steps = ['Choose your world', 'Make it SMART', 'Choose first moves', 'Plan seven days', 'Begin your adventure'];
    let h = '';
    if (d.step === 0) h = `<h2 class="h2">What part of life would you like to grow?</h2><p class="muted small">Pick an area. You can change this later.</p><div class="choicegrid">${worlds.map(w => `<button class="choice ${d.category === w.id ? 'active' : ''}" data-category="${w.id}"><span>${w.icon}</span>${esc(w.label)}</button>`).join('')}</div><div class="helper"><b>Not sure where to start?</b> Explore your Wheel of Life first. <button class="btn alt sm" data-lesson="wheel">Find a goal idea</button></div><div class="field"><label>What's one thing you'd like to accomplish?</label><input id="w-title" data-draft="title" maxlength="120" placeholder="e.g. Learn a new breaking move" value="${esc(d.title)}"/></div><div class="field"><label>Why does this matter to you? <span class="muted small">Optional</span></label><textarea data-draft="why" placeholder="e.g. I want to feel more confident">${esc(d.why)}</textarea></div><div class="chips">${world(d.category).sample.map(s => `<button class="chip" data-example="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
    if (d.step === 1) h = `<h2 class="h2">Let's make your goal SMART.</h2><p class="muted small">Five short questions. No perfect answers—just a plan that makes sense to you.</p><div class="field"><label>🎯 Specific — what exactly will you accomplish?</label><input data-draft="title" maxlength="120" value="${esc(d.title)}" placeholder="Learn a 60-second dance routine"/><div class="hint">Be clear enough that someone else understands your goal.</div></div><div class="field"><label>📏 Measurable — how will you know you've achieved it?</label><textarea data-draft="success" placeholder="I can perform my routine confidently for 60 seconds">${esc(d.success)}</textarea><div class="hint">Numbers, observable results, or completed milestones all count.</div></div><div class="field"><label>🤝 Agreed Upon — does it align with what you want?</label><select data-draft="agree"><option value="">Choose your answer</option><option ${d.agree === 'yes' ? 'selected' : ''} value="yes">Yes, I chose this for myself</option><option ${d.agree === 'group' ? 'selected' : ''} value="group">This is a group goal we agreed on</option><option ${d.agree === 'reconsider' ? 'selected' : ''} value="reconsider">I want to adjust it first</option></select></div><div class="field"><label>💪 Realistic — why do you think you can work toward it?</label><input data-draft="realistic" value="${esc(d.realistic)}" placeholder="I can practise 15 minutes after school"/><div class="hint">It's okay if it feels challenging. Name a first step you can manage.</div></div><div class="field"><label>🗓️ Timely — choose a goal or progress-review date</label><div class="flex"><select data-draft="dateType" style="max-width:180px"><option value="target" ${d.dateType === 'target' ? 'selected' : ''}>Finish by</option><option value="review" ${d.dateType === 'review' ? 'selected' : ''}>Review on</option></select><input data-draft="date" type="date" min="${today()}" value="${esc(d.date)}"/></div></div>`;
    if (d.step === 2) h = `<h2 class="h2">What are your first moves?</h2><p class="muted small">Choose 1–3 doable actions. Your companion grows when you actually complete them.</p><div class="chips">${world(d.category).task.map(s => `<button class="chip" data-suggest="${esc(s)}">+ ${esc(s)}</button>`).join('')}</div><div class="field"><label>Add your own action</label><div class="flex"><input id="w-action" maxlength="140" placeholder="e.g. Practise 10 minutes"/><button class="btn" data-act="w-add">Add</button></div></div>${d.tasks.length ? d.tasks.map((t, i) => `<div class="task"><span class="pill">${i + 1}</span><b class="grow">${esc(t.title)}</b><button class="iconbtn" data-remove-wtask="${t.id}" aria-label="Remove">✕</button></div>`).join('') : '<div class="empty">Add your first action to move forward.</div>'}<div class="helper">Tip: “Study more” is vague. “Practise 10 questions on Tuesday” is an action you can check off.</div>`;
    if (d.step === 3) h = `<h2 class="h2">When will you take action?</h2><p class="muted small">Schedule your next seven days. Your entire goal does <b>not</b> need to finish this week.</p><div class="daygroups">${d.tasks.map(t => `<div class="flex between wrap" style="padding:11px;border:1px solid #e9eaf3;border-radius:12px"><b class="grow">${esc(t.title)}</b><select data-date-task="${t.id}" style="width:auto;max-width:200px;border-radius:10px;padding:9px;border:1px solid #dce1ef"><option value="">Not this week</option>${week().map(v => `<option value="${v}" ${d.schedule[t.id] === v ? 'selected' : ''}>${dayname(v)} ${dated(v)}</option>`).join('')}</select></div>`).join('')}</div><div class="helper">🌿 Leave free time. If the schedule feels packed, move something to next week. You can use Pomodoro sessions later.</div>`;
    if (d.step === 4) h = `<h2 class="h2">Your adventure is ready.</h2><p class="muted small">Review your plan. You can improve it whenever you learn something new.</p><div class="preview"><div class="eyebrow">YOUR GOAL CARD</div><h2 class="h2">${esc(d.title)}</h2><p><b>Success:</b> ${esc(d.success)}</p><p><b>${d.dateType === 'target' ? 'Target date' : 'Review date'}:</b> ${dated(d.date)}</p><div><b>Your first actions:</b></div>${d.tasks.map(t => `<div style="padding:6px 0">✓ ${esc(t.title)} · ${d.schedule[t.id] ? `${dayname(d.schedule[t.id])} ${dated(d.schedule[t.id])}` : 'Later'}</div>`).join('')}</div><div class="helper">✨ Once you create your goal, you'll unlock your own creature. You can choose SMART+ power-ups and complete a WOOP challenge any time.</div>`;
    screen(`<div class="wizard"><div class="flex between" style="margin-bottom:13px"><div class="eyebrow">THE H4 GOAL MEETING METHOD</div><button class="btn line sm" data-act="wizard-exit">Save & exit</button></div><h1 class="h1" style="margin-bottom:17px">${steps[d.step]}</h1><div class="flex between small muted" style="margin-bottom:8px"><b>Step ${d.step + 1} of 5</b><span>${steps[d.step]}</span></div><div class="steptrack">${steps.map((_, i) => `<div class="${i === d.step ? 'current' : i < d.step ? 'passed' : ''}"></div>`).join('')}</div><section class="card cardglow">${h}<hr class="mutedline"/><div class="flex between"><button class="btn line" data-act="wizard-prev">← Back</button><button class="btn" data-act="wizard-next">${d.step === 4 ? 'Create goal & meet my companion ✦' : 'Continue →'}</button></div></section></div>`);
  }
  function startWizard() {
    store.state.draft = wizardBlank();
    navigate('wizard');
  }
  ;
  function finishWizard() {
    const d = store.state.draft;
    const g = goal(d.category, d.title.trim(), d.success.trim(), 35, []);
    g.date = d.date;
    g.dateType = d.dateType;
    g.why = d.why;
    g.agree = d.agree;
    g.realistic = d.realistic;
    g.tasks = d.tasks.map(t => ({
      id: id(),
      title: t.title,
      due: d.schedule[t.id] || shift(today(), 7),
      doneAt: null,
      createdAt: new Date().toISOString()
    }));
    store.state.goals.push(g);
    store.state.selected = g.id;
    store.state.demo = false;
    store.state.draft = null;
    store.state.lessons.smart = true;
    navigate('detail');
    toast(`${world(g.category).name} joined your adventure! Complete actions to help it evolve.`);
  }
  function goalEdit() {
    const g = current();
    showModal(`<h2>✎ Edit your goal</h2><form id="edit-form"><div class="field"><label>My goal</label><input name="title" required maxlength="120" value="${esc(g.title)}"/></div><div class="field"><label>Success looks like</label><textarea name="success" required>${esc(g.success)}</textarea></div><div class="field"><label>Target/review date</label><input name="date" type="date" value="${g.date}" required/></div><button class="btn full">Save changes</button></form>`);
  }
  function evidence() {
    showModal(`<h2>📓 Capture real progress</h2><p>Record what you actually tried, what happened, or what you learned. This journal can support a future Capstone portfolio.</p><form id="evidence-form"><div class="field"><label>What did you do or learn?</label><textarea name="text" placeholder="I asked my teacher for feedback and adjusted my plan..." required maxlength="700"></textarea></div><div class="field"><label>Evidence or artifact reference <span class="muted">(optional)</span></label><input name="evidence" maxlength="260" placeholder="e.g. photo of my practice / name of a document"/></div><button class="btn full">Save journal entry</button></form>`);
  }

  // Preserve the existing local-demo export/reset footer.
  const originalGoals = goalsView;
  goalsView = function () {
    originalGoals();
    const e = document.querySelector('#main > .card');
    if (e) {
      e.insertAdjacentHTML('beforeend', `<div style="border-top:1px solid #eceef5;padding-top:16px;margin-top:25px"><div class="flex between wrap"><span class="small muted">This is a local demo. Nothing is shared or uploaded.</span><div class="flex wrap"><button class="btn line sm" data-act="backup">Export goal backup</button><button class="btn line sm" data-act="reset-demo">Reset demo</button></div></div></div>`);
    }
  };
  return {
    goalsView,
    detail,
    wizardBlank,
    wizard,
    startWizard,
    finishWizard,
    goalEdit,
    evidence
  };
}
