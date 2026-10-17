// Release maintenance, not a build step. Commit sw.js together with its assets.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const paths = ['index.html', 'styles.css', 'manifest.webmanifest',
  ...(await readdir(new URL('js/', root))).filter(p => p.endsWith('.js')).map(p => 'js/' + p),
  ...(await readdir(new URL('icons/', root))).filter(p => /\.(png|svg)$/.test(p)).map(p => 'icons/' + p)].sort();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const assets = Object.fromEntries(await Promise.all(paths.map(async p => {
  const bytes = await readFile(new URL(p, root));
  if (!p.endsWith('.png') && bytes.includes(Buffer.from('\r\n'))) {
    throw new Error(`${p} must use LF line endings, as required by .gitattributes, before hashing.`);
  }
  return ['./' + p, hash(bytes)];
})));
const release = hash(JSON.stringify(assets)).slice(0, 16);
const url = new URL('sw.js', root), source = await readFile(url, 'utf8');
await writeFile(url, source.replace(/\/\/ RELEASE START[\s\S]*?\/\/ RELEASE END/,
  `// RELEASE START\nconst RELEASE = '${release}';\nconst ASSETS = ${JSON.stringify(assets, null, 2)};\n// RELEASE END`));
console.log(`Offline release ${release}: ${paths.length} files`);
