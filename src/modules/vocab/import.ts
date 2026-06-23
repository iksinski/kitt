import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { books, words, lookups, fsrsCards } from '../../db/schema.js';
import { newCard } from './fsrs.js';

type Row = Record<string, any>;
const ts = (v: any): Date => new Date(Number(v));

export interface ImportResult {
  books: number;
  words: number;
  lookups: number;
  newCards: number;
}

/** Read a Kindle vocab.db (sqlite) and upsert it into Postgres. Idempotent. */
export async function importVocab(sqlitePath: string): Promise<ImportResult> {
  const k = new DatabaseSync(sqlitePath, { readOnly: true });
  const bookRows = k.prepare('SELECT id, asin, lang, title, authors FROM BOOK_INFO').all() as Row[];
  const wordRows = k.prepare('SELECT id, word, stem, lang, category, timestamp FROM WORDS').all() as Row[];
  const lookupRows = k.prepare('SELECT id, word_key, book_key, usage, timestamp FROM LOOKUPS').all() as Row[];
  k.close();

  if (bookRows.length) {
    await db.insert(books).values(bookRows.map((b) => ({
      id: b.id, asin: b.asin ?? null, lang: b.lang || null, title: b.title ?? null, authors: b.authors ?? null,
    }))).onConflictDoUpdate({
      target: books.id,
      set: { title: sql`excluded.title`, authors: sql`excluded.authors` },
    });
  }

  if (wordRows.length) {
    await db.insert(words).values(wordRows.map((w) => ({
      id: w.id, word: w.word, stem: w.stem, lang: w.lang, category: Number(w.category) || 0, addedAt: ts(w.timestamp),
    }))).onConflictDoUpdate({
      target: words.id,
      set: { category: sql`excluded.category`, word: sql`excluded.word`, stem: sql`excluded.stem` },
    });
  }

  const knownBooks = new Set(bookRows.map((b) => b.id));
  if (lookupRows.length) {
    await db.insert(lookups).values(lookupRows.map((l) => ({
      id: l.id,
      wordId: l.word_key,
      bookId: knownBooks.has(l.book_key) ? l.book_key : null,
      usage: l.usage ?? null,
      lookedUpAt: ts(l.timestamp),
    }))).onConflictDoNothing();
  }

  // Seed an FSRS card for every word that doesn't have one yet.
  const existing = await db.select({ id: fsrsCards.wordId }).from(fsrsCards);
  const have = new Set(existing.map((r) => r.id));
  const toSeed = wordRows.filter((w) => !have.has(w.id));
  if (toSeed.length) {
    await db.insert(fsrsCards).values(toSeed.map((w) => ({ wordId: w.id, ...newCard() })));
  }

  return { books: bookRows.length, words: wordRows.length, lookups: lookupRows.length, newCards: toSeed.length };
}

// CLI: `pnpm import [path]`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2] ?? `${process.env.HOME}/kindle-sync/vocab.db`;
  importVocab(path)
    .then((r) => { console.log('imported:', r); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
