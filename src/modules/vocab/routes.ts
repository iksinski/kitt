import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { count, eq, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { words, lookups, books, fsrsCards } from '../../db/schema.js';
import { review, type RatingName } from './fsrs.js';
import { importVocab } from './import.js';

export async function vocabRoutes(app: FastifyInstance) {
  // Words currently due for review (the main MCP/assistant entry point).
  app.get('/words/due', async (req) => {
    const limit = z.coerce.number().int().min(1).max(200).catch(20).parse((req.query as any)?.limit);
    const now = new Date();
    const due = await db
      .select({ id: words.id, word: words.word, stem: words.stem, lang: words.lang, due: fsrsCards.due, state: fsrsCards.state, reps: fsrsCards.reps })
      .from(fsrsCards)
      .innerJoin(words, eq(fsrsCards.wordId, words.id))
      .where(lte(fsrsCards.due, now))
      .orderBy(fsrsCards.due)
      .limit(limit);
    return { count: due.length, due };
  });

  // Full detail for one word, including the sentences it was seen in.
  app.get('/words/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const w = await db.select().from(words).where(eq(words.id, id)).limit(1);
    if (!w.length) return reply.code(404).send({ error: 'word not found' });
    const seen = await db
      .select({ usage: lookups.usage, book: books.title, authors: books.authors, at: lookups.lookedUpAt })
      .from(lookups)
      .leftJoin(books, eq(lookups.bookId, books.id))
      .where(eq(lookups.wordId, id))
      .orderBy(lookups.lookedUpAt);
    const card = await db.select().from(fsrsCards).where(eq(fsrsCards.wordId, id)).limit(1);
    return { word: w[0], lookups: seen, card: card[0] ?? null };
  });

  // Submit a review outcome -> FSRS reschedules the card.
  const reviewBody = z.object({ wordId: z.string(), rating: z.enum(['again', 'hard', 'good', 'easy']) });
  app.post('/reviews', async (req, reply) => {
    const { wordId, rating } = reviewBody.parse(req.body);
    const rows = await db.select().from(fsrsCards).where(eq(fsrsCards.wordId, wordId)).limit(1);
    if (!rows.length) return reply.code(404).send({ error: 'no card for word' });
    const c = rows[0];
    const next = review(
      { due: c.due, stability: c.stability, difficulty: c.difficulty, elapsedDays: c.elapsedDays, scheduledDays: c.scheduledDays, reps: c.reps, lapses: c.lapses, state: c.state, lastReview: c.lastReview },
      rating as RatingName,
    );
    await db.update(fsrsCards).set(next).where(eq(fsrsCards.wordId, wordId));
    return { wordId, due: next.due, state: next.state, reps: next.reps };
  });

  // Trigger an import from a Kindle vocab.db already on disk.
  const importBody = z.object({ path: z.string().optional() }).optional();
  app.post('/import', async (req) => {
    const body = importBody.parse(req.body) ?? {};
    const path = body?.path ?? `${process.env.HOME}/kindle-sync/vocab.db`;
    return await importVocab(path);
  });

  // Library stats.
  app.get('/stats', async () => {
    const now = new Date();
    const [{ total }] = await db.select({ total: count() }).from(words);
    const [{ due }] = await db.select({ due: count() }).from(fsrsCards).where(lte(fsrsCards.due, now));
    const byState = await db.select({ state: fsrsCards.state, n: count() }).from(fsrsCards).groupBy(fsrsCards.state);
    return { totalWords: Number(total), due: Number(due), byState };
  });
}
