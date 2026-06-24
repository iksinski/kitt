import { fetchDueVocab } from '../sources.js';
import { esc } from '../epub.js';
import { trimSentence } from '../util.js';
import type { DigestModule } from '../types.js';

// Vocab as a 2-page recall exercise: words + sentences (English), then translations.
export function vocabModule(cfg: { count: number }): DigestModule {
  return {
    id: 'vocab',
    async build() {
      const vocab = await fetchDueVocab(cfg.count);
      if (!vocab.length) return [];
      const q = `<h2>Vocabulary</h2><ol>${vocab.map((v) => {
        const s = v.sentence ? `<br/><em>“${esc(trimSentence(v.sentence))}”</em>` : '';
        return `<li><strong>${esc(v.word)}</strong>${s}</li>`;
      }).join('')}</ol><p><small>Translations on the next page →</small></p>`;
      const a = `<h2>Vocabulary — translations</h2><ol>${vocab.map((v) =>
        `<li><strong>${esc(v.word)}</strong> — ${esc(v.translation || '—')}</li>`).join('')}</ol>`;
      return [{ title: 'Vocabulary', html: q }, { title: 'Vocabulary — translations', html: a }];
    },
  };
}
