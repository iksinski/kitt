import { fetchTopStories, fetchWeather, fetchUsdPln, fetchDueVocab } from './sources.js';
import { extractArticle } from './extract.js';
import { cleanupViaMac } from './cleanup.js';
import { buildEpub, esc } from './epub.js';

const paras = (t: string): string =>
  t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('\n');

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export interface DigestResult {
  buffer: Buffer;
  html: string;
  meta: { date: string; stories: number; extracted: number; cleaned: number; vocab: number; hasWeather: boolean; hasFx: boolean };
}

export async function buildDigest(opts?: { stories?: number; lat?: number; lon?: number; city?: string }): Promise<DigestResult> {
  const stories = opts?.stories ?? Number(process.env.DIGEST_STORIES ?? 10);
  const lat = opts?.lat ?? Number(process.env.DIGEST_LAT ?? 52.13);
  const lon = opts?.lon ?? Number(process.env.DIGEST_LON ?? 21.08);
  const city = opts?.city ?? process.env.DIGEST_CITY ?? 'Warsaw · Kabaty';
  const date = new Date().toISOString().slice(0, 10);

  const [hn, weather, fx, vocab] = await Promise.all([
    fetchTopStories(stories),
    fetchWeather(lat, lon),
    fetchUsdPln(),
    fetchDueVocab(10),
  ]);

  // Front page: weather, FX, due vocab.
  let front = `<h1>kitt daily</h1><p>${date}</p>`;
  if (weather) front += `<h2>Weather · ${esc(city)}</h2><p>${weather.nowC != null ? 'Now ' + weather.nowC + '°C' + (weather.condition ? ', ' + esc(weather.condition) : '') + '. ' : ''}Today ${weather.minC}–${weather.maxC}°C, precipitation ${weather.precipMm} mm. <span>(yr.no)</span></p>`;
  if (fx) front += `<h2>USD / PLN</h2><p>${fx.rate} (NBP, ${fx.date})</p>`;
  if (vocab.length) front += `<h2>Vocabulary due (${vocab.length})</h2><ul>${vocab.map((v) => `<li>${esc(v.word)}${v.stem && v.stem !== v.word ? ' — ' + esc(v.stem) : ''}</li>`).join('')}</ul>`;

  const chapters = [{ id: 'front', title: 'kitt daily · ' + date, html: front }];

  // 1) Extract every article's text locally (Readability).
  const raw: Array<{ idx: number; text: string | null }> = [];
  for (let i = 0; i < hn.length; i++) {
    const art = hn[i].url ? await extractArticle(hn[i].url!) : null;
    raw.push({ idx: i, text: art?.text ?? null });
  }
  // 2) Batch-clean the successful ones via the Mac's locked Ollama proxy (fallback: raw text).
  const cleaned = await cleanupViaMac(raw.filter((r) => r.text).map((r) => ({ id: `story-${r.idx + 1}`, text: r.text! })));

  let extracted = 0, llmCleaned = 0;
  for (let i = 0; i < hn.length; i++) {
    const s = hn[i];
    const id = `story-${i + 1}`;
    const host = s.url ? hostOf(s.url) : '';
    let body = `<h2>${esc(s.title)}</h2><p>${s.points} points · ${s.comments} comments${host ? ' · ' + esc(host) : ''}</p>`;
    const rawText = raw[i].text;
    if (rawText) {
      extracted++;
      if (cleaned.has(id)) llmCleaned++;
      body += paras(cleaned.get(id) ?? rawText);
    } else if (s.url) {
      body += `<p><em>(couldn't extract — read at <a href="${esc(s.url)}">${esc(host)}</a>)</em></p>`;
    }
    chapters.push({ id, title: `${i + 1}. ${s.title}`, html: body });
  }

  const buffer = await buildEpub({ title: `kitt daily · ${date}`, chapters, date });
  const html = `<!doctype html><meta charset="utf-8"><body style="max-width:680px;margin:2rem auto;font-family:system-ui;line-height:1.55;padding:0 1rem">${chapters.map((c) => c.html).join('<hr/>')}</body>`;
  return { buffer, html, meta: { date, stories: hn.length, extracted, cleaned: llmCleaned, vocab: vocab.length, hasWeather: !!weather, hasFx: !!fx } };
}
