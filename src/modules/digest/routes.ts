import type { FastifyInstance } from 'fastify';
import { mkdir, writeFile } from 'node:fs/promises';
import { buildDigest } from './build.js';

export async function digestRoutes(app: FastifyInstance) {
  // Browser preview of today's paper (HTML, no EPUB) — eyeball content before shipping.
  app.get('/preview', async (_req, reply) => {
    const { html } = await buildDigest();
    reply.type('text/html');
    return html;
  });

  // Build the EPUB and save it under ~/digests/. (Email delivery wired separately.)
  app.post('/build', async () => {
    const { buffer, meta } = await buildDigest();
    const dir = `${process.env.HOME}/digests`;
    await mkdir(dir, { recursive: true });
    const path = `${dir}/kitt-daily-${meta.date}.epub`;
    await writeFile(path, buffer);
    return { ...meta, path, bytes: buffer.length };
  });
}
