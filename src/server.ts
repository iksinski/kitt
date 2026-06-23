import Fastify from 'fastify';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { vocabRoutes } from './modules/vocab/routes.js';
import { digestRoutes } from './modules/digest/routes.js';

const app = Fastify({ logger: true });
const reviewHtml = readFileSync(fileURLToPath(new URL('../public/review.html', import.meta.url)), 'utf8');

app.get('/health', async () => ({ ok: true }));
app.get('/', async (_req, reply) => { reply.type('text/html'); return reviewHtml; });
await app.register(vocabRoutes, { prefix: '/vocab' });
await app.register(digestRoutes, { prefix: '/digest' });

// 0.0.0.0 so the review UI is reachable from the LAN (e.g. the Mac's browser).
const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
