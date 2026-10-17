// Pure collection rules. Old archived records stay distinct until a student chooses.
export const goalStatus = g => g.goalStatus || (g.archived ? 'archived' : 'active');
export const isActive = g => goalStatus(g) === 'active';
export const isAchieved = g => goalStatus(g) === 'achieved';
export const activeGoals = state => state.goals.filter(isActive);
export const dailyGoal = state => activeGoals(state).find(g => g.id === state.selected) || activeGoals(state)[0];

export function parkGoal(g) {
  if (!g || isAchieved(g)) return false;
  g.goalStatus = 'parked';
  return true;
}

// Validate the whole choice before changing anything, including legacy collections >3.
export function activateGoal(state, target, parkIds = []) {
  if (!target || isAchieved(target) || !state.goals.includes(target)) return false;
  const active = activeGoals(state).filter(g => g !== target);
  const chosen = new Set(parkIds);
  if ([...chosen].some(id => !active.some(g => g.id === id))) return false;
  if (active.length - chosen.size >= 3) return false;
  active.filter(g => chosen.has(g.id)).forEach(parkGoal);
  target.goalStatus = 'active';
  return true;
}

// Achievement is an explicit reflection, independent of the number of checked tasks.
// No XP is added: the collection entry is the reward, so retries cannot farm XP.
export function achieveGoal(g, { reflection, howKnow, evidence = '', milestone = '' }, now = new Date()) {
  if (!g || isAchieved(g) || g.goalAchievement) return false;
  if (![reflection, howKnow, evidence, milestone].every(v => typeof v === 'string')) return false;
  if (!reflection.trim() || !howKnow.trim() || !Number.isFinite(now.getTime())) return false;
  g.goalAchievement = {
    achievedAt: now.toISOString(),
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    reflection: reflection.trim().slice(0, 700),
    howKnow: howKnow.trim().slice(0, 700),
    evidence: evidence.trim().slice(0, 260),
    milestone: milestone.trim().slice(0, 700)
  };
  g.goalStatus = 'achieved';
  return true;
}
