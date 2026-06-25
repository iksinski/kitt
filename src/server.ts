import Fastify from 'fastify';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { vocabRoutes } from './modules/vocab/routes.js';
import { digestRoutes } from './modules/digest/routes.js';

const app = Fastify({ logger: true });
const reviewHtml = readFileSync(fileURLToPath(new URL('../public/review.html', import.meta.url)), 'utf8');

app.get('/health', async () => ({ ok: true }));
// Vocab review UI lives under its own module route; `/` is reserved for a future dashboard.
app.get('/vocab', async (_req, reply) => { reply.type('text/html'); return reviewHtml; });
app.get('/', async (_req, reply) => {
  reply.type('text/html');
  return '<!doctype html><meta charset="utf-8"><title>kitt</title>' +
    '<body style="font-family:system-ui;background:#0f1115;color:#e6e8eb;display:grid;place-items:center;height:100vh;margin:0">' +
    '<div style="text-align:center"><h1 style="font-weight:600">kitt</h1>' +
    '<p style="color:#8b919c">Dashboard coming soon · <a style="color:#7fd1a8" href="/vocab">vocab review →</a></p></div>';
});
await app.register(vocabRoutes, { prefix: '/vocab' });
await app.register(digestRoutes, { prefix: '/digest' });

// 0.0.0.0 so the review UI is reachable from the LAN (e.g. the Mac's browser).
const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
