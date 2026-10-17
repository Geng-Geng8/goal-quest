// Baseline integrity tests require only Node.js built-in modules.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Script } from 'node:vm';

const original = readFileSync(new URL('../reference/capstone_quest_v4.html', import.meta.url), 'utf8');
const frozenHash = '7607ba293945da65c00b18b67462c12f2f2bc68083b8a747946fdcba92b26d48';

test('V4 reference remains unchanged', () => {
  const actualHash = createHash('sha256').update(original).digest('hex');
  assert.equal(actualHash, frozenHash);
});

test('V4 baseline inline JavaScript parses', () => {
  const script = original.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);
  assert.ok(script, 'reference should have an inline script');
  assert.doesNotThrow(() => new Script(script[1]));
});

test('V4 baseline retains core product vocabulary and storage key', () => {
  for (const word of [
    "h4_goal_quest_v4", 'Astri', 'Coino', 'Embi', 'Glimo', 'Hugo', 'Sprig', 'Luma',
    'Agreed Upon', 'Opportunity', 'Today', 'My Week', 'My Goals', 'Learn', 'Coach',
  ]) {
    assert.ok(original.includes(word), `V4 reference must include ${word}`);
  }
});
