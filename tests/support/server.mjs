import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

// Test-only static hosting, including a GitHub Pages style project subdirectory.
export async function serve() {
  const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
  const server = createServer(async (request, response) => {
    // Neither V4 nor the extracted app defines an icon. Avoid browser-generated noise.
    if (new URL(request.url, 'http://localhost').pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      .replace(/^\/goal-quest(?=\/)/, '');
    const path = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    try {
      const body = await readFile(path);
      response.setHeader('Content-Type', ({'.html':'text/html', '.js':'text/javascript', '.css':'text/css'})[extname(path)] || 'text/plain');
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
