import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export interface Article { title: string; text: string; }

// Fetch a URL and extract its main article text, locally, via Readability. Returns the
// plain text (no markup, no ads), or null when extraction fails (SPA/paywall/blocked) —
// the caller degrades to a link in that case.
export async function extractArticle(url: string): Promise<Article | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) kitt-digest/1.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const ctype = res.headers.get('content-type') ?? '';
    if (!ctype.includes('html')) return null;
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    dom.window.close();
    if (!article?.textContent) return null;
    const text = article.textContent.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length < 200) return null; // too little -> probably JS-rendered or blocked
    return { title: article.title ?? '', text: text.slice(0, 8000) };
  } catch {
    return null;
  }
}
