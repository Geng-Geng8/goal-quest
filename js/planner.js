import { today, localISO, shift, week, dayname, dated, id } from './state.js';
import { esc, toast, showModal, download } from './ui.js';
import { world, mascot } from './companions.js';
import { activeGoals, dailyGoal, isActive } from './goal-status.js';

// Timer state remains session-local, as in V4. app.js supplies rendering callbacks.
export function createPlanner({
  store,
  screen,
  quest,
  momentumPanel
}) {
  let timer = null,
    seconds = 25 * 60,
    running = false,
    timerEnd = 0;
  function home() {
    let goals = activeGoals(store.state),
      g = dailyGoal(store.state);
    if (!g) {
      screen(`<div class="card"><h1>${store.state.goals.length ? 'Room for your next chapter' : 'Begin your adventure'}</h1><p>${store.state.goals.length ? 'No active goals right now. Pick a parked goal when you are ready, or enjoy your achievements.' : 'Start with one goal that matters to you.'}</p><button class="btn line" data-nav="goals">Open my collection</button><button class="btn" data-act="new-goal">Create a goal</button></div>`);
      return;
    }
    let todays = goals.flatMap(g => g.tasks.filter(t => t.due <= today() && !t.doneAt).map(t => ({
        g,
        t
      }))),
      finished = goals.flatMap(g => g.tasks.filter(t => t.doneAt && localISO(t.doneAt) === today()).map(t => ({
        g,
        t
      })));
    const next = todays[0] || goals.flatMap(g => g.tasks.filter(t => !t.doneAt).map(t => ({
      g,
      t
    }))).sort((a, b) => a.t.due.localeCompare(b.t.due))[0];
    const completedAll = goals.reduce((n, g) => n + g.tasks.filter(t => t.doneAt).length, 0);
    const totalAll = goals.reduce((n, g) => n + g.tasks.length, 0);
    let banner = next ? `<div class="flex" style="align-items:flex-start"><span style="font-size:22px">🎯</span><div class="grow"><b style="font-size:14px">Your next move</b><div style="font-size:13px;margin:5px 0">${esc(next.t.title)}</div><span class="small muted">${esc(next.g.title)} · ${dated(next.t.due)}</span></div><button class="btn sm" data-done="${esc(next.t.id)}">Done ✓</button></div>` : `<div class="flex between"><div>All caught up. Schedule your next quest!</div><button class="btn sm" data-act="add-task">Add task</button></div>`;
    const latest = store.state.journal.filter(e => e.date === today()).at(-1);
    screen(`<div class="eyebrow">YOUR QUEST BEGINS HERE</div><h1 class="h1">Make today count<span style="color:#7467ea">.</span></h1><p class="lead">A few small actions today can lead to something extraordinary. Your progress is your story.</p><div class="cols"><div class="stack"><section class="card hero"><div class="hero-inner"><div><div class="eyebrow">✦ YOUR ADVENTURE</div><h2 class="h2">Every action helps your companion grow.</h2><p>Level up in real life, one meaningful step at a time.</p><button class="btn" data-nav="goals">See my goal collection →</button></div>${mascot(g, 170)}</div></section><section class="card"><div class="split-title"><h2 class="h2">Today's quests</h2><button class="btn line sm" data-act="add-task">+ Add action</button></div><div class="preview" style="margin-bottom:14px">${banner}</div>${todays.length || finished.length ? [...todays, ...finished].slice(0, 7).map(({
      g,
      t
    }) => taskItem(g, t)).join('') : `<div class="empty">No tasks due today. Add a manageable first step.</div>`}<div class="flex between" style="margin-top:17px"><button class="btn alt sm" data-act="checkin">${latest ? 'Edit daily check-in' : '✓ 30-second check-in'}</button><button class="btn line sm" data-nav="week">Open planner →</button></div></section><section class="card"><div class="split-title"><h2 class="h2">Your next seven days</h2><button class="btn line sm" data-nav="week">View week →</button></div>${weekStrip()}<div class="stats3" style="margin-top:16px"><div class="metric"><strong>${completedAll}</strong><span>Actions finished</span></div><div class="metric"><strong>${totalAll}</strong><span>Actions planned</span></div><div class="metric"><strong>${goals.length}</strong><span>Goal companions</span></div></div></section></div><div class="stack">${quest(g)}${momentumPanel()}<section class="card"><div class="eyebrow">✦ NEXT STORY CHAPTER</div><h2 class="h2">Learn your superpowers</h2><p class="small muted">Build great goals, predict obstacles, and turn plans into real wins.</p><div style="height:9px"></div><button class="btn alt full" data-nav="path">Explore learning path →</button></section><section class="card"><div class="eyebrow">HUMAN ACCOUNTABILITY</div><h2 class="h2">Don't do it alone.</h2><p class="small muted">Invite someone you trust to ask about this goal. You're always in control of what you share.</p><button class="btn line full" data-act="partner">Copy a partner check-in</button></section></div></div>`);
  }
  function taskItem(g, t) {
    if (!isActive(g)) return `<div class="task ${t.doneAt ? 'done' : ''}"><span class="pill">${t.doneAt ? 'Finished' : 'Unfinished'}</span><div class="grow"><div class="tasktitle">${esc(t.title)}</div><div class="taskmeta">${dated(t.due)}</div></div></div>`;
    return `<div class="task ${t.doneAt ? 'done' : ''}"><button class="check ${t.doneAt ? 'done' : ''}" data-done="${esc(t.id)}" aria-label="${t.doneAt ? 'Reopen' : 'Complete'} ${esc(t.title)}">✓</button><div class="grow"><div class="tasktitle">${esc(t.title)}</div><div class="taskmeta">${world(g.category).icon} ${esc(g.title)} · ${dated(t.due)}</div></div><button class="iconbtn" data-move="${esc(t.id)}" aria-label="Reschedule task">↗</button></div>`;
  }
  function weekStrip() {
    return `<div class="weekstrip">${week().map(d => {
      let ts = activeGoals(store.state).flatMap(g => g.tasks.filter(t => t.due === d)),
        dn = ts.filter(t => t.doneAt).length;
      return `<button class="daytile ${d === today() ? 'today' : ''} ${ts.length && dn === ts.length ? 'complete' : ''}" data-nav="week"><span>${dayname(d)}</span><strong>${new Date(d + 'T12:00:00').getDate()}</strong><div class="dot"></div></button>`;
    }).join('')}</div>`;
  }
  function weekView() {
    const ds = week();
    let count = activeGoals(store.state).flatMap(g => g.tasks.filter(t => ds.includes(t.due))).length;
    screen(`<div class="eyebrow">THE SEVEN-DAY PLANNER</div><h1 class="h1">Plan your next moves.</h1><p class="lead">Goals can last months. Your seven-day plan keeps them manageable. Include breathing room: rest is part of the strategy.</p><div class="cols"><div class="stack"><section class="card"><div class="split-title"><h2 class="h2">${dated(ds[0])} – ${dated(ds[6])}</h2><span class="pill">${count} planned actions</span></div>${weekStrip()}<div class="helper">🌿 Leave unscheduled time for friends, rest, and surprises. Don't fill every hour.</div></section><section class="card"><div class="split-title"><h2 class="h2">Your schedule</h2><button class="btn sm" data-act="add-task">+ Plan an action</button></div><div class="stack">${ds.map(d => {
      let arr = activeGoals(store.state).flatMap(g => g.tasks.filter(t => t.due === d).map(t => ({
        g,
        t
      })));
      return `<div class="daygroup ${d === today() ? 'today' : ''}"><div class="flex between"><b>${dayname(d)}, ${dated(d)} ${d === today() ? '<span class="pill green">Today</span>' : ''}</b><button class="btn sm line" data-add-date="${d}">+ Task</button></div>${arr.length ? arr.map(({
        g,
        t
      }) => taskItem(g, t)).join('') : '<p class="small muted">Free time / rest — no tasks scheduled.</p>'}</div>`;
    }).join('')}</div></section></div><div class="stack"><section class="card"><div class="eyebrow">⏳ FOCUS QUEST</div><h2 class="h2">Pomodoro timer</h2><p class="small muted">Work in short, focused bursts, then take a real break.</p><div class="focusdisplay" id="timer-display">25:00</div><div class="chips" style="justify-content:center;margin-bottom:15px"><button class="chip active" data-minutes="25">25-min focus</button><button class="chip" data-minutes="5">5-min break</button><button class="chip" data-minutes="15">15-min focus</button></div><div class="flex"><button class="btn grow" id="timer-toggle" data-act="timer-toggle">Start focus</button><button class="btn line" data-act="timer-reset">↺</button></div><div class="hint" style="margin-top:11px">Focus time doesn't automatically award XP. Record the actual task you completed.</div></section><section class="card"><h2 class="h2">A smarter schedule</h2><p class="small muted">Move unfinished tasks rather than treating them as failure. Short breaks and open time make your plan more realistic.</p><button class="btn alt full" data-act="reminder">Set up calendar check-in</button></section></div></div>`);
    updateTimerText();
  }
  function newTaskModal(date = today()) {
    if (!activeGoals(store.state).length) { showModal('<h2>Choose an active goal first</h2><p>Your collection keeps parked goals and achievements safe.</p><button class="btn" data-nav="goals" data-act="close">Open my collection</button>'); return; }
    showModal(`<h2>+ Plan a new action</h2><p class="small">Short, specific tasks are easier to start.</p><form id="task-form"><div class="field"><label>What will you actually do?</label><input name="title" required maxlength="140" placeholder="Practise for 15 minutes" autofocus/></div><div class="field"><label>Which goal?</label><select name="goal">${activeGoals(store.state).map(g => `<option value="${g.id}" ${g.id === store.state.selected ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></div><div class="field"><label>When?</label><input name="date" type="date" min="${shift(today(), -30)}" value="${date}" required/></div><button class="btn full" type="submit">Add to my plan</button></form>`);
  }
  function taskById(tid) {
    for (const g of store.state.goals) {
      const t = g.tasks.find(t => t.id === tid);
      if (t) return {
        g,
        t
      };
    }
    return null;
  }
  function moveTask(tid) {
    let f = taskById(tid);
    if (!f || !isActive(f.g)) return;
    showModal(`<h2>↗ Change your plan</h2><p>${esc(f.t.title)}</p><form id="move-form" data-task="${esc(tid)}"><div class="field"><label>Move task to</label><input type="date" name="date" required value="${f.t.due}"/></div><button class="btn full">Reschedule</button></form><p class="small">Adjusting your plan isn't failure. It's part of managing your goal.</p>`);
  }
  function checkin() {
    const last = store.state.journal.filter(x => x.date === today()).at(-1);
    showModal(`<h2>✓ Your daily check-in</h2><p>Thirty seconds. Even a difficult day can teach you something.</p><form id="checkin-form" data-goal-id="${esc(dailyGoal(store.state)?.id || '')}"><div class="field"><label>How did today go?</label><select name="mood"><option value="progress" ${last?.mood === 'progress' ? 'selected' : ''}>I made progress</option><option value="stuck" ${last?.mood === 'stuck' ? 'selected' : ''}>I got stuck</option><option value="rest" ${last?.mood === 'rest' ? 'selected' : ''}>I chose to rest</option></select></div><div class="field"><label>What did you learn or what comes next?</label><textarea name="note" placeholder="One sentence is enough">${esc(last?.note || '')}</textarea></div><button type="submit" class="btn full">Save today's reflection</button></form>`);
  }
  function reminder() {
    showModal(`<h2>🔔 Choose your check-in time</h2><p>Because this is a standalone demo, it cannot send background push notifications. It can prepare a calendar event with a daily alert that you may import.</p><form id="reminder-form"><div class="field"><label>Daily check-in time</label><input type="time" name="time" value="19:00" required/></div><button class="btn full">Create calendar reminder (.ics)</button></form><div class="helper">For a physical goal-specific primer, choose SMART Goals+. Generic alerts aren't a replacement for meaningful cues.</div>`);
  }
  function calendarDownload(time) {
    const [h, m] = time.split(':').map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    if (start <= new Date()) start.setDate(start.getDate() + 1);
    const dt = v => `${v.getFullYear()}${String(v.getMonth() + 1).padStart(2, '0')}${String(v.getDate()).padStart(2, '0')}T${String(v.getHours()).padStart(2, '0')}${String(v.getMinutes()).padStart(2, '0')}${String(v.getSeconds()).padStart(2, '0')}`;
    const end = new Date(start.getTime() + 10 * 60000);
    const content = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//H4//Goal Quest//EN\r\nBEGIN:VEVENT\r\nUID:${id()}@goalquest.local\r\nDTSTAMP:${dt(new Date())}\r\nDTSTART:${dt(start)}\r\nDTEND:${dt(end)}\r\nRRULE:FREQ=DAILY;COUNT=30\r\nSUMMARY:H4 Goal Quest daily check-in\r\nDESCRIPTION:Review today's actions and plan tomorrow.\r\nBEGIN:VALARM\r\nTRIGGER:-PT0M\r\nACTION:DISPLAY\r\nDESCRIPTION:Time for your H4 Goal Quest check-in\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    download(content, 'H4-Goal-Quest-Reminder.ics', 'text/calendar;charset=utf-8');
  }
  function updateTimerText() {
    let e = document.querySelector('#timer-display');
    if (e) e.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const btn = document.querySelector('#timer-toggle');
    if (btn) btn.textContent = running ? 'Pause focus' : 'Start focus';
  }
  function timerToggle() {
    if (running) {
      running = false;
      clearInterval(timer);
      seconds = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
      updateTimerText();
      return;
    }
    running = true;
    timerEnd = Date.now() + seconds * 1000;
    timer = setInterval(() => {
      seconds = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
      updateTimerText();
      if (seconds === 0) {
        clearInterval(timer);
        running = false;
        toast('Focus session done. Take a break, then record the real action you completed.');
      }
    }, 250);
    updateTimerText();
  }
  function timerReset() {
    clearInterval(timer);
    running = false;
    seconds = 25 * 60;
    updateTimerText();
  }
  function setMinutes(b) {
    clearInterval(timer);
    running = false;
    seconds = Number(b.dataset.minutes) * 60;
    document.querySelectorAll('[data-minutes]').forEach(x => x.classList.toggle('active', x === b));
    updateTimerText();
  }
  return {
    home,
    taskItem,
    weekStrip,
    weekView,
    newTaskModal,
    taskById,
    moveTask,
    checkin,
    reminder,
    calendarDownload,
    updateTimerText,
    timerToggle,
    timerReset,
    setMinutes
  };
}
