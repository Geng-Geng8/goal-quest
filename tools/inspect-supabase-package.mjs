// Offline inspection of an already downloaded official tarball. No installation,
// dependency resolution, bundling, network requests or application changes.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const [archive, output] = process.argv.slice(2);
if (!archive || !output) throw new Error('Usage: node tools/inspect-supabase-package.mjs <tarball> <empty-temporary-directory>');
const pin = JSON.parse(readFileSync(new URL('../docs/security/supabase-package.json', import.meta.url)));
const bytes = readFileSync(archive);
assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), pin.integrity, 'npm archive integrity mismatch');
const members = execFileSync('tar', ['-tzf', resolve(archive)], { encoding: 'utf8' }).trim().split(/\r?\n/);
assert.ok(members.every(name => /^package\//.test(name) && !name.split('/').includes('..') && !name.includes('\\')), 'Unexpected archive paths');
const target = resolve(output); mkdirSync(target, { recursive: false });
execFileSync('tar', ['-xzf', resolve(archive), '-C', target]);
const meta = JSON.parse(readFileSync(join(target, 'package/package.json')));
assert.equal(meta.name, pin.name); assert.equal(meta.version, pin.version); assert.equal(meta.license, 'MIT');
const umd = readFileSync(join(target, 'package/dist/umd/supabase.js'));
assert.equal(createHash('sha256').update(umd).digest('hex'), pin.browserSha256);
assert.equal(umd.length, pin.browserBytes);
assert.ok(readFileSync(join(target, 'package/LICENSE'), 'utf8').includes('MIT'));
console.log(JSON.stringify({ version: meta.version, browserBytes: umd.length, browserSha256: pin.browserSha256,
  artifact: join(target, 'package/dist/umd/supabase.js'), dependencies: meta.dependencies, status: 'Verified archive and UMD bytes; runtime approval still required.' }, null, 2));
