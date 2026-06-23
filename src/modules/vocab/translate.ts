import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { words } from '../../db/schema.js';

const run = promisify(execFile);
const DICT_DB = 'fd-eng-pol';

// Look up a single English term in the offline FreeDict eng-pol dictionary (via local
// dictd). Returns a concise Polish gloss, or null if uncovered. AI-free, deterministic.
export async function lookupPolish(term: string): Promise<string | null> {
  if (!term) return null;
  let stdout = '';
  try {
    ({ stdout } = await run('dict', ['-d', DICT_DB, term], { timeout: 5000 }));
  } catch {
    return null; // dict exits non-zero when there's no match
  }
  // Translations are the lines indented 4+ spaces, under the 2-space headword line.
  const trans = stdout.split('\n').filter((l) => /^\s{4,}\S/.test(l)).map((l) => l.trim());
  if (!trans.length) return null;
  return trans.join('; ').slice(0, 300);
}

// Fill in Polish for every non-deleted word that doesn't have one yet. Tries the stem
// first (handles plurals), then the surface form. Returns how many were filled.
export async function enrichTranslations(): Promise<number> {
  const rows = await db
    .select({ id: words.id, word: words.word, stem: words.stem })
    .from(words)
    .where(and(eq(words.deleted, false), isNull(words.translation)));
  let n = 0;
  for (const r of rows) {
    const t = (await lookupPolish(r.stem)) ?? (await lookupPolish(r.word));
    if (t) {
      await db.update(words).set({ translation: t }).where(eq(words.id, r.id));
      n++;
    }
  }
  return n;
}
