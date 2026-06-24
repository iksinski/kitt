import { esc } from './epub.js';

export const paras = (t: string): string =>
  t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('\n');

export const hostOf = (url: string): string => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

export const trimSentence = (s: string): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > 240 ? t.slice(0, 240).replace(/\s+\S*$/, '') + '…' : t;
};
