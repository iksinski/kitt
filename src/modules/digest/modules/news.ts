import { fetchTopStories } from '../sources.js';
import { extractArticle } from '../extract.js';
import { cleanupViaMac } from '../cleanup.js';
import { esc } from '../epub.js';
import { paras, hostOf } from '../util.js';
import type { DigestModule, Block } from '../types.js';

// Hacker News top stories: local Readability extraction, then LLM cleanup via the Mac.
export function newsModule(cfg: { stories: number }): DigestModule {
  return {
    id: 'news',
    async build() {
      const hn = await fetchTopStories(cfg.stories);

      const raw: Array<{ idx: number; text: string | null }> = [];
      for (let i = 0; i < hn.length; i++) {
        const art = hn[i].url ? await extractArticle(hn[i].url!) : null;
        raw.push({ idx: i, text: art?.text ?? null });
      }
      const cleaned = await cleanupViaMac(raw.filter((r) => r.text).map((r) => ({ id: `s${r.idx}`, text: r.text! })));

      const blocks: Block[] = [];
      for (let i = 0; i < hn.length; i++) {
        const s = hn[i];
        const host = s.url ? hostOf(s.url) : '';
        let body = `<h2>${esc(s.title)}</h2><p>${s.points} points · ${s.comments} comments${host ? ' · ' + esc(host) : ''}</p>`;
        const rt = raw[i].text;
        if (rt) body += paras(cleaned.get(`s${i}`) ?? rt);
        else if (s.url) body += `<p><em>(couldn't extract — read at <a href="${esc(s.url)}">${esc(host)}</a>)</em></p>`;
        blocks.push({ title: `${i + 1}. ${s.title}`, html: body });
      }
      return blocks;
    },
  };
}
