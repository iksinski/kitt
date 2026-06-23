import Fastify from 'fastify';
import { vocabRoutes } from './modules/vocab/routes.js';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ ok: true }));
await app.register(vocabRoutes, { prefix: '/vocab' });

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: '127.0.0.1' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
