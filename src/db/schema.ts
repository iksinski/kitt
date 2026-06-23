import { pgTable, text, integer, real, timestamp } from 'drizzle-orm/pg-core';

// Mirror of the Kindle vocab.db, normalized into Postgres.
export const books = pgTable('books', {
  id: text('id').primaryKey(),           // Kindle BOOK_INFO.id
  asin: text('asin'),
  lang: text('lang'),
  title: text('title'),
  authors: text('authors'),
});

export const words = pgTable('words', {
  id: text('id').primaryKey(),           // e.g. "en:conciliations"
  word: text('word').notNull(),
  stem: text('stem').notNull(),          // lemma
  lang: text('lang').notNull(),
  category: integer('category').notNull().default(0), // 0 = learning, 100 = mastered
  addedAt: timestamp('added_at', { withTimezone: true }).notNull(),
});

export const lookups = pgTable('lookups', {
  id: text('id').primaryKey(),           // Kindle LOOKUPS.id
  wordId: text('word_id').notNull().references(() => words.id),
  bookId: text('book_id').references(() => books.id),
  usage: text('usage'),                  // the sentence the word appeared in
  lookedUpAt: timestamp('looked_up_at', { withTimezone: true }).notNull(),
});

// One FSRS scheduling card per word.
export const fsrsCards = pgTable('fsrs_cards', {
  wordId: text('word_id').primaryKey().references(() => words.id),
  due: timestamp('due', { withTimezone: true }).notNull(),
  stability: real('stability').notNull(),
  difficulty: real('difficulty').notNull(),
  elapsedDays: integer('elapsed_days').notNull(),
  scheduledDays: integer('scheduled_days').notNull(),
  reps: integer('reps').notNull(),
  lapses: integer('lapses').notNull(),
  state: integer('state').notNull(),     // 0 New, 1 Learning, 2 Review, 3 Relearning
  lastReview: timestamp('last_review', { withTimezone: true }),
});
