import { isActive, isAchieved } from './goal-status.js';

// Legacy saves keep their exact capped total until their first rewarded edit.
// A single total and two plan flags replace a growing reward-event ledger.
export function legacyXP(g) {
  return Math.min(g.tasks.filter(t => t.doneAt).length, 300) * 35
    + Math.min(g.checkins.length, 100) * 10
    + (g.woop?.plan ? 25 : 0) + (g.plus?.contract ? 20 : 0);
}
export const gxp = g => g.rewards?.xp ?? legacyXP(g);
function rewards(g) {
  return g.rewards ||= { xp: legacyXP(g), woop: Boolean(g.woop?.plan), commitment: Boolean(g.plus?.contract) };
}
function credit(r, amount) {
  const previous = r.xp;
  r.xp = Math.min(Number.MAX_SAFE_INTEGER, r.xp + amount);
  return r.xp - previous;
}
export function toggleTask(g, t, now = new Date().toISOString()) {
  if (!isActive(g) || !g.tasks.includes(t)) return 0;
  const r = rewards(g);
  // doneAt on a legacy task also means its reward was already counted.
  const earned = !t.doneAt && !t.rewardedAt ? 35 : 0;
  if (t.doneAt) { t.rewardedAt ||= t.doneAt; t.doneAt = null; }
  else { t.rewardedAt ||= now; t.doneAt = now; }
  return credit(r, earned);
}
// Call before replacing the plan, so legacy rewards are captured faithfully.
export function rewardPlan(g, kind, candidate) {
  // Planning can happen while a goal waits; only achieved plans are final.
  if (isAchieved(g)) return 0;
  const r = rewards(g);
  const ready = kind === 'woop'
    ? ['wish', 'opportunity', 'obstacle', 'plan'].every(k => candidate[k]?.trim())
    : kind === 'commitment' && candidate.contract;
  if (!ready || r[kind]) return 0;
  const earned = kind === 'woop' ? 25 : 20;
  r[kind] = true;
  return credit(r, earned);
}
export function saveCheckin(state, g, date, mood, note) {
  const previous = state.journal.find(c => c.date === date);
  if (previous) { previous.mood = mood; previous.note = note; return 0; }
  const entry = { date, mood, note };
  state.journal.push(entry);
  if (!g || !isActive(g) || g.checkins.some(c => c.date === date)) return 0;
  const r = rewards(g);
  entry.goalId = g.id;
  g.checkins.push({ date, mood });
  return credit(r, 10);
}
