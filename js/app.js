import { createStore, today, id } from './state.js';
import { toast, closeModal, showModal, copy } from './ui.js';
import { world, playerLevel, quest, momentumPanel, evolve as showEvolution } from './companions.js';
import { createPlanner } from './planner.js';
import { createCreator } from './creator-smart.js';
import { createAcademy } from './academy-coach.js';
import { createDataControls, updateSaveStatus } from './data-controls.js';
import { createGoalCollection } from './goal-collection.js';
import { isActive, isAchieved, dailyGoal } from './goal-status.js';

// The only composition root. Feature modules receive state and callbacks here.
const store = createStore(undefined, updateSaveStatus);
const {
  persist,
  current
} = store;
const planner = createPlanner({
  store,
  screen,
  quest,
  momentumPanel: () => momentumPanel(store.state)
});
const {
  home,
  weekView,
  newTaskModal,
  taskById,
  moveTask,
  checkin,
  reminder,
  calendarDownload,
  timerToggle,
  timerReset
} = planner;
const creator = createCreator({
  store,
  screen,
  navigate,
  taskItem: planner.taskItem,
  requestActive: (g, commit) => collection.requestActive(g, commit)
});
const {
  goalsView,
  detail,
  wizard,
  startWizard,
  finishWizard,
  goalEdit,
  evidence
} = creator;
const {
  learning,
  coach,
  lesson,
  partner,
  coachingPrompt
} = createAcademy({
  store,
  screen
});
const evolve = () => showEvolution(store.state.screen === 'home' ? dailyGoal(store.state) : current());
const dataControls = createDataControls({ store, render: screenRoute, resetTimer: timerReset });
const collection = createGoalCollection({ store, render: screenRoute, navigate });
function savedToast(message) {
  toast(store.status.kind === 'saved' ? message : 'Your changes are on this page but could not be saved. Download a backup before closing it.');
}
function navigation() {
  const items = [['home', '⌂', 'Today'], ['week', '▦', 'My Week'], ['goals', '◉', 'My Goals'], ['path', '✧', 'Learn'], ['coach', '✦', 'Coach']];
  document.querySelector('#sidebar-nav').innerHTML = items.map(([x, i, l]) => `<button class="nav ${store.state.screen === x ? 'active' : ''}" data-nav="${x}"><span class="navico" aria-hidden="true">${i}</span>${l}</button>`).join('');
  document.querySelector('#bottom-nav').innerHTML = items.map(([x, i, l]) => `<button class="${store.state.screen === x ? 'active' : ''}" data-nav="${x}"><span class="navico" aria-hidden="true">${i}</span>${l}</button>`).join('');
  document.querySelector('#player-level').textContent = '✦ Lv ' + playerLevel(store.state);
}
function screen(html) {
  document.querySelector('#main').innerHTML = html;
  navigation();
  persist();
}
function navigate(s) {
  store.state.screen = s;
  screenRoute();
  window.scrollTo({
    top: 0,
    behavior: 'instant'
  });
}
function screenRoute() {
  if (store.state.screen === 'home') home();else if (store.state.screen === 'week') weekView();else if (store.state.screen === 'goals') goalsView();else if (store.state.screen === 'detail') detail();else if (store.state.screen === 'path') learning();else if (store.state.screen === 'coach') coach();else if (store.state.screen === 'wizard') wizard();else home();
}
document.addEventListener('click', e => {
  let b = e.target.closest('button');
  if (!b) return;
  let k = b.dataset;
  if (k.nav) {
    closeModal(); collection.cancel(); dataControls.cancel();
    navigate(k.nav);
    return;
  }
  if (k.goal) {
    store.state.selected = k.goal;
    navigate('detail');
    return;
  }
  if (k.lesson) {
    lesson(k.lesson);
    return;
  }
  if (k.prompt) {
    coachingPrompt(k.prompt);
    return;
  }
  if (k.promptView) {
    coachingPrompt(k.promptView, true);
    return;
  }
  if (k.category) {
    store.state.draft.category = k.category;
    wizard();
    return;
  }
  if (k.example) {
    store.state.draft.title = k.example;
    wizard();
    return;
  }
  if (k.suggest) {
    if (!store.state.draft.tasks.some(x => x.title === k.suggest)) store.state.draft.tasks.push({
      id: id(),
      title: k.suggest
    });
    wizard();
    return;
  }
  if (k.removeWtask) {
    store.state.draft.tasks = store.state.draft.tasks.filter(x => x.id !== k.removeWtask);
    wizard();
    return;
  }
  if (k.done) {
    const f = taskById(k.done);
    if (!f || !isActive(f.g)) return;
    f.t.doneAt = f.t.doneAt ? null : new Date().toISOString();
    let xp = f.t.doneAt ? '+35 XP toward ' + world(f.g.category).name : 'Action reopened';
    persist();
    screenRoute();
    toast(xp);
    return;
  }
  if (k.move) {
    moveTask(k.move);
    return;
  }
  if (k.addDate) {
    newTaskModal(k.addDate);
    return;
  }
  if (k.minutes) {
    planner.setMinutes(b);
    return;
  }
  let a = k.act;
  if (!a) return;
  if (dataControls.act(a)) return;
  if (collection.act(a)) return;
  if (a === 'new-goal') {
    if (store.state.draft) {
      showModal(`<h2>Continue your goal?</h2><p>You have an unfinished goal idea saved.</p><div class="flex wrap"><button class="btn" data-act="resume-wizard">Continue my draft</button><button class="btn line" data-act="restart-wizard">Start fresh</button></div>`);
    } else startWizard();
  } else if (a === 'resume-wizard') {
    closeModal();
    navigate('wizard');
  } else if (a === 'restart-wizard') {
    closeModal();
    startWizard();
  } else if (a === 'wizard-next') {
    const d = store.state.draft;
    if (!d) return;
    if (d.step === 0 && !d.title.trim()) return toast('Start with one goal idea.');
    if (d.step === 1) {
      if (!d.title.trim() || !d.success.trim() || !d.date || !d.agree || !d.realistic.trim()) return toast('Answer each SMART question so your goal is ready.');
      if (d.agree === 'reconsider') return toast('Adjust the goal until it feels right to you.');
    }
    if (d.step === 2 && !d.tasks.length) return toast('Choose at least one real action.');
    if (d.step === 3 && !d.tasks.some(t => d.schedule[t.id])) return toast('Choose at least one action to schedule this week.');
    if (d.step < 4) {
      d.step++;
      wizard();
    } else finishWizard();
  } else if (a === 'wizard-prev') {
    if (store.state.draft.step > 0) {
      store.state.draft.step--;
      wizard();
    } else navigate('goals');
  } else if (a === 'wizard-exit') {
    navigate('goals');
    savedToast('Your draft is saved on this device.');
  } else if (a === 'w-add') {
    const i = document.querySelector('#w-action');
    if (!i?.value.trim()) return toast('Write an action first.');
    store.state.draft.tasks.push({
      id: id(),
      title: i.value.trim().slice(0, 140)
    });
    wizard();
  } else if (a === 'add-task') newTaskModal();else if (a === 'checkin') checkin();else if (a === 'evidence') evidence();else if (a === 'edit-goal') goalEdit();else if (a === 'close') { closeModal(); dataControls.cancel(); collection.cancel(); } else if (a === 'wheel-finish') {
    store.state.lessons.wheel = true;
    persist();
    closeModal();
    toast('Direction explored! Choose any area you care about.');
  } else if (a === 'learn-done') {
    store.state.lessons[k.key] = true;
    persist();
    closeModal();
    if (k.next === 'week') navigate('week');else if (k.next === 'partner') partner();else {
      screenRoute();
      toast('Lesson explored! Try it with your goal.');
    }
  } else if (a === 'partner') partner();else if (a === 'copy-share') {
    copy(document.querySelector('#share-text').value, 'Your check-in is copied. You choose who to send it to.');
    closeModal();
  } else if (a === 'select-copy') {
    const input = document.querySelector('#manual-copy');
    input?.focus();
    input?.select();
  } else if (a === 'timer-toggle') timerToggle();else if (a === 'timer-reset') timerReset();else if (a === 'reminder') reminder();else if (a === 'evolution') evolve();else if (a === 'reset-demo') {
    if (confirm('Replace your progress with sample goals? Download a backup first. We will also keep a recovery copy on this browser.')) {
      if (!store.reset(true)) return;
      timerReset();
      closeModal();
      navigate('home');
      savedToast('Demo reset.');
    }
  }
});
document.addEventListener('input', e => {
  const o = e.target;
  if (o.hasAttribute('data-challenge')) document.getElementById('challenge-value').textContent = o.value + '/10';
  if (o.dataset.draft && store.state.draft) {
    store.state.draft[o.dataset.draft] = o.value;
    persist();
  }
  if (o.dataset.wheel) {
    store.state.wheel[o.dataset.wheel] = Number(o.value);
    const v = document.querySelector('#wheelval-' + o.dataset.wheel);
    if (v) v.textContent = o.value + '/10';
    persist();
  }
});
document.addEventListener('change', e => {
  let o = e.target;
  if (o.id === 'backup-file') { dataControls.fileChanged(o); return; }
  if (o.dataset.dateTask && store.state.draft) {
    store.state.draft.schedule[o.dataset.dateTask] = o.value;
    persist();
  }
});
document.addEventListener('keydown', e => {
  dataControls.keydown(e);
  collection.keydown(e);
  if (e.key === 'Enter' && e.target.id === 'w-action') {
    e.preventDefault();
    document.querySelector('[data-act="w-add"]')?.click();
  }
  if (e.key === 'Escape') { closeModal(); dataControls.cancel(); collection.cancel(); }
});
document.addEventListener('click', e => {
  if (e.target.id === 'backdrop') { closeModal(); dataControls.cancel(); collection.cancel(); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  if (collection.submit(form)) return;
  const data = Object.fromEntries(new FormData(form));
  const g = current();
  if (form.id === 'task-form') {
    const goal = store.state.goals.find(x => x.id === data.goal);
    if (!goal || !isActive(goal) || !data.title.trim() || !data.date) return;
    goal.tasks.push({
      id: id(),
      title: data.title.trim().slice(0, 140),
      due: data.date,
      doneAt: null,
      createdAt: new Date().toISOString()
    });
    closeModal();
    screenRoute();
    savedToast('Action planned!');
  } else if (form.id === 'move-form') {
    let f = taskById(form.dataset.task);
    if (f && isActive(f.g)) {
      f.t.due = data.date;
      closeModal();
      screenRoute();
      savedToast('Task rescheduled.');
    }
  } else if (form.id === 'edit-form' && g && !isAchieved(g)) {
    g.title = data.title.trim().slice(0, 120);
    g.success = data.success.trim();
    g.date = data.date;
    closeModal();
    screenRoute();
    savedToast('Your goal was updated.');
  }
});
document.addEventListener('submit', e => {
  const form = e.target;
  if (!['plus-form', 'woop-form', 'evidence-form', 'checkin-form', 'reminder-form'].includes(form.id)) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const g = current();
  if (['plus-form', 'woop-form'].includes(form.id) && g && isAchieved(g)) return toast('This goal is achieved. Its plan and XP are kept in your collection.');
  if (form.id === 'plus-form' && g) {
    let primer = (data.primer || '').trim().slice(0, 120);
    if (primer && store.state.goals.some(x => x.id !== g.id && x.plus?.primer?.toLowerCase() === primer.toLowerCase())) return toast('Choose a unique physical primer for each goal.');
    g.plus = {
      ...g.plus,
      challenge: Number(data.challenge || 5),
      primer,
      partner: (data.partner || '').trim().slice(0, 120),
      contract: Boolean(data.contract)
    };
    store.state.lessons.smartplus = true;
    closeModal();
    screenRoute();
    savedToast('SMART Goals+ power-ups saved!');
  } else if (form.id === 'woop-form' && g) {
    g.woop = {
      ...g.woop,
      wish: (data.wish || '').trim(),
      opportunity: (data.opportunity || '').trim(),
      obstacle: (data.obstacle || '').trim(),
      plan: (data.plan || '').trim()
    };
    store.state.lessons.woop = true;
    closeModal();
    screenRoute();
    savedToast('Obstacle plan equipped!');
  } else if (form.id === 'evidence-form' && g) {
    if (!data.text.trim()) return;
    g.notes ||= [];
    g.notes.push({
      date: today(),
      text: data.text.trim().slice(0, 700),
      evidence: (data.evidence || '').trim().slice(0, 260)
    });
    closeModal();
    screenRoute();
    savedToast('Progress evidence recorded.');
  } else if (form.id === 'checkin-form') {
    const last = store.state.journal.find(x => x.date === today());
    if (last) {
      last.mood = data.mood;
      last.note = (data.note || '').trim().slice(0, 350);
    } else store.state.journal.push({
      date: today(),
      mood: data.mood,
      note: (data.note || '').trim().slice(0, 350)
    });
    const checkinGoal = dailyGoal(store.state);
    if (checkinGoal && !checkinGoal.checkins.some(c => c.date === today())) checkinGoal.checkins.push({
      date: today(),
      mood: data.mood
    });
    closeModal();
    screenRoute();
    savedToast('Check-in saved. Your reflection matters!');
  } else if (form.id === 'reminder-form') {
    calendarDownload(data.time);
    closeModal();
    toast('Calendar reminder downloaded. Import it into your calendar app.');
  }
});
screenRoute();
