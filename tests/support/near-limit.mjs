import { MAX_BACKUP_BYTES } from '../../js/data-safety.js';

// Valid unknown content with multibyte text and JSON escapes, sized in UTF-8
// bytes rather than JavaScript characters. Each string stays below its cap.
export function nearLimitState(state, bytes = MAX_BACKUP_BYTES) {
  const result = structuredClone(state);
  result.boundary = [];
  const size = () => Buffer.byteLength(JSON.stringify(result));
  const chunk = '💜"\\\n'.repeat(10000);
  while (size() + Buffer.byteLength(JSON.stringify(chunk)) + 4 < bytes) result.boundary.push(chunk);
  result.boundary.push('');
  result.boundary[result.boundary.length - 1] = 'x'.repeat(bytes - size());
  return result;
}
