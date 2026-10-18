import { DATA_VERSION, parseSavedState, serializeBackup } from '../data-safety.js';

export const SYNC_PROTOCOL = 1;
const revision = value => Number.isSafeInteger(value) && value >= 1;

// Pure preparation, not sync/adoption: callers receive a candidate or a raw
// quarantine artifact. This module cannot write storage, render or award XP.
export function inspectRemoteProgress(record) {
  const raw = record?.state_text;
  try {
    if (!revision(record.revision) || record.protocol_version !== SYNC_PROTOCOL ||
        record.data_version !== DATA_VERSION || typeof raw !== 'string') throw new Error('Unsupported cloud envelope.');
    const state = parseSavedState(raw);
    // The canonical parser enforces byte/resource limits BEFORE any extra parse.
    // Cloud protocol 1 accepts V8 only; local backups retain their normal migrator.
    if (JSON.parse(raw).version !== DATA_VERSION) throw new Error('Unsupported cloud data.');
    const backup = serializeBackup(state);
    return { kind: 'candidate', revision: record.revision, raw, state, backup };
  } catch {
    return { kind: 'quarantine', observedRevision: record?.revision, raw,
      message: "This cloud version couldn't be opened. Your saved work is unchanged." };
  }
}

export function prepareProgressText(state) {
  // Same canonical validator/exportability guarantee as existing private backups.
  const validated = parseSavedState(JSON.stringify(state));
  serializeBackup(validated);
  return JSON.stringify(validated);
}
