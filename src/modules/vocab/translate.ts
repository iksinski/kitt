import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { words } from '../../db/schema.js';

const run = promisify(execFile);
const DICT_DB = 'fd-eng-pol';

// Wiktionary-derived eng->pol dictionary (WikDict, prebuilt SQLite). Optional fallback after
// FreeDict, for words FreeDict's smaller wordlist misses. Lazily opened; absent file = skip.
const WIKDICT_PATH = process.env.WIKDICT_DB ?? `${process.env.HOME}/kitt/data/wikdict-en-pl.sqlite3`;
let wikdictStmt: ReturnType<DatabaseSync['prepare']> | null | undefined;
function wikdictLookup(term: string): string | null {
  if (wikdictStmt === undefined) {
    try {
      const sdb = new DatabaseSync(WIKDICT_PATH, { readOnly: true });
      wikdictStmt = sdb.prepare('SELECT trans_list FROM simple_translation WHERE written_rep = ? ORDER BY max_score DESC LIMIT 1');
    } catch {
      wikdictStmt = null; // not deployed here — silently skip this source
    }
  }
  if (!wikdictStmt) return null;
  try {
    const row = wikdictStmt.get(term) as { trans_list?: string } | undefined;
    return row?.trans_list ? String(row.trans_list).slice(0, 300) : null;
  } catch {
    return null;
  }
}

// Strip Kindle homograph markers like "coax (1)" -> "coax". Case-preserving (for storage).
export function stripHomograph(s: string): string {
  return (s || '').replace(/\s*\(\d+\)\s*$/, '').trim();
}

// Lookup key form: marker-stripped, trimmed, lowercased.
export function normalizeTerm(raw: string): string {
  return stripHomograph(raw).toLowerCase();
}

// Base-form candidates for an inflected/derived surface form, so the lemma-keyed FreeDict
// dictionary can still match. Deterministic, no AI. Order = most-likely lemma first.
export function morphCandidates(raw: string): string[] {
  const t = normalizeTerm(raw);
  const out: string[] = [];
  const add = (s?: string) => { if (s && s.length > 1 && !out.includes(s)) out.push(s); };
  add(t);
  if (!t) return out;

  // adverbs:  facetiously->facetious, happily->happy, inexorably->inexorable
  if (t.endsWith('ably')) add(t.slice(0, -4) + 'able');
  if (t.endsWith('ibly')) add(t.slice(0, -4) + 'ible');
  if (t.endsWith('ily')) add(t.slice(0, -3) + 'y');
  if (t.endsWith('ly')) add(t.slice(0, -2));

  // adjectives:  clamorous->clamor / clamour
  if (t.endsWith('ous')) { add(t.slice(0, -3)); add(t.slice(0, -3) + 'our'); }

  // nominalisations:  exasperation->exasperate, creation->create
  if (t.endsWith('ation')) add(t.slice(0, -5) + 'ate');
  else if (t.endsWith('tion')) add(t.slice(0, -4) + 'te');

  // verbs:  coaxed->coax, hoped->hope, carried->carry, coaxing->coax, hoping->hope
  if (t.endsWith('ied')) add(t.slice(0, -3) + 'y');
  if (t.endsWith('ed')) { add(t.slice(0, -2)); add(t.slice(0, -1)); add(t.slice(0, -3)); }
  if (t.endsWith('ing')) { add(t.slice(0, -3)); add(t.slice(0, -3) + 'e'); }

  // plurals:  bodies->body, boxes->box, cats->cat
  if (t.endsWith('ies')) add(t.slice(0, -3) + 'y');
  else if (t.endsWith('es')) add(t.slice(0, -2));
  else if (t.endsWith('s')) add(t.slice(0, -1));

  // negative prefix:  unwonted->wonted, unfathomable->fathomable
  if (t.startsWith('un') && t.length > 4) add(t.slice(2));

  return out;
}

// Query the offline FreeDict eng-pol dictionary via local dictd for one exact term.
async function dictLookup(term: string): Promise<string | null> {
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

// Best offline Polish gloss for a word: over cleaned-stem then surface-form candidates,
// try FreeDict first (smaller but higher quality), then the Wiktionary-derived WikDict as a
// fallback. First hit wins. AI-free, deterministic.
export async function lookupPolish(word: string, stem: string): Promise<string | null> {
  const cands: string[] = [];
  for (const c of [...morphCandidates(stem), ...morphCandidates(word)]) {
    if (!cands.includes(c)) cands.push(c);
  }
  for (const cand of cands) {
    const hit = await dictLookup(cand);
    if (hit) return hit;
  }
  for (const cand of cands) {
    const hit = wikdictLookup(cand);
    if (hit) return hit;
  }
  return null;
}

// Fill in Polish for every non-deleted word that doesn't have one yet. Returns how many
// were filled. Words still uncovered stay null (edit them by hand in the UI).
export async function enrichTranslations(): Promise<number> {
  const rows = await db
    .select({ id: words.id, word: words.word, stem: words.stem })
    .from(words)
    .where(and(eq(words.deleted, false), isNull(words.translation)));
  let n = 0;
  for (const r of rows) {
    const t = await lookupPolish(r.word, r.stem);
    if (t) {
      await db.update(words).set({ translation: t }).where(eq(words.id, r.id));
      n++;
    }
  }
  return n;
}
