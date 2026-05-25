import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createServer } from 'node:http';

const port = Number(process.env.PORT || 5173);
const root = resolve(process.cwd());
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

createServer((req, res) => {
  const rawPath = new URL(req.url || '/', `http://${req.headers.host}`).pathname;
  const safePath = normalize(rawPath).replace(/^[/\\]+/, '').replace(/^(\.\.[/\\])+/, '');
  const candidate = resolve(join(root, safePath === '' ? 'index.html' : safePath));
  const filePath = candidate.startsWith(root) && existsSync(candidate)
    ? candidate
    : join(root, 'index.html');

  res.setHeader('Content-Type', types[extname(filePath)] || 'application/octet-stream');
  createReadStream(filePath).pipe(res);
}).listen(port, () => {
  console.log(`static frontend listening on http://localhost:${port}`);
});
