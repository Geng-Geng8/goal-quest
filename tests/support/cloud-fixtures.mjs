import { emptyState, parseSavedState } from '../../js/data-safety.js';
import { nearLimitState } from './near-limit.mjs';

export function cloudFixtures() {
  const raw = state => JSON.stringify(state);
  const valid = emptyState();
  const goal = { id: 'synthetic-goal', category: 'school', title: 'Synthetic test', success: 'Practise', date: '2026-10-18', tasks: [] };
  const withGoal = value => raw({ ...valid, goals: [{ ...goal, ...value }] });
  let deep = 'end'; for (let i = 0; i < 34; i++) deep = { next: deep };
  return [
    ['valid', raw(valid), true, true],
    ['unknown fields and Unicode', raw({ ...valid, future: { text: '💜<img src=x onerror=alert(1)>', number: 1.25 } }), true, true],
    ['escaped Unicode', raw(valid).replace('"home"', '"ho\\u006de"'), true, true],
    ['exact maximum bytes', raw(nearLimitState(valid)), true, true],
    ['oversized', raw(nearLimitState(valid)) + ' ', false, false],
    ['malformed JSON', '{', false, false],
    ['wrong top-level type', '[]', false, false],
    ['string version', raw({ ...valid, version: '8' }), false, false],
    ['future version', raw({ ...valid, version: 9 }), false, false],
    ['wrong goals type', raw({ ...valid, goals: {} }), false, false],
    ['too many goals', raw({ ...valid, goals: Array(1001).fill(goal) }), false, false],
    ['invalid date', withGoal({ date: '2026-02-30' }), true, false],
    ['duplicate IDs', raw({ ...valid, goals: [goal, goal] }), true, false],
    ['missing achievement', withGoal({ goalStatus: 'achieved' }), true, false],
    ['unsafe reward', withGoal({ rewards: { xp: -1, woop: false, commitment: false } }), true, false],
    ['prototype key', raw(valid).replace('"wheel":{}', '"wheel":{"__proto__":{}}'), true, false],
    ['unsafe number', raw({ ...valid, future: 9007199254740992 }), true, false],
    ['overflowing number', raw(valid).replace('"momentum":0', '"momentum":1e400'), true, false],
    ['control character', raw({ ...valid, future: '\u0000' }), true, false],
    ['too deep', raw({ ...valid, future: deep }), true, false],
    // PostgreSQL json should retain escaped surrogates in unknown text. Actual
    // server compatibility is asserted by the integration fixture matrix.
    ['lone surrogate unknown', raw({ ...valid, future: '\ud800' }), true, true]
  ].map(([name, text, server, client]) => ({ name, text, server, client }));
}

export function migratedLegacyFixtures(v4) {
  return [4, 5, 6, 7, 8].map(version => {
    const state = parseSavedState(JSON.stringify({ ...v4, version }));
    return { name: `migrated V${version}`, text: JSON.stringify(state), server: true, client: true };
  });
}
