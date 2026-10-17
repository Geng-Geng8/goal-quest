import { esc, toast, showModal, copy } from './ui.js';
import { worlds, taskCount } from './companions.js';
import { dailyGoal, isAchieved } from './goal-status.js';
const lessons = [['wheel', '🧭', 'Discover your direction', 'Explore seven areas of life and choose what matters.'], ['smart', '🎯', 'SMART Goals: the H4 way', 'Clear, measurable, agreed upon, realistic, timely.'], ['smartplus', '✨', 'SMART Goals+ power-ups', 'Challenge, physical primers, accountability, commitment.'], ['woop', '🛡️', 'WOOP: face your obstacles', 'Wish, opportunity, obstacle, and your if–then plan.'], ['planner', '📅', 'Master your seven-day plan', 'Make space for action, Pomodoro sessions and free time.'], ['partner', '🤝', 'Keep your promises', 'Create an accountability system with someone you trust.']];
const prompts = {
  clarify: {
    title: 'Goal Clarity Coach',
    desc: 'A guided conversation to make a goal clearer without doing the thinking for you.',
    text: g => `You are my H4 Goal Meeting Coach. I am a high school student. Ask one short question at a time. Help me improve my goal using H4 SMART: Specific, Measurable, Agreed Upon, Realistic, Timely. Do not write the final goal for me; guide me to decide. My goal is: ${g?.title || '[my goal]'}. Success would look like: ${g?.success || '[how I will recognize success]'}. Avoid asking for personal or sensitive information.`
  },
  woop: {
    title: 'WOOP Coach',
    desc: 'Prepare for an obstacle with an if–then response.',
    text: g => `Act as a supportive H4 WOOP coach for a high school student. Ask me one question at a time about my Wish, Opportunity (positive outcome), Obstacle, and Plan. Help me write one short "If [obstacle], then I will [action]" sentence. My goal is: ${g?.title || '[my goal]'}. My challenge is: ${g?.woop?.obstacle || '[what might get in the way]'}. Avoid personal or sensitive details.`
  },
  checkin: {
    title: 'Accountability Coach',
    desc: 'Reflect on what happened and plan one next action.',
    text: g => `You are an H4 Accountability Coach for a student. Ask me these questions one by one: What did I plan? What did I do? What got in the way? What is one small next action and when will I do it? Be encouraging but practical. Do not shame missed actions or pretend to verify work. My goal is ${g?.title || '[my goal]'}. Keep each response under 80 words.`
  },
  weekly: {
    title: 'Weekly Planning Coach',
    desc: 'Make a realistic seven-day plan with plenty of free time.',
    text: g => `You are my H4 Seven-Day Planning Coach. Help me make a realistic plan for the next 7 days, not finish my entire long-term goal in one week. Ask about my available time, priorities, rest and other responsibilities. Suggest small tasks, suitable Pomodoro focus blocks, breaks, and unscheduled free time. My goal is ${g?.title || '[my goal]'}. Ask one short question at a time and let me choose.`
  }
};
export function createAcademy({
  store,
  screen
}) {
  const current = () => store.state.screen === 'home' ? dailyGoal(store.state) : store.current();
  function learning() {
    let n = lessons.filter(l => store.state.lessons[l[0]]).length;
    screen(`<div class="eyebrow">THE GOAL MEETING ACADEMY</div><h1 class="h1">Your learning adventure.</h1><p class="lead">Six short quests teach you how to turn big wishes into real accomplishments. Go in order or jump to what helps today.</p><div class="cols"><div class="stack"><section class="card"><div class="flex between"><b>${n} of ${lessons.length} lessons tried</b><span class="pill">${Math.round(100 * n / lessons.length)}% explored</span></div><div class="progress" style="margin-top:12px"><div style="width:${100 * n / lessons.length}%"></div></div><div class="hint" style="margin-top:12px">You learn best by applying each lesson to a real goal.</div></section>${lessons.map(([k, emoji, title, description], i) => `<button class="lesson" data-lesson="${k}"><span class="lessonico">${emoji}</span><span class="grow"><div class="micro">CHAPTER ${i + 1} ${store.state.lessons[k] ? '· EXPLORED' : '· READY'}</div><h3>${title}</h3><p>${description}</p></span><span style="font-weight:800;color:${store.state.lessons[k] ? '#29ac84' : '#786bdb'}">${store.state.lessons[k] ? '✓' : '→'}</span></button>`).join('')}</div><div class="stack"><section class="card"><div class="eyebrow">WHY THIS WORKS</div><h2 class="h2">Learn it. Try it. Do it.</h2><p class="small muted">Every lesson includes a quick explanation, an activity, and a way to apply it to your goal. No long lectures or confusing forms.</p><div class="helper">The core app works without AI. Lessons teach you directly, and optional copyable prompts offer extra support elsewhere.</div><button class="btn alt full" data-nav="coach">Find an optional coach prompt →</button></section><section class="card"><h2 class="h2">Make something happen</h2><p class="small muted">Want to skip lessons for now? You can always start with a simple goal.</p><button class="btn full" data-act="new-goal">Create my next goal</button></section></div></div>`);
  }
  function coach() {
    const g = current();
    screen(`<div class="eyebrow">OPTIONAL · NO API CONNECTION</div><h1 class="h1">Your coach, your choice.</h1><p class="lead">Choose a ready-to-use coaching prompt. Copy it into an external LLM you already use, then decide what to apply to your goal. Capstone itself sends nothing to AI.</p><div class="cols"><div class="stack">${Object.entries(prompts).map(([k, p]) => `<section class="card"><div class="flex between"><div><div class="eyebrow">✦ COPY & PASTE COACHING</div><h2 class="h2">${esc(p.title)}</h2></div><span class="pill">Optional</span></div><p class="small muted">${esc(p.desc)}</p><div class="flex wrap"><button class="btn" data-prompt="${k}">Copy coach prompt ↗</button><button class="btn line" data-prompt-view="${k}">Preview</button></div></section>`).join('')}</div><div class="stack"><section class="card"><div class="eyebrow">HOW IT WORKS</div><div style="display:grid;gap:14px"><div><b>1. Choose a coach</b><div class="small muted">Pick help with a goal, WOOP, check-ins or planning.</div></div><div><b>2. Copy the prompt</b><div class="small muted">Open ChatGPT, Gemini or another permitted tool.</div></div><div><b>3. Have a conversation</b><div class="small muted">The coach will ask simple questions, one at a time.</div></div><div><b>4. Bring back your ideas</b><div class="small muted">Edit your goal and actions yourself inside Capstone.</div></div></div></section><div class="sectionnote">For students: follow your school and AI provider's age/account rules. Never paste private journal entries, health information, passwords or other people's details into a public chatbot.</div></div></div>`);
  }
  function wheelLesson() {
    const ratings = worlds.map(w => `<div class="wheelitem"><div class="flex between"><b>${w.icon} ${esc(w.label)}</b><span id="wheelval-${w.id}" class="pill">${store.state.wheel[w.id] || 5}/10</span></div><input type="range" min="1" max="10" value="${store.state.wheel[w.id] || 5}" data-wheel="${w.id}" aria-label="${esc(w.label)} satisfaction"/><div class="tiny muted">How satisfied do you feel? You can skip any category.</div></div>`).join('');
    showModal(`<h2>🧭 Discover your direction</h2><p class="small">These areas can spark ideas. They're personal—there's no perfect score. You don't have to rate everything.</p><div class="wheelgrid">${ratings}</div><div class="helper">A low score doesn't mean you're failing. Choose the area you feel most excited or ready to improve.</div><button class="btn full" data-act="wheel-finish">Done exploring</button>`);
  }
  function lesson(k) {
    if (k === 'wheel') return wheelLesson();
    let g = current();
    if (g && isAchieved(g) && ['smartplus', 'woop'].includes(k)) return toast('Choose an active or parked goal in My Goals to try this. Your achieved goal keeps its plan and XP.');
    if (!g && k !== 'smart') return toast('Create a goal first, then apply this lesson to it.');
    if (k === 'smart') {
      showModal(`<h2>🎯 SMART Goals, the H4 way</h2><p>Five quick questions help turn an idea into a goal you can act on.</p><div class="stack" style="font-size:13px"><div><b>S — Specific:</b> Is your goal clear?</div><div><b>M — Measurable:</b> Can you track an outcome or actions?</div><div><b>A — Agreed Upon:</b> Is this your choice? Does your group agree?</div><div><b>R — Realistic:</b> Does it fit your skills and resources?</div><div><b>T — Timely:</b> Do you have a target or review date?</div></div><div class="helper">Example: “Get better at dance” → “Practise a 60-second routine three times each week and perform it by December.”</div><button class="btn full" data-act="learn-done" data-key="smart">I get it — back to my goals</button>`);
      return;
    }
    if (k === 'smartplus') {
      showModal(`<h2>✨ SMART Goals+ power-ups</h2><p>Optional upgrades for your goal: <b>${esc(g.title)}</b></p><form id="plus-form"><div class="field"><label>Challenging — how hard does this feel? <span id="challenge-value">${g.plus.challenge}/10</span></label><input type="range" min="1" max="10" name="challenge" value="${g.plus.challenge}" data-challenge/></div><div class="field"><label>Physical primer — what unique object will remind you?</label><input name="primer" value="${esc(g.plus.primer)}" placeholder="e.g. Dance shoes beside my door"/><div class="hint">Choose a physical cue tied only to this goal. Not a generic phone alert.</div></div><div class="field"><label>Accountability — who could check in with you?</label><input name="partner" value="${esc(g.plus.partner)}" placeholder="e.g. My teacher, teammate, or friend"/></div><label class="flex small" style="margin:16px 0"><input type="checkbox" name="contract" ${g.plus.contract ? 'checked' : ''} style="width:18px;height:18px"/> I commit to making a genuine effort toward this goal.</label><button class="btn full" type="submit">Save power-ups</button></form>`);
      return;
    }
    if (k === 'woop') {
      showModal(`<h2>🛡️ WOOP: your obstacle shield</h2><p>Imagine the good outcome, identify what might stop you, and prepare one response.</p><form id="woop-form"><div class="field"><label>W — Wish: What do you want?</label><input name="wish" value="${esc(g.woop.wish)}" placeholder="I want to perform my dance routine"/></div><div class="field"><label>O — Opportunity (positive outcome): How will success feel?</label><input name="opportunity" value="${esc(g.woop.opportunity)}" placeholder="Proud and more confident"/></div><div class="field"><label>O — Obstacle: What might get in the way?</label><input name="obstacle" value="${esc(g.woop.obstacle)}" placeholder="I get distracted by my phone"/></div><div class="field"><label>P — Plan: If...then...</label><textarea name="plan" placeholder="If I get distracted, then I'll set my phone aside and practise 5 minutes.">${esc(g.woop.plan)}</textarea></div><button class="btn full" type="submit">Save my obstacle plan</button></form>`);
      return;
    }
    if (k === 'planner') {
      showModal(`<h2>📅 Protect your week</h2><p>Goal-setting works better when you reserve time for tasks <b>and</b> time to rest.</p><div class="stack"><div class="preview">1. Identify a small next action.</div><div class="preview">2. Give it a specific day.</div><div class="preview">3. Use a 25-minute focus session and a 5-minute break if helpful.</div><div class="preview">4. Keep free time. Don't plan every minute.</div><div class="preview">5. Review after seven days and make the next plan.</div></div><button class="btn full" style="margin-top:16px" data-act="learn-done" data-key="planner" data-next="week">Plan my week →</button>`);
      return;
    }
    if (k === 'partner') {
      showModal(`<h2>🤝 Choose an accountability partner</h2><p>A partner can ask what you've planned, what happened, and what comes next.</p><div class="preview">Make a short weekly meeting: <b>Review → Reflect → Adjust → Commit.</b></div><p class="small">Only share what you're comfortable sharing. This demo creates a message you choose to send—there is no live connection to other students.</p><button class="btn full" data-act="learn-done" data-key="partner" data-next="partner">Prepare a partner check-in →</button>`);
      return;
    }
  }
  function partner() {
    const g = current();
    if (!g) return;
    const s = taskCount(g),
      t = g.tasks.find(t => !t.doneAt);
    let txt = `H4 Goal Meeting — accountability check-in\nMy goal: ${g.title}\nSuccess looks like: ${g.success}\nActions completed: ${s.n} of ${s.total}\nNext action: ${t?.title || 'Plan a new step'}\nCould you check in with me this week about how it's going?\n(I'm choosing to share only this update.)`;
    showModal(`<h2>🤝 A little help goes a long way</h2><p>Send a check-in to someone you trust. This demo does not connect accounts or reveal your other private goals.</p><textarea id="share-text" readonly style="width:100%;height:190px;resize:vertical;padding:12px;border-radius:12px;border:1px solid #dce1ef">${esc(txt)}</textarea><button class="btn full" data-act="copy-share">Copy check-in message</button>`);
  }
  function coachingPrompt(k, preview = false) {
    const g = current();
    const text = prompts[k].text(g);
    if (preview) {
      showModal(`<h2>${esc(prompts[k].title)}</h2><p>Preview the text before choosing to paste it into an external LLM.</p><textarea id="coach-preview" readonly style="width:100%;height:240px;resize:vertical;padding:12px;border:1px solid #dce1ef;border-radius:12px">${esc(text)}</textarea><button class="btn full" data-prompt="${k}">Copy prompt</button>`);
    } else copy(text, 'Coaching prompt copied. Open your preferred LLM and paste it.');
  }
  return {
    learning,
    coach,
    wheelLesson,
    lesson,
    partner,
    coachingPrompt
  };
}
export { lessons, prompts };
