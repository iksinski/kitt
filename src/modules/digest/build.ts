import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildEpub } from './epub.js';
import type { DigestModule, DigestContext, Block } from './types.js';
import { weatherModule } from './modules/weather.js';
import { fxModule } from './modules/fx.js';
import { vocabModule } from './modules/vocab.js';
import { newsModule } from './modules/news.js';

export interface DigestResult {
  buffer: Buffer;
  html: string;
  meta: { date: string; sections: number; pages: number };
}

const ICON_DIR = fileURLToPath(new URL('../../../assets/weather-icons/', import.meta.url));

export async function buildDigest(opts?: { stories?: number; lat?: number; lon?: number; city?: string }): Promise<DigestResult> {
  const stories = opts?.stories ?? Number(process.env.DIGEST_STORIES ?? 10);
  const lat = opts?.lat ?? Number(process.env.DIGEST_LAT ?? 52.13);
  const lon = opts?.lon ?? Number(process.env.DIGEST_LON ?? 21.08);
  const label = opts?.city ?? process.env.DIGEST_CITY ?? 'Warsaw · Kabaty';
  const date = new Date().toISOString().slice(0, 10);
  const ctx: DigestContext = { date, location: { lat, lon, label } };

  // The paper = an ordered list of module instances. Inject the same module type
  // multiple times with different config for multiple sections. Later, a calendar
  // source will inject instances dynamically based on ctx.events.
  const modules: DigestModule[] = [
    weatherModule({ lat, lon, label }),
    fxModule(),
    vocabModule({ count: 3 }),
    newsModule({ stories }),
  ];

  const blocks: Block[] = (
    await Promise.all(modules.map((m) => m.build(ctx).catch(() => [] as Block[])))
  ).flat();

  // Group blocks into pages: a block with newPage starts a fresh chapter; the rest flow
  // onto the current page. Front-matter (weather/fx/vocab-questions) shares the front page.
  const pages: Array<{ id: string; title: string; html: string }> = [
    { id: 'front', title: `kitt daily · ${date}`, html: `<h1>kitt daily</h1><p>${date}</p>` },
  ];
  for (const b of blocks) {
    if (b.newPage) pages.push({ id: `ch${pages.length}`, title: b.title, html: b.html });
    else pages[pages.length - 1].html += `\n${b.html}`;
  }

  // Embed any weather icons referenced in the pages.
  const names = new Set<string>();
  for (const p of pages) for (const m of p.html.matchAll(/icons\/([A-Za-z0-9_]+\.png)/g)) names.add(m[1]);
  const images: Array<{ name: string; data: Buffer }> = [];
  for (const name of names) {
    try { images.push({ name, data: await readFile(join(ICON_DIR, name)) }); } catch { /* skip missing icon */ }
  }

  const buffer = await buildEpub({ title: `kitt daily · ${date}`, chapters: pages, date, images });
  const html = `<!doctype html><meta charset="utf-8"><body style="max-width:680px;margin:2rem auto;font-family:system-ui;line-height:1.55;padding:0 1rem">${pages.map((p) => p.html).join('<hr/>')}</body>`;
  return { buffer, html, meta: { date, sections: blocks.length, pages: pages.length } };
}
