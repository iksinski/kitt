import type { FastifyInstance } from 'fastify';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDigest } from './build.js';
import { sendToKindle, mailConfigured } from './mail.js';

const DIR = `${process.env.HOME}/digests`;
const ICONS = fileURLToPath(new URL('../../../assets/weather-icons/', import.meta.url));

export async function digestRoutes(app: FastifyInstance) {
  // Serve weather icons so the cached preview renders them (the EPUB embeds its own copies).
  app.get('/icons/:name', async (req, reply) => {
    const name = (req.params as { name: string }).name.replace(/[^A-Za-z0-9_.]/g, '');
    try {
      const data = await readFile(join(ICONS, name));
      reply.type('image/png');
      return data;
    } catch {
      reply.code(404);
      return 'not found';
    }
  });

  // Instant preview: serve the most recently BUILT paper. Building is expensive
  // (extraction + LLM cleanup = minutes), so it must never run on a page load.
  app.get('/preview', async (_req, reply) => {
    reply.type('text/html');
    try {
      const files = (await readdir(DIR)).filter((f) => f.endsWith('.html')).sort();
      if (files.length) return await readFile(join(DIR, files[files.length - 1]), 'utf8');
    } catch { /* no digests dir yet */ }
    return '<body style="font-family:system-ui;max-width:600px;margin:3rem auto;line-height:1.5">No paper built yet — run <code>POST /digest/build</code> (takes a few minutes) or wait for the morning run.</body>';
  });

  // Build today's paper (extract + clean + assemble) and save both the EPUB and an HTML copy.
  app.post('/build', async (req) => {
    const stories = Number((req.query as { stories?: string })?.stories) || undefined;
    const { buffer, html, meta } = await buildDigest({ stories });
    await mkdir(DIR, { recursive: true });
    const base = join(DIR, `kitt-daily-${meta.date}`);
    await writeFile(base + '.epub', buffer);
    await writeFile(base + '.html', html);
    return { ...meta, path: base + '.epub', bytes: buffer.length };
  });

  // Build today's paper and email it to the Kindle. This is what the morning timer calls.
  app.post('/send', async () => {
    if (!mailConfigured()) return { sent: false, reason: 'mail not configured — set SMTP_* and KINDLE_EMAIL in .env' };
    const { buffer, html, meta } = await buildDigest();
    await mkdir(DIR, { recursive: true });
    const base = join(DIR, `kitt-daily-${meta.date}`);
    await writeFile(base + '.epub', buffer);
    await writeFile(base + '.html', html);
    await sendToKindle(buffer, `kitt-daily-${meta.date}.epub`);
    return { ...meta, sent: true };
  });
}
