// Optional artwork maintenance with an already available Playwright/Edge runtime.
// Not required to run or host the app. No packages are installed.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage();
  const svg = await readFile(new URL('../icons/brandmark.svg', import.meta.url), 'utf8');
  for (const [name, size, opaque] of [['icon-192',192,false],['icon-512',512,false],['maskable-512',512,true],['apple-touch-icon',180,true]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent('<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>' + svg.replace('rx="175"', opaque ? 'rx="0"' : 'rx="175"'));
    await page.screenshot({ path: fileURLToPath(new URL(`../icons/${name}.png`, import.meta.url)), omitBackground: true });
  }
} finally { await browser.close(); }
