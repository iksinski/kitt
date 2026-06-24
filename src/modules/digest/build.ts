import { buildEpub } from './epub.js';
import type { DigestModule, DigestContext, Block } from './types.js';
import { weatherModule } from './modules/weather.js';
import { fxModule } from './modules/fx.js';
import { vocabModule } from './modules/vocab.js';
import { newsModule } from './modules/news.js';

export interface DigestResult {
  buffer: Buffer;
  html: string;
  meta: { date: string; sections: number };
}

export async function buildDigest(opts?: { stories?: number; lat?: number; lon?: number; city?: string }): Promise<DigestResult> {
  const stories = opts?.stories ?? Number(process.env.DIGEST_STORIES ?? 10);
  const lat = opts?.lat ?? Number(process.env.DIGEST_LAT ?? 52.13);
  const lon = opts?.lon ?? Number(process.env.DIGEST_LON ?? 21.08);
  const label = opts?.city ?? process.env.DIGEST_CITY ?? 'Warsaw · Kabaty';
  const date = new Date().toISOString().slice(0, 10);
  const ctx: DigestContext = { date, location: { lat, lon, label } };

  // The paper = an ordered list of module instances. Inject the same module type
  // multiple times with different config to get multiple sections. Later, a calendar
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

  const chapters = [
    { id: 'cover', title: `kitt daily · ${date}`, html: `<h1>kitt daily</h1><p>${date}</p>` },
    ...blocks.map((b, i) => ({ id: `ch${i}`, title: b.title, html: b.html })),
  ];

  const buffer = await buildEpub({ title: `kitt daily · ${date}`, chapters, date });
  const html = `<!doctype html><meta charset="utf-8"><body style="max-width:680px;margin:2rem auto;font-family:system-ui;line-height:1.55;padding:0 1rem">${chapters.map((c) => c.html).join('<hr/>')}</body>`;
  return { buffer, html, meta: { date, sections: blocks.length } };
}
