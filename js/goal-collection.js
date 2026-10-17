import { esc, toast, showModal, closeModal } from './ui.js';
import { mascot } from './companions.js';
import { activeGoals, isAchieved, parkGoal, activateGoal, achieveGoal } from './goal-status.js';

export function createGoalCollection({ store, render, navigate }) {
  let pendingActivation = null;
  function dialog(html) {
    showModal(html);
    const modal = document.querySelector('#modalhost .modal');
    modal.dataset.collectionDialog = '';
    modal.removeAttribute('aria-label');
    modal.setAttribute('aria-labelledby', 'collection-heading');
    (modal.querySelector('[data-initial-focus]') || modal.querySelector('[data-act="close"]')).focus();
  }
  function cancel() {
    pendingActivation = null;
  }
  function changed(message) {
    closeModal();
    render();
    cancel();
    toast(store.status.kind === 'saved' ? message : 'Your changes are on this page but could not be saved. Download a backup before closing it.');
  }
  function requestActive(g, commit) {
    const others = activeGoals(store.state).filter(x => x !== g);
    if (others.length < 3) { g.goalStatus = 'active'; commit(); return; }
    const needed = others.length - 2;
    pendingActivation = { g, commit };
    dialog(`<h2 id="collection-heading">Make room to focus</h2><p>Try 1–3 active goals at a time. Keep this goal parked for later, or choose ${needed === 1 ? 'one goal' : `at least ${needed} goals`} to park. All tasks, XP and notes stay safe.</p><form id="activate-goal-form"><fieldset class="park-choices"><legend>Which goals can wait?</legend>${others.map(x => `<label><input type="checkbox" name="park" value="${esc(x.id)}"/> <span>${esc(x.title)}</span></label>`).join('')}</fieldset><p id="activation-error" role="alert"></p><div class="flex wrap"><button type="button" class="btn line" data-act="keep-parked" data-initial-focus>Keep this goal parked</button><button class="btn" type="submit">Park selected & activate</button></div></form>`);
  }
  function act(action) {
    const g = store.current();
    if (action === 'park-goal') { if (parkGoal(g)) changed('Goal parked. Your progress is safe.'); }
    else if (action === 'activate-goal') {
      if (g && !isAchieved(g)) requestActive(g, () => changed('Goal active. Choose your next move!'));
    } else if (action === 'keep-parked') {
      const pending = pendingActivation;
      if (pending) { parkGoal(pending.g); pendingActivation = null; closeModal(); pending.commit(); cancel(); }
    } else if (action === 'achieve-goal') {
      if (!g || isAchieved(g)) return true;
      dialog(`<h2 id="collection-heading">I've achieved my goal</h2><p><b>${esc(g.title)}</b></p><div class="preview">Success looks like: ${esc(g.success)}</div><p>Checking off tasks shows effort. Achieving your goal means you've reached the result you wanted. Your tasks and progress will stay in your collection.</p><form id="achieve-goal-form" data-goal-id="${esc(g.id)}"><div class="field"><label for="achievement-reflection">What did you accomplish?</label><textarea id="achievement-reflection" name="reflection" required maxlength="700" data-initial-focus></textarea></div><div class="field"><label for="achievement-proof">How do you know you reached your goal?</label><textarea id="achievement-proof" name="howKnow" required maxlength="700" placeholder="Think about your success statement above."></textarea></div><div class="field"><label for="achievement-evidence">Evidence reference (optional)</label><input id="achievement-evidence" name="evidence" maxlength="260" placeholder="e.g. My performance video or test result"/><span class="hint">A private note, not a file upload.</span></div><div class="field"><label for="achievement-milestone">A milestone to remember (optional)</label><textarea id="achievement-milestone" name="milestone" maxlength="700"></textarea></div><p id="achievement-error" role="alert"></p><div class="flex wrap"><button type="button" class="btn line" data-act="close">Keep working on it</button><button type="submit" class="btn">Save to Hall of Achievements</button></div></form>`);
    } else if (action === 'celebrate-achievement') {
      const art = document.querySelector('.achievement-art');
      if (art && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        art.getAnimations().forEach(a => a.cancel());
        art.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08) rotate(3deg)' }, { transform: 'scale(1)' }], { duration: 650, iterations: 1 });
      }
    } else if (action === 'view-achievements') { closeModal(); cancel(); navigate('goals'); const hall = document.querySelector('#hall-achievements'); hall?.scrollIntoView(); hall?.focus(); }
    else return false;
    return true;
  }
  function submit(form) {
    if (form.id === 'activate-goal-form') {
      const pending = pendingActivation;
      if (!pending) return true;
      // New goals have not entered the collection yet; validate with the same rules.
      const state = store.state.goals.includes(pending.g) ? store.state : { goals: [...store.state.goals, pending.g] };
      const ids = new FormData(form).getAll('park');
      if (!activateGoal(state, pending.g, ids)) {
        document.querySelector('#activation-error').textContent = 'Choose enough goals to leave room for this one. Nothing has changed yet.';
        return true;
      }
      pendingActivation = null;
      closeModal();
      pending.commit();
      cancel();
      return true;
    }
    if (form.id !== 'achieve-goal-form') return false;
    const g = store.state.goals.find(x => x.id === form.dataset.goalId);
    if (!achieveGoal(g, Object.fromEntries(new FormData(form)))) {
      document.querySelector('#achievement-error').textContent = 'Write what you accomplished and how you know. An achieved goal can only be recorded once.';
      return true;
    }
    render();
    const saved = store.status.kind === 'saved';
    dialog(`<h2 id="collection-heading">You made it happen!</h2><div class="achievement-art">${mascot({ ...g, id: g.id + '-achievement' }, 150)}</div><p>You achieved <b>${esc(g.title)}</b>. Your companion and your story now have a place in your Hall of Achievements.</p>${saved ? '' : '<p class="data-notice" role="alert">This achievement could not be saved. Keep this page open and download a full backup.</p>'}<div class="flex wrap"><button class="btn" data-act="view-achievements" data-initial-focus>See my Hall of Achievements</button><button class="btn line" data-act="celebrate-achievement">✦ Celebrate</button></div><p class="hint">Animation is optional and respects reduced motion.</p>`);
    return true;
  }
  return { act, submit, requestActive, cancel };
}
